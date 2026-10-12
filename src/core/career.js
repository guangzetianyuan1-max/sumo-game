// 一代記の状態・勝つたびの伸び・記録（設計書 §3・10/12 作り直しで稽古と疲れを無くした）。どの関数も元を書き換えない
import { TYPES } from '../data/types.js?v=30';
import { LADDER_SIZE } from '../data/ranks.js?v=30';
import { GROWTH, HEYA_GROW_MULT } from './tuning.js?v=30';
import { HEYA, heyaOfGuide } from '../data/heya.js?v=30';
import { inGame } from '../data/kimarite.js?v=30';

// 古い iPhone の Safari（iOS 15.4 より前）には Object.hasOwn が無い＝札を押すと止まっていた（10/10）
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// 稽古の名前と伸びの表は、使わなくなった稽古の絵・声・言葉（words.js・widgets.js・sfx）と応援（cheer.js）のために残す（10/12 稽古は流れから外した）
export const TRAININGS = ['shiko', 'teppo', 'chanko', 'waza', 'butsukari', 'moushiai', 'rest'];
// 稽古1回の伸び（GROWTH.gain・伸びやすさ・伸びの鈍りを掛ける前）。体の稽古は疲れで減るぶん少し厚くしてある（10/11 試運転で合わせた）
export const GAIN = {
  shiko: { tai: 2, shin: 1.5 },
  teppo: { tai: 2.5, gi: 1.25 },
  chanko: { tai: 3 },
  waza: { gi: 2.5 },
  butsukari: { shin: 2.8, tai: 2.4 },
  moushiai: { gi: 1.5, shin: 1.5 },
  rest: {},
};
const MULT = {
  heavy: { tai: 1.5, gi: 0.5 },
  small: { gi: 1.5, tai: 0.5 },
  balance: {},
  yotsu: { shin: 1.5, gi: 0.75 },
  tall: { gi: 1.25, tai: 1.25, shin: 0.5 },
};
export const CAREER_KEY = 'sumo.career'; // 記録①の置き場（記録が1つだった頃からの鍵）
const KEY = CAREER_KEY;
const VERSION = 3; // 10/12 稽古を無くした（版2は移して読む・版1は読まない）
const r1 = (v) => Math.round(v * 10) / 10;
const cap = (v) => Math.min(100, r1(v));

export const growthMult = (type, stat) => MULT[type]?.[stat] ?? 1;

// 伸びは値が上がるほど鈍る（横綱でようやく100）
export const diminish = (v) => Math.max(GROWTH.dimFloor, 1 - v / GROWTH.dimDen);
// 入門の値：タイプの形（base・和150）を GROWTH.start 倍（どの値も10以下）
export const startStats = (type) => {
  const b = TYPES[type].base;
  return { shin: r1(b.shin * GROWTH.start), gi: r1(b.gi * GROWTH.start), tai: r1(b.tai * GROWTH.start) };
};

// 取組の心技体＝値そのまま（10/12 疲れと調子を無くした）
export function boutStats(career) {
  const s = career.stats;
  return { shin: s.shin, gi: s.gi, tai: s.tai };
}

export function newCareer({ guide, type, name, seed }) {
  return {
    version: VERSION, guide, type, name,
    stats: startStats(type),
    known: [...TYPES[type].sample], pendingLearn: null, learnKind: null,
    pos: LADDER_SIZE - 1, bashoIndex: 0, history: [], basho: null, seed, kinboshi: 0,
  };
}

// 格上に勝った時の倍率：席の差（相手が上＝小さい番号）が upsetSpan で upsetMax に届く・格下や同じ席は1
const upset = (myPos, oppPos) => 1 + (GROWTH.upsetMax - 1) * Math.min(1, Math.max(0, myPos - oppPos) / GROWTH.upsetSpan);

// 1番ごとの伸び（10/12 本人「相手に勝ったら、心技体が少しづつ加算され強くなる」）。負けは勝ちの lossMult 倍
export function winGrowth(career, oppPos, won) {
  const heya = heyaOfGuide(career.guide);
  const grows = heya !== null ? HEYA[heya].grows : null;
  const k = won ? upset(career.pos, oppPos) : GROWTH.lossMult;
  const stats = { ...career.stats };
  for (const s of ['shin', 'gi', 'tai']) {
    let add = GROWTH.win * k * growthMult(career.type, s) * diminish(stats[s]);
    if (s === grows) add *= HEYA_GROW_MULT;
    stats[s] = cap(stats[s] + add);
  }
  return { ...career, stats };
}

export const serialize = (career) => JSON.stringify(career);

const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const validName = (n) => !!n && typeof n === 'object' && nonEmpty(n.ja) && nonEmpty(n.en);
const validStats = (s) => !!s && typeof s === 'object' && Number.isFinite(s.shin) && Number.isFinite(s.gi) && Number.isFinite(s.tai);
const validPos = (p) => Number.isInteger(p) && p >= 0 && p < LADDER_SIZE; // 梯子の中の席
const count = (v) => Number.isInteger(v) && v >= 0;
// 番付の履歴の1場所：席・勝ち・負け（優勝は書いてあれば真偽）
const validHistory = (h) => !!h && typeof h === 'object' && validPos(h.pos) && count(h.wins) && count(h.losses)
  && (h.yusho === undefined || typeof h.yusho === 'boolean');
const MONTHS = [1, 3, 5, 7, 9, 11]; // basho.js の BASHO_MONTHS と同じ（読み込むと輪になるので写し）

// 場所の相手：しこ名・タイプ・席・心技体がそろっている。星（record・幕下以下の2番目から）は書いてあれば0以上の整数の勝ち・負け
const validRecord = (r) => !!r && typeof r === 'object' && count(r.wins) && count(r.losses);
const validOpponent = (o) => !!o && typeof o === 'object' && validName(o.name) && hasOwn(TYPES, o.type)
  && validPos(o.pos) && validStats(o.stats) && (o.record === undefined || validRecord(o.record));

// 取組の結果：まだ（null）・勝ち・負け・休み（休場の場所）
const RESULTS = [null, 'win', 'loss', 'absent'];

// 場所の記録：月・場所の名・4つの配列が同じ長さ・相手がそろう（未定は下の決まりの時だけ）・day は 0〜日の数の整数・休場（kyujo）は書いてあれば真偽
function validBasho(b) {
  if (!b || typeof b !== 'object') return false;
  if (!MONTHS.includes(b.month) || !nonEmpty(b.place)) return false;
  if (b.kyujo !== undefined && typeof b.kyujo !== 'boolean') return false;
  if (b.startStats !== undefined && !validStats(b.startStats)) return false; // 10/12 場所の始めの心技体（無い古い記録も読む）
  const arrs = [b.days, b.opponents, b.results, b.kimarite];
  if (!arrs.every(Array.isArray)) return false;
  const len = b.days.length;
  if (!arrs.every((a) => a.length === len)) return false;
  if (!b.results.every((r) => RESULTS.includes(r))) return false;
  if (!Number.isInteger(b.day)) return false;
  // 未定の相手（null）は幕下以下の2番目から・今日より先の日か休みの日だけ（10/11 取組は前の日に決まる）
  const undecidedOk = (i) => i > 0 && (i >= b.day || b.results[i] === 'absent');
  if (!b.opponents.every((o, i) => (o === null ? undecidedOk(i) : validOpponent(o)))) return false;
  return Number.isInteger(b.day) && b.day >= 0 && b.day <= len;
}

const LEARN_KINDS = ['kachikoshi', 'juryo', 'makuuchi']; // 節目の種類（learn.js の milestone）
// 覚える候補：ゲームの手だけ・空なら null
const keepPending = (p) => {
  const kept = Array.isArray(p) ? p.filter(inGame) : [];
  return kept.length ? kept : null;
};

// 版2（稽古があった頃）の記録を版3へ：稽古の回数と疲れは捨てる・休場の場所は捨てる（番付から始め直す）・覚えた手はタイプの見本の手
function fromV2(c) {
  const { fatigue, trainingLeft, ...rest } = c;
  // 場所の途中なら、移した時の心技体を場所の始めの値にする（結果の画面の伸びが0にならない）
  const basho = !c.basho || c.basho.kyujo === true ? null : { ...c.basho, startStats: { ...c.stats } };
  return { ...rest, version: VERSION, basho, known: [...TYPES[c.type].sample], pendingLearn: null };
}

export function deserialize(text) {
  try {
    let c = JSON.parse(text);
    if (!c || typeof c !== 'object') return null;
    if (c.version === 2) {
      if (!hasOwn(TYPES, c.type)) return null;
      c = fromV2(c);
    }
    if (c.version !== VERSION) return null;
    if (!hasOwn(TYPES, c.type)) return null;
    if (!validStats(c.stats)) return null;
    if (![c.pos, c.bashoIndex].every(Number.isFinite)) return null;
    if (!validPos(c.pos)) return null;
    if (!Array.isArray(c.history) || !c.history.every(validHistory)) return null;
    if (!validName(c.name)) return null;
    if (c.basho !== null && !validBasho(c.basho)) return null;
    // 金星の数（10/11 足した）：無い記録は0・数でなければ読まない
    if (c.kinboshi === undefined) c.kinboshi = 0;
    else if (!count(c.kinboshi)) return null;
    const kept = Array.isArray(c.known) ? c.known.filter(inGame) : [];
    c.known = kept.length ? kept : [...TYPES[c.type].sample];
    delete c.strategy; // 作戦表は記録に書かない（古い記録にあれば捨てる）
    c.pendingLearn = keepPending(c.pendingLearn);
    c.learnKind = c.pendingLearn && LEARN_KINDS.includes(c.learnKind) ? c.learnKind : null;
    return c;
  } catch {
    return null;
  }
}

// 書けたら true・保存先が無い／投げる端末では false（遊びは続ける）。key＝記録①〜③の置き場（既定は①）
export function saveCareer(storage, career, key = KEY) {
  if (!storage) return false;
  try {
    storage.setItem(key, serialize(career));
    return true;
  } catch {
    return false;
  }
}

export function loadCareer(storage, key = KEY) {
  try { return deserialize(storage?.getItem(key) ?? ''); } catch { return null; }
}
