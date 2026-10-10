// src/state.js — 場面をまたぐ選び。strategy は自分の作戦表（新しい相手ごとにお勧めで組む）
import { TYPE_IDS, TYPES } from './data/types.js?v=6b';
import { recommendStrategy } from './core/recommend.js?v=6b';

export const session = {
  you: 'heavy',
  opp: 'tall',
  strategy: null,
  oppStrategy: null,
  guide: null, // 案内役 'chizuru' | 'suzu' | 'kotone'（選ぶまで null）
  speed: 'normal',
  seed: Date.now() % 100000,
};

// 次の相手を引く（5タイプから一様・自分と同じタイプもあり）。画面の層の選びなので Math.random でよい（取組の計算の乱数とは別）
export function nextOpponent(rand = Math.random) {
  session.opp = TYPE_IDS[Math.min(TYPE_IDS.length - 1, Math.floor(rand() * TYPE_IDS.length))];
  session.oppStrategy = null;
  // 自分の作戦表は、新しい相手ごとにお勧めへ組み直す（もう一番では触らないので、手直しは持ち越される）
  session.strategy = recommendStrategy(TYPES[session.you].sample, session.you, session.opp);
  return session.opp;
}
