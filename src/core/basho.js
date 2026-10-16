// 場所：相手と取組の順・結果の記録・締め（優勝・番付・経験）。乱数は career.seed と場所の番号から
import { LADDER_SIZE, DIVISIONS } from '../data/ranks.js?v=48';
import { TYPES, TYPE_IDS } from '../data/types.js?v=48';
import { divisionOf, nextPos } from './banzuke.js?v=48';
import { makeShikona } from './shikona.js?v=48';
import { winGrowth, boutStats, newCareer } from './career.js?v=48';
import { milestone, learnChoices, learnMove } from './learn.js?v=48';
import { makeRng } from './rng.js?v=48';
import { makeWrestler } from './wrestler.js?v=48';
import { defaultStrategy } from './strategy.js?v=48';
import { recommendStrategy } from './recommend.js?v=48';
import { runBout } from './bout.js?v=48';
import { OPP_TOTAL } from './tuning.js?v=48';
import { bashoAwards, promotionNote } from './honors.js?v=48';

export const BASHO_MONTHS = [1, 3, 5, 7, 9, 11];
export const BASHO_PLACES = ['tokyo', 'osaka', 'tokyo', 'nagoya', 'tokyo', 'fukuoka'];
const r1 = (v) => Math.round(v * 10) / 10;

// 席の相手の心技体の和（OPP_TOTAL.anchors の折れ線）
export function oppTotalForPos(pos) {
  const a = OPP_TOTAL.anchors;
  if (pos <= a[0][0]) return a[0][1];
  for (let i = 1; i < a.length; i++) {
    const [p1, t1] = a[i];
    if (pos <= p1) {
      const [p0, t0] = a[i - 1];
      return t0 + (t1 - t0) * (pos - p0) / (p1 - p0);
    }
  }
  return a[a.length - 1][1];
}

export function oppStatsForPos(type, pos) {
  const b = TYPES[type].base;
  const total = oppTotalForPos(pos); // タイプの形はそのまま・各値は100まで
  const k = total / (b.shin + b.gi + b.tai);
  return { shin: Math.min(100, r1(b.shin * k)), gi: Math.min(100, r1(b.gi * k)), tai: Math.min(100, r1(b.tai * k)) };
}

const clampPos = (p) => Math.max(0, Math.min(LADDER_SIZE - 1, p));

// 1人の相手：席は from〜to の中の空いた席（自分の席と、この場所で使った席は除く）・タイプ・しこ名（重ならない）
function drawOpponent(rng, from, to, seats, taken) {
  let pos;
  do { pos = from + Math.floor(rng() * (to - from + 1)); } while (seats.has(pos));
  seats.add(pos);
  const type = TYPE_IDS[Math.floor(rng() * TYPE_IDS.length)];
  return { name: makeShikona(rng, taken), type, pos, stats: oppStatsForPos(type, pos) };
}

// 場所の相手（10/11 本物の組み方）：十両から上（15番）は始めに全部・±20。
// 幕下以下（7番）は1番目だけ同じ段の±4席（同じ地位どうし）で、2番目からは前の日の取組の後に決める（null＝未定）
export function startBasho(career) {
  const rng = makeRng(career.seed * 1000 + career.bashoIndex + 1);
  const here = divisionOf(career.pos);
  const seven = here.bouts === 7;
  const days = seven ? [1, 3, 5, 7, 9, 11, 13] : Array.from({ length: 15 }, (_, i) => i + 1);
  const taken = new Set([career.name.ja]);
  const seats = new Set([career.pos]); // 1つの席に1人（自分の席も除く）
  let opponents;
  if (seven) {
    const lo = Math.max(here.firstPos, career.pos - 4);
    const hi = Math.min(here.firstPos + DIVISIONS[here.index].slots - 1, career.pos + 4);
    opponents = days.map((d, i) => (i === 0 ? drawOpponent(rng, lo, hi, seats, taken) : null));
  } else {
    // ±20の中に席は20以上あるので必ず見つかる
    opponents = days.map(() => drawOpponent(rng, clampPos(career.pos - 20), clampPos(career.pos + 20), seats, taken));
  }
  const m = career.bashoIndex % 6;
  // startStats＝場所の始めの心技体（10/12 取組ごとに伸びるので、結果の画面の「この場所の伸び」はここから測る）
  const basho = { month: BASHO_MONTHS[m], place: BASHO_PLACES[m], days, opponents, results: days.map(() => null), kimarite: days.map(() => null), day: 0, startStats: { ...career.stats } };
  return { ...career, basho };
}

// 今日の相手が未定（幕下以下の2番目から）なら決めた一代記を返す（決まっていれば同じ物を返す）。
// 相手＝±20の中の空いた席・自分と同じ星（record）・しこ名は重ならない。乱数は種・場所の番号・日から＝何度決めても同じ
export function decideOpponent(career) {
  const b = career.basho;
  if (!b || b.kyujo === true || b.day >= b.days.length || b.opponents[b.day]) return career;
  const rng = makeRng(((career.seed * 1000 + career.bashoIndex + 1) * 16 + b.day + 3) >>> 0);
  const done = b.opponents.filter(Boolean);
  const seats = new Set([career.pos, ...done.map((o) => o.pos)]);
  const taken = new Set([career.name.ja, ...done.map((o) => o.name.ja)]);
  const opp = drawOpponent(rng, clampPos(career.pos - 20), clampPos(career.pos + 20), seats, taken);
  const wins = b.results.filter((r) => r === 'win').length;
  opp.record = { wins, losses: b.day - wins };
  const opponents = b.opponents.map((o, i) => (i === b.day ? opp : o));
  return { ...career, basho: { ...b, opponents } };
}

export function currentOpponent(career) {
  const b = career.basho;
  if (!b || b.day >= b.days.length) return null;
  return b.opponents[b.day] || decideOpponent(career).basho.opponents[b.day];
}

// 取組を記録して日を進める。幕下以下は次の日の相手をここで決める（取組は前の日に決まる）
export function recordBout(career, won, kimarite) {
  const c = decideOpponent(career);
  const b = c.basho;
  const opp = b.opponents[b.day];
  const grown = winGrowth(c, opp ? opp.pos : c.pos, won); // 10/12 勝つたびに伸びる（1番に1回だけ）
  const results = [...b.results];
  const kim = [...b.kimarite];
  results[b.day] = won ? 'win' : 'loss';
  kim[b.day] = kimarite;
  return decideOpponent({ ...grown, basho: { ...b, results, kimarite: kim, day: b.day + 1 } });
}

export function finishBasho(career, rng) {
  const b = career.basho;
  const wins = b.results.filter((r) => r === 'win').length;
  const losses = b.results.length - wins; // 休み（absent）は負けに数える
  let yusho = false;
  if (b.days.length === 15) {
    const best = 11 + Math.floor(rng() * 4);
    yusho = wins > best || (wins === best && rng() < 0.5);
  }
  const fromPos = career.pos;
  const toPos = nextPos(fromPos, wins, losses, career.history, yusho);
  // 金星・三賞は見せるだけ（番付も心技体も動かさない）。金星は一代の数にも足す
  const { kinboshi, sansho } = bashoAwards(career);
  const promotion = promotionNote(fromPos, toPos, career.history);
  // 10/12 心技体は取組ごとに伸びる（recordBout）＝締めのまとめ足しは無い。節目（勝ち越し・十両・幕内）なら覚える候補を出す
  const learn = milestone(fromPos, toPos, wins, losses, career.history);
  const next = {
    ...career,
    pos: toPos,
    history: [...career.history, { pos: fromPos, wins, losses, yusho }],
    bashoIndex: career.bashoIndex + 1,
    basho: null,
    kinboshi: (career.kinboshi || 0) + kinboshi,
  };
  const choices = learn ? learnChoices(next, rng) : [];
  next.pendingLearn = choices.length ? choices : null;
  next.learnKind = choices.length ? learn : null; // 節目の種類も記録に（閉じて開いても技の画面の見出しが正しい）
  return { career: next, summary: { wins, losses, yusho, fromPos, toPos, kyujo: false, kinboshi, sansho, promotion, learn } };
}

// 一代の試運転（試験と強さ合わせ用）：取組は自動・覚える候補は最初の手。横綱になるか maxBasho で止める
// at＝初めてその地位（より上）に着いた場所の番号（1から）・statAt＝その時の一番高い値・maxBeforeYokozuna＝横綱になる前の一番高い値
const MILESTONES = ['juryo', 'maegashira', 'ozeki', 'yokozuna'];
const LEVEL = { juryo: 5, maegashira: 4, ozeki: 1, yokozuna: 0 }; // 番付の段の番号（0＝横綱）
const top = (s) => Math.max(s.shin, s.gi, s.tai);

export function autoplayCareer(seed, maxBasho, type = 'balance') {
  let c = newCareer({ guide: 'chizuru', type, name: { ja: 'Test', en: 'Test' }, seed });
  let maxStat = 0;
  let maxBeforeYokozuna = 0;
  const at = {};
  const statAt = {};
  const rng = makeRng(seed);
  for (let n = 1; n <= maxBasho; n++) {
    maxBeforeYokozuna = Math.max(maxBeforeYokozuna, top(c.stats));
    c = startBasho(c);
    let opp;
    while ((opp = currentOpponent(c))) {
      const me = makeWrestler(c.type, { ...boutStats(c), known: c.known }); // 覚えた手で取る（画面の取組と同じ）
      const them = makeWrestler(opp.type, opp.stats);
      const r = runBout({ wrestler: me, strategy: recommendStrategy(me.known, c.type, opp.type) }, { wrestler: them, strategy: defaultStrategy(them.known, opp.type) }, Math.floor(rng() * 1e9));
      c = recordBout(c, r.winner === 'east', r.kimarite);
    }
    c = finishBasho(c, rng).career;
    if (c.pendingLearn) c = learnMove(c, c.pendingLearn[0]);
    maxStat = Math.max(maxStat, top(c.stats));
    const level = divisionOf(c.pos).index;
    for (const m of MILESTONES) {
      if (at[m] === undefined && level <= LEVEL[m]) {
        at[m] = n;
        statAt[m] = top(c.stats);
      }
    }
    if (at.yokozuna !== undefined) break;
    maxBeforeYokozuna = Math.max(maxBeforeYokozuna, top(c.stats));
  }
  return { reachedJuryoAt: at.juryo ?? null, maxStat, at, statAt, maxBeforeYokozuna };
}
