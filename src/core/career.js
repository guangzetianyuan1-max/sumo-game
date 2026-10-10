// 一代記の状態・稽古・疲れ・成長・場所の経験・記録（設計書 §3）。どの関数も元を書き換えない
import { TYPES } from '../data/types.js?v=7';
import { LADDER_SIZE } from '../data/ranks.js?v=7';

export const TRAININGS = ['shiko', 'teppo', 'chanko', 'waza', 'butsukari', 'moushiai', 'rest'];
const GAIN = {
  shiko: { tai: 2, shin: 1 },
  teppo: { tai: 2, gi: 1 },
  chanko: { tai: 2 },
  waza: { gi: 3 },
  butsukari: { shin: 2, tai: 1 },
  moushiai: { gi: 1, shin: 1 },
  rest: {},
};
const MULT = {
  heavy: { tai: 1.5, gi: 0.5 },
  small: { gi: 1.5, tai: 0.5 },
  balance: {},
  yotsu: { shin: 1.5, gi: 0.75 },
  tall: { gi: 1.25, tai: 1.25, shin: 0.5 },
};
const KEY = 'sumo.career';
const VERSION = 1;
const r1 = (v) => Math.round(v * 10) / 10;
const cap = (v) => Math.min(100, r1(v));

export const growthMult = (type, stat) => MULT[type]?.[stat] ?? 1;

export function newCareer({ guide, type, name, seed }) {
  const b = TYPES[type].base;
  return {
    version: VERSION, guide, type, name,
    stats: { shin: b.shin, gi: b.gi, tai: b.tai },
    fatigue: 0, pos: LADDER_SIZE - 1, bashoIndex: 0, history: [], trainingLeft: 6, basho: null, seed,
  };
}

export function train(career, kind) {
  if (career.trainingLeft <= 0) return career;
  if (!Object.hasOwn(GAIN, kind)) return career;
  if (kind === 'rest') {
    return { ...career, fatigue: Math.max(0, career.fatigue - 2), trainingLeft: career.trainingLeft - 1 };
  }
  const stats = { ...career.stats };
  for (const [stat, g] of Object.entries(GAIN[kind])) {
    let add = g * growthMult(career.type, stat);
    if (stat === 'tai') add *= Math.max(0, 1 - 0.25 * career.fatigue);
    stats[stat] = cap(stats[stat] + add);
  }
  return { ...career, stats, fatigue: career.fatigue + 1, trainingLeft: career.trainingLeft - 1 };
}

export function addExperience(career, wins) {
  const stats = { ...career.stats };
  for (const s of ['shin', 'gi', 'tai']) stats[s] = cap(stats[s] + wins * 0.4 * growthMult(career.type, s));
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

// 場所の相手：しこ名・タイプ・席・心技体がそろっている
const validOpponent = (o) => !!o && typeof o === 'object' && validName(o.name) && Object.hasOwn(TYPES, o.type)
  && validPos(o.pos) && validStats(o.stats);

// 場所の記録：月・場所の名・4つの配列が同じ長さ・相手が全員そろう・day は 0〜日の数の整数
function validBasho(b) {
  if (!b || typeof b !== 'object') return false;
  if (!MONTHS.includes(b.month) || !nonEmpty(b.place)) return false;
  const arrs = [b.days, b.opponents, b.results, b.kimarite];
  if (!arrs.every(Array.isArray)) return false;
  const len = b.days.length;
  if (!arrs.every((a) => a.length === len)) return false;
  if (!b.opponents.every(validOpponent)) return false;
  return Number.isInteger(b.day) && b.day >= 0 && b.day <= len;
}

export function deserialize(text) {
  try {
    const c = JSON.parse(text);
    if (!c || typeof c !== 'object' || c.version !== VERSION) return null;
    if (!Object.hasOwn(TYPES, c.type)) return null;
    if (!validStats(c.stats)) return null;
    if (![c.pos, c.fatigue, c.trainingLeft, c.bashoIndex].every(Number.isFinite)) return null;
    if (!validPos(c.pos) || c.fatigue < 0 || !Number.isInteger(c.trainingLeft) || c.trainingLeft < 0 || c.trainingLeft > 6) return null;
    if (!Array.isArray(c.history) || !c.history.every(validHistory)) return null;
    if (!validName(c.name)) return null;
    if (c.basho !== null && !validBasho(c.basho)) return null;
    return c;
  } catch {
    return null;
  }
}

export function saveCareer(storage, career) {
  try { storage?.setItem(KEY, serialize(career)); } catch { /* 保存できない端末でも遊びは続ける */ }
}

export function loadCareer(storage) {
  try { return deserialize(storage?.getItem(KEY) ?? ''); } catch { return null; }
}
