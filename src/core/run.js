// 勝ち抜き（20体版・元は100体）（設計書 §3〜§8・10/12 夜 本人「場所は存在しなく、100体倒してゲームクリア」）。どの関数も元を書き換えない
import { TYPES } from '../data/types.js?v=34';
import { GUIDE_IDS } from '../data/guides.js?v=34';
import { HERO_TYPE, OKAMI, NEW_TECH_AT, newTechIds } from '../data/heroes.js?v=34';
import { foeAt } from '../data/foes.js?v=34';
import { inGame } from '../data/kimarite.js?v=34';
import { RANKS, CLEAR_AT, PLAY_COUNT, promotionAt } from './ladder.js?v=34';
import { startStats, growthMult, diminish } from './career.js?v=34';
import { GROWTH, FOE_TOTAL, TRAIN } from './tuning.js?v=34';

export const RUN_VERSION = 4;
export const TRAIN_STEPS = 3; // 1回の稽古のコマ数
export const STATS = ['shin', 'gi', 'tai'];
const r1 = (v) => Math.round(v * 10) / 10;
const cap = (v) => Math.min(100, r1(v));
const total = (s) => s.shin + s.gi + s.tai;

// 案内役は若女将ことねに固定（呼ぶ側の guide は受け取るだけで使わない・読み込み deserializeRun と同じ）
export function newRun({ type, seed }) {
  return {
    version: RUN_VERSION, guide: OKAMI, type,
    stats: startStats(type),
    known: [...TYPES[type].sample], pendingLearn: null, learnKind: null,
    wins: 0, losses: 0, streak: 0, trainings: 0,
    unlocked: [newTechIds(type)[0]], newKnown: [],
    training: null, seed, cleared: false, seenHelp: false,
  };
}

// 何体目（0から）の敵の心技体の和（FOE_TOTAL.anchors の折れ線）
export function foeTotal(index) {
  const a = FOE_TOTAL.anchors;
  if (index <= a[0][0]) return a[0][1];
  for (let i = 1; i < a.length; i++) {
    const [p1, t1] = a[i];
    if (index <= p1) {
      const [p0, t0] = a[i - 1];
      return t0 + (t1 - t0) * (index - p0) / (p1 - p0);
    }
  }
  return a[a.length - 1][1];
}

// 敵の心技体：タイプの形（base）のまま和を foeTotal に・各値は100まで
export function foeStats(type, index) {
  const b = TYPES[type].base;
  const k = foeTotal(index) / (b.shin + b.gi + b.tai);
  return { shin: Math.min(100, r1(b.shin * k)), gi: Math.min(100, r1(b.gi * k)), tai: Math.min(100, r1(b.tai * k)) };
}

export function currentFoe(run) {
  if (run.cleared || run.wins >= PLAY_COUNT) return null;
  const f = foeAt(run.wins);
  return { ...f, stats: foeStats(f.type, f.index) };
}

// 1番ごとの伸び：勝ち＝格上ほど多い（和の差 upsetSpanTotal で upsetMax）・負け＝勝ちの lossMult 倍
function grow(run, foeS, won) {
  const gap = Math.min(1, Math.max(0, (total(foeS) - total(run.stats)) / GROWTH.upsetSpanTotal));
  const k = won ? 1 + (GROWTH.upsetMax - 1) * gap : GROWTH.lossMult;
  const stats = { ...run.stats };
  for (const s of STATS) stats[s] = cap(stats[s] + GROWTH.win * k * growthMult(run.type, s) * diminish(stats[s]));
  return stats;
}

export function recordResult(run, won) {
  const foe = currentFoe(run);
  if (!foe) return { run, note: null };
  const stats = grow(run, foe.stats, won);
  const base = { won, foe, before: run.stats, after: stats, promoted: null, unlocked: null, cleared: false };
  if (!won) return { run: { ...run, stats, losses: run.losses + 1, streak: run.streak + 1 }, note: base };
  const wins = run.wins + 1;
  const next = { ...run, stats, wins, streak: 0 };
  const promoted = promotionAt(wins);
  const k = NEW_TECH_AT.indexOf(wins);
  const unlocked = k > 0 ? newTechIds(run.type)[k] : null;
  if (unlocked) next.unlocked = [...run.unlocked, unlocked];
  if (wins >= CLEAR_AT) next.cleared = true;
  return { run: next, note: { ...base, promoted, unlocked, cleared: next.cleared } };
}

// 稽古（3コマ）。負けた後の稽古と、番付からいつでも入る稽古（voluntary・10/13 本人「好きなときに稽古が出来るように」）。
// 始まっていれば始め直さない。入った回数 trainings を数える（クリアの画面の成績）：
//   負けた後の稽古＝入った時に数える／自分から入る稽古＝最初の1コマを終えた時に数える（入って何もせず戻っても数えない）
// 自分から入る稽古の最中に負けの稽古を頼まれたら、負けた後の稽古（抜けられない側）に切り替える（フラグを捨て、3コマ数え直し）
export function startTraining(run, { voluntary = false } = {}) {
  if (run.training) {
    if (voluntary || !run.training.voluntary) return run;
    const fresh = run.training.left === TRAIN_STEPS; // 自分から入って1コマも終えていない＝まだ数えていない
    return { ...run, training: { left: TRAIN_STEPS }, trainings: (run.trainings || 0) + (fresh ? 1 : 0) };
  }
  if (voluntary) return { ...run, training: { left: TRAIN_STEPS, voluntary: true } };
  return { ...run, training: { left: TRAIN_STEPS }, trainings: (run.trainings || 0) + 1 };
}

// 番付から入った稽古は、どのコマでも番付へ戻れる（残りのコマは捨てる）。負けた後の稽古は終えるまで抜けない（同じ物を返す）
export const canLeaveTraining = (run) => !!(run.training && run.training.voluntary);
export function leaveTraining(run) {
  return canLeaveTraining(run) ? { ...run, training: null } : run;
}

const step = (run, changes) => {
  const left = run.training.left - 1;
  const first = run.training.voluntary === true && run.training.left === TRAIN_STEPS; // 自分から入る稽古の最初の1コマ＝ここで1回と数える
  return { ...run, ...changes, trainings: (run.trainings || 0) + (first ? 1 : 0), training: left > 0 ? { ...run.training, left } : null };
};

// mult＝遊びの出来の倍率（src/core/drills.js の drillMult・0.5〜1.5）。既定 1＝今までと同じ伸び
export function trainStat(run, stat, mult = 1) {
  if (!run.training || !STATS.includes(stat)) return run;
  const m = Number.isFinite(mult) && mult >= 0 ? mult : 1;
  const stats = { ...run.stats };
  stats[stat] = cap(stats[stat] + TRAIN.gain * m * growthMult(run.type, stat) * diminish(stats[stat]));
  return step(run, { stats });
}

export function trainNewTech(run, id) {
  if (!run.training || !run.unlocked.includes(id) || run.newKnown.includes(id)) return run;
  return step(run, { newKnown: [...run.newKnown, id] });
}

export const serializeRun = (run) => JSON.stringify(run);

const count = (v) => Number.isInteger(v) && v >= 0;
const validStats = (s) => !!s && typeof s === 'object' && STATS.every((k) => Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= 100);
const RANK_IDS = RANKS.map((r) => r.id);

export function deserializeRun(text) {
  try {
    const c = JSON.parse(text);
    if (!c || typeof c !== 'object' || c.version !== RUN_VERSION) return null;
    if (c.type !== HERO_TYPE || !GUIDE_IDS.includes(c.guide)) return null;
    if (!validStats(c.stats) || !Number.isFinite(c.seed)) return null;
    if (count(c.wins) && c.wins > CLEAR_AT) c.wins = CLEAR_AT; // 20体版より先まで進んだ古い記録はクリア済みに
    if (!count(c.wins) || !count(c.losses) || !count(c.streak)) return null;
    c.cleared = c.wins >= CLEAR_AT;
    if (!count(c.trainings)) c.trainings = 0; // 稽古の回数を数える前の記録は 0 から
    c.seenHelp = c.seenHelp === true;
    if (c.training !== null && !(c.training && Number.isInteger(c.training.left) && c.training.left >= 1 && c.training.left <= TRAIN_STEPS)) return null;
    if (c.training) c.training = c.training.voluntary === true ? { left: c.training.left, voluntary: true } : { left: c.training.left }; // voluntary の無い古い記録は負けた後の稽古
    const known = Array.isArray(c.known) ? c.known.filter(inGame) : [];
    c.known = known.length ? known : [...TYPES[c.type].sample];
    const mine = newTechIds(c.type);
    c.unlocked = mine.filter((id, k) => NEW_TECH_AT[k] <= c.wins);
    c.newKnown = Array.isArray(c.newKnown) ? c.newKnown.filter((id) => c.unlocked.includes(id)) : [];
    const pending = Array.isArray(c.pendingLearn) ? c.pendingLearn.filter(inGame) : [];
    c.pendingLearn = pending.length ? pending : null;
    c.learnKind = c.pendingLearn && RANK_IDS.includes(c.learnKind) ? c.learnKind : null;
    c.guide = OKAMI;
    return c;
  } catch {
    return null;
  }
}
