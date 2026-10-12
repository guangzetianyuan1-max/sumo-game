// 100体の勝ち抜き（設計書 §3〜§8・10/12 夜 本人「場所は存在しなく、100体倒してゲームクリア」）。どの関数も元を書き換えない
import { TYPES } from '../data/types.js?v=29';
import { GUIDE_IDS } from '../data/guides.js?v=29';
import { HEROES, NEW_TECH_AT, newTechIds } from '../data/heroes.js?v=29';
import { foeAt, FOE_COUNT } from '../data/foes.js?v=29';
import { inGame } from '../data/kimarite.js?v=29';
import { RANKS, CLEAR_AT, promotionAt } from './ladder.js?v=29';
import { startStats, growthMult, diminish } from './career.js?v=29';
import { learnChoices } from './learn.js?v=29';
import { makeRng } from './rng.js?v=29';
import { GROWTH, FOE_TOTAL, TRAIN } from './tuning.js?v=29';

export const RUN_VERSION = 4;
export const TRAIN_STEPS = 3; // 1回の稽古のコマ数
export const STATS = ['shin', 'gi', 'tai'];
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const r1 = (v) => Math.round(v * 10) / 10;
const cap = (v) => Math.min(100, r1(v));
const total = (s) => s.shin + s.gi + s.tai;

export function newRun({ guide, type, seed }) {
  return {
    version: RUN_VERSION, guide, type,
    stats: startStats(type),
    known: [...TYPES[type].sample], pendingLearn: null, learnKind: null,
    wins: 0, losses: 0, streak: 0,
    unlocked: [newTechIds(type)[0]], newKnown: [],
    training: null, seed, cleared: false,
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
  if (run.cleared || run.wins >= FOE_COUNT) return null;
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
  if (promoted) {
    const choices = learnChoices(next, makeRng(run.seed * 1000 + wins));
    next.pendingLearn = choices.length ? choices : null;
    next.learnKind = choices.length ? promoted : null;
  }
  const k = NEW_TECH_AT.indexOf(wins);
  const unlocked = k > 0 ? newTechIds(run.type)[k] : null;
  if (unlocked) next.unlocked = [...run.unlocked, unlocked];
  if (wins >= CLEAR_AT) next.cleared = true;
  return { run: next, note: { ...base, promoted, unlocked, cleared: next.cleared } };
}

// 稽古（負けた後だけ・3コマ）。始まっていれば始め直さない
export function startTraining(run) {
  return run.training ? run : { ...run, training: { left: TRAIN_STEPS } };
}

const step = (run, changes) => {
  const left = run.training.left - 1;
  return { ...run, ...changes, training: left > 0 ? { left } : null };
};

export function trainStat(run, stat) {
  if (!run.training || !STATS.includes(stat)) return run;
  const stats = { ...run.stats };
  stats[stat] = cap(stats[stat] + TRAIN.gain * growthMult(run.type, stat) * diminish(stats[stat]));
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
    if (!hasOwn(TYPES, c.type) || !GUIDE_IDS.includes(c.guide)) return null;
    if (!validStats(c.stats) || !Number.isFinite(c.seed)) return null;
    if (!count(c.wins) || c.wins > CLEAR_AT || !count(c.losses) || !count(c.streak)) return null;
    if (typeof c.cleared !== 'boolean' || c.cleared !== (c.wins >= CLEAR_AT)) return null;
    if (c.training !== null && !(c.training && Number.isInteger(c.training.left) && c.training.left >= 1 && c.training.left <= TRAIN_STEPS)) return null;
    const known = Array.isArray(c.known) ? c.known.filter(inGame) : [];
    c.known = known.length ? known : [...TYPES[c.type].sample];
    const mine = newTechIds(c.type);
    c.unlocked = Array.isArray(c.unlocked) ? c.unlocked.filter((id) => mine.includes(id)) : [];
    if (!c.unlocked.includes(mine[0])) c.unlocked = [mine[0], ...c.unlocked];
    c.newKnown = Array.isArray(c.newKnown) ? c.newKnown.filter((id) => c.unlocked.includes(id)) : [];
    const pending = Array.isArray(c.pendingLearn) ? c.pendingLearn.filter(inGame) : [];
    c.pendingLearn = pending.length ? pending : null;
    c.learnKind = c.pendingLearn && RANK_IDS.includes(c.learnKind) ? c.learnKind : null;
    return c;
  } catch {
    return null;
  }
}
