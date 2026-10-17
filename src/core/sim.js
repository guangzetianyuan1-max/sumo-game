// 数千番回して勝率を出す（強さ合わせの試験と tools/tune.mjs から使う）。東西を交互に入れ替えて、東の有利を消す。
import { runBout } from './bout.js?v=54';
import { makeWrestler } from './wrestler.js?v=54';
import { defaultStrategy } from './strategy.js?v=54';
import { TYPE_IDS } from '../data/types.js?v=54';
import { TURN_LIMIT } from './tuning.js?v=54';

export function winRate(typeA, typeB, n, { a = {}, b = {} } = {}) {
  const A = makeWrestler(typeA, a);
  const B = makeWrestler(typeB, b);
  const sideA = { wrestler: A, strategy: defaultStrategy(A.known, typeA) };
  const sideB = { wrestler: B, strategy: defaultStrategy(B.known, typeB) };
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const aEast = i % 2 === 0;
    const r = aEast ? runBout(sideA, sideB, 1000 + i) : runBout(sideB, sideA, 1000 + i);
    if ((r.winner === 'east') === aEast) wins++;
  }
  return wins / n;
}

export function matrix(n) {
  const out = {};
  for (const a of TYPE_IDS) {
    out[a] = {};
    for (const b of TYPE_IDS) out[a][b] = winRate(a, b, n);
  }
  return out;
}

export function kimariteCounts(n) {
  const counts = {};
  for (const a of TYPE_IDS) for (const b of TYPE_IDS) {
    const A = makeWrestler(a), B = makeWrestler(b);
    for (let i = 0; i < n; i++) {
      const r = runBout({ wrestler: A, strategy: defaultStrategy(A.known, a) }, { wrestler: B, strategy: defaultStrategy(B.known, b) }, 5000 + i);
      counts[r.kimarite] = (counts[r.kimarite] ?? 0) + 1;
    }
  }
  return Object.entries(counts).sort((x, y) => y[1] - x[1]);
}

// 1番の長さ（設計書 §2「1番はおよそ3〜8手」）。全25組×n番。limitShare＝手の数の上限まで続いた取組の割合
export function lengthStats(n) {
  const lens = [];
  for (const a of TYPE_IDS) for (const b of TYPE_IDS) {
    const A = makeWrestler(a), B = makeWrestler(b);
    for (let i = 0; i < n; i++) {
      const r = runBout({ wrestler: A, strategy: defaultStrategy(A.known, a) }, { wrestler: B, strategy: defaultStrategy(B.known, b) }, 9000 + i);
      lens.push(r.log.length);
    }
  }
  lens.sort((x, y) => x - y);
  return { median: lens[Math.floor(lens.length / 2)], limitShare: lens.filter((l) => l >= TURN_LIMIT).length / lens.length };
}
