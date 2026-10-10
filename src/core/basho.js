// 場所：相手と取組の順・結果の記録・締め（優勝・番付・経験）。乱数は career.seed と場所の番号から
import { LADDER_SIZE } from '../data/ranks.js?v=10';
import { TYPES, TYPE_IDS } from '../data/types.js?v=10';
import { divisionOf, nextPos } from './banzuke.js?v=10';
import { makeShikona } from './shikona.js?v=10';
import { addExperience, train } from './career.js?v=10';
import { makeRng } from './rng.js?v=10';
import { makeWrestler } from './wrestler.js?v=10';
import { defaultStrategy } from './strategy.js?v=10';
import { recommendStrategy } from './recommend.js?v=10';
import { runBout } from './bout.js?v=10';

export const BASHO_MONTHS = [1, 3, 5, 7, 9, 11];
export const BASHO_PLACES = ['tokyo', 'osaka', 'tokyo', 'nagoya', 'tokyo', 'fukuoka'];
const r1 = (v) => Math.round(v * 10) / 10;

export function oppStatsForPos(type, pos) {
  const b = TYPES[type].base;
  const total = 150 + 150 * Math.pow(1 - pos / (LADDER_SIZE - 1), 1.3);
  const k = total / (b.shin + b.gi + b.tai);
  return { shin: Math.min(100, r1(b.shin * k)), gi: Math.min(100, r1(b.gi * k)), tai: Math.min(100, r1(b.tai * k)) };
}

export function startBasho(career) {
  const rng = makeRng(career.seed * 1000 + career.bashoIndex + 1);
  const bouts = divisionOf(career.pos).bouts;
  const days = bouts === 7 ? [1, 3, 5, 7, 9, 11, 13] : Array.from({ length: 15 }, (_, i) => i + 1);
  const taken = new Set([career.name.ja]);
  const seats = new Set([career.pos]); // 1つの席に1人（自分の席も除く）。±20の中に席は20以上あるので必ず見つかる
  const opponents = days.map(() => {
    let pos;
    do { pos = Math.max(0, Math.min(LADDER_SIZE - 1, career.pos + Math.round((rng() * 2 - 1) * 20))); } while (seats.has(pos));
    seats.add(pos);
    const type = TYPE_IDS[Math.floor(rng() * TYPE_IDS.length)];
    return { name: makeShikona(rng, taken), type, pos, stats: oppStatsForPos(type, pos) };
  });
  const m = career.bashoIndex % 6;
  return { ...career, basho: { month: BASHO_MONTHS[m], place: BASHO_PLACES[m], days, opponents, results: days.map(() => null), kimarite: days.map(() => null), day: 0 } };
}

export function currentOpponent(career) {
  const b = career.basho;
  return b && b.day < b.days.length ? b.opponents[b.day] : null;
}

export function recordBout(career, won, kimarite) {
  const b = career.basho;
  const results = [...b.results];
  const kim = [...b.kimarite];
  results[b.day] = won ? 'win' : 'loss';
  kim[b.day] = kimarite;
  return { ...career, basho: { ...b, results, kimarite: kim, day: b.day + 1 } };
}

export function finishBasho(career, rng) {
  const b = career.basho;
  const wins = b.results.filter((r) => r === 'win').length;
  const losses = b.results.length - wins;
  let yusho = false;
  if (b.days.length === 15) {
    const best = 11 + Math.floor(rng() * 4);
    yusho = wins > best || (wins === best && rng() < 0.5);
  }
  const fromPos = career.pos;
  const toPos = nextPos(fromPos, wins, losses, career.history, yusho);
  let next = addExperience(career, wins);
  next = {
    ...next,
    pos: toPos,
    history: [...career.history, { pos: fromPos, wins, losses, yusho }],
    bashoIndex: career.bashoIndex + 1,
    trainingLeft: 6,
    basho: null,
  };
  return { career: next, summary: { wins, losses, yusho, fromPos, toPos } };
}

// 一代の試運転（試験と強さ合わせ用）：稽古は policy・取組は自動
export function autoplayCareer(seed, maxBasho, policy) {
  let c = { version: 1, guide: 'chizuru', type: 'balance', name: { ja: 'Test', en: 'Test' }, stats: { ...TYPES.balance.base }, fatigue: 0, pos: LADDER_SIZE - 1, bashoIndex: 0, history: [], trainingLeft: 6, basho: null, seed };
  let maxStat = 0;
  const rng = makeRng(seed);
  for (let n = 1; n <= maxBasho; n++) {
    while (c.trainingLeft > 0) c = train(c, policy(c));
    c = startBasho(c);
    let opp;
    while ((opp = currentOpponent(c))) {
      const me = makeWrestler(c.type, c.stats);
      const them = makeWrestler(opp.type, opp.stats);
      const r = runBout({ wrestler: me, strategy: recommendStrategy(me.known, c.type, opp.type) }, { wrestler: them, strategy: defaultStrategy(them.known, opp.type) }, Math.floor(rng() * 1e9));
      c = recordBout(c, r.winner === 'east', r.kimarite);
    }
    c = finishBasho(c, rng).career;
    maxStat = Math.max(maxStat, c.stats.shin, c.stats.gi, c.stats.tai);
    if (divisionOf(c.pos).bouts === 15) return { reachedJuryoAt: n, maxStat }; // 十両から上
  }
  return { reachedJuryoAt: null, maxStat };
}
