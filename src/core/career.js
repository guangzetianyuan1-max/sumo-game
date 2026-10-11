// 一代記の状態・稽古・疲れ・成長・場所の経験・記録（設計書 §3）。どの関数も元を書き換えない
import { TYPES } from '../data/types.js?v=24';
import { LADDER_SIZE } from '../data/ranks.js?v=24';
import { GROWTH, SPECIALTY_MULT } from './tuning.js?v=24';
import { HEYA, heyaOfGuide } from '../data/heya.js?v=24';
import { inGame } from '../data/kimarite.js?v=24';

// 古い iPhone の Safari（iOS 15.4 より前）には Object.hasOwn が無い＝札を押すと止まっていた（10/10）
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

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
const VERSION = 2; // 10/11 心技体の目盛りを作り直した（10以下から始まる）＝前の記録は読まない
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

// 疲れは10まで。10になったら次の場所は休場（10/11 本人「10まで行くとアウト場所に出れない、それまでは高い方が調子を落とす」）
export const FATIGUE_MAX = 10;
// 調子：0〜3 好調 ×1・4〜6 普通 ×0.9・7〜9 不調 ×0.7・10 休場（取組に出ない）
export function condition(fatigue) {
  if (fatigue >= FATIGUE_MAX) return { id: 'out', mult: 0 };
  if (fatigue >= 7) return { id: 'poor', mult: 0.7 };
  if (fatigue >= 4) return { id: 'normal', mult: 0.9 };
  return { id: 'good', mult: 1 };
}

// 取組で使う自分の心技体＝値×調子（相手には疲れが無い）
export function boutStats(career) {
  const m = condition(career.fatigue).mult;
  const s = career.stats;
  return { shin: r1(s.shin * m), gi: r1(s.gi * m), tai: r1(s.tai * m) };
}

export function newCareer({ guide, type, name, seed }) {
  return {
    version: VERSION, guide, type, name,
    stats: startStats(type),
    fatigue: 0, pos: LADDER_SIZE - 1, bashoIndex: 0, history: [], trainingLeft: 6, basho: null, seed, kinboshi: 0,
  };
}

export function train(career, kind) {
  if (career.trainingLeft <= 0) return career;
  if (!hasOwn(GAIN, kind)) return career;
  if (kind === 'rest') {
    return { ...career, fatigue: Math.max(0, career.fatigue - 2), trainingLeft: career.trainingLeft - 1 };
  }
  const stats = { ...career.stats };
  const heya = heyaOfGuide(career.guide);
  const special = heya !== null && HEYA[heya].specialty === kind; // 部屋の得意の稽古は伸びが1割多い（鈍りの後・100で止める前）
  for (const [stat, g] of Object.entries(GAIN[kind])) {
    let add = g * GROWTH.gain * growthMult(career.type, stat) * diminish(stats[stat]);
    if (special) add *= SPECIALTY_MULT;
    if (stat === 'tai') add *= Math.max(0, 1 - 0.25 * career.fatigue);
    stats[stat] = cap(stats[stat] + add);
  }
  return { ...career, stats, fatigue: Math.min(FATIGUE_MAX, career.fatigue + 1), trainingLeft: career.trainingLeft - 1 };
}

// 稽古の前後から、札の絵の下に出す効き目の行を作る（変わった物だけ）：
// 心・技・体の伸び（この順）→ 疲れの増減 → 調子の帯が変わった時だけ調子の行
export function trainingEffects(before, after) {
  const out = [];
  for (const key of ['shin', 'gi', 'tai']) {
    const delta = r1(after.stats[key] - before.stats[key]);
    if (delta !== 0) out.push({ key, delta });
  }
  const df = after.fatigue - before.fatigue;
  if (df !== 0) out.push({ key: 'fatigue', delta: df });
  const from = condition(before.fatigue).id;
  const to = condition(after.fatigue).id;
  if (from !== to) out.push({ key: 'condition', from, to });
  return out;
}

export function addExperience(career, wins) {
  const stats = { ...career.stats };
  for (const s of ['shin', 'gi', 'tai']) stats[s] = cap(stats[s] + wins * GROWTH.exp * growthMult(career.type, s) * diminish(stats[s]));
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

// 覚えた手（known）と作戦表（strategy）を書いた記録は、ゲームの手（IN_GAME・10/11 21手に絞った）だけ残す。
// 記録は捨てない＝その手だけ落とす。覚えた手が空になったらタイプの始めの手を入れ直す（今の記録はどちらも書かない＝何もしない）
const SCENE_KEYS = ['tachiai', 'mid', 'edge'];
function keepInGameMoves(c) {
  if (c.known !== undefined) {
    const kept = Array.isArray(c.known) ? c.known.filter(inGame) : [];
    c.known = kept.length ? kept : [...TYPES[c.type].start];
  }
  if (c.strategy !== undefined) {
    const s = c.strategy && typeof c.strategy === 'object' ? c.strategy : {};
    c.strategy = {};
    for (const sc of SCENE_KEYS) c.strategy[sc] = Array.isArray(s[sc]) ? s[sc].filter(inGame) : [];
  }
}

export function deserialize(text) {
  try {
    const c = JSON.parse(text);
    if (!c || typeof c !== 'object' || c.version !== VERSION) return null;
    if (!hasOwn(TYPES, c.type)) return null;
    if (!validStats(c.stats)) return null;
    if (![c.pos, c.fatigue, c.trainingLeft, c.bashoIndex].every(Number.isFinite)) return null;
    if (!validPos(c.pos) || c.fatigue < 0 || !Number.isInteger(c.trainingLeft) || c.trainingLeft < 0 || c.trainingLeft > 6) return null;
    if (!Array.isArray(c.history) || !c.history.every(validHistory)) return null;
    if (!validName(c.name)) return null;
    if (c.basho !== null && !validBasho(c.basho)) return null;
    // 金星の数（10/11 足した）：無い記録は0（版は2のまま）・数でなければ読まない
    if (c.kinboshi === undefined) c.kinboshi = 0;
    else if (!count(c.kinboshi)) return null;
    c.fatigue = Math.min(FATIGUE_MAX, c.fatigue); // 疲れに上が無かった頃の記録は10で止める
    keepInGameMoves(c);
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
