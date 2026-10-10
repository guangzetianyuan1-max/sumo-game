// src/state.js — 場面をまたぐ選び。strategy は自分の作戦表（null なら見本から組む）
import { TYPE_IDS } from './data/types.js?v=4';

export const session = {
  you: 'heavy',
  opp: 'tall',
  strategy: null,
  oppStrategy: null,
  planFor: null, // 作戦表を組んだときの { you }。自分のタイプが変わったときだけ見本から組み直す
  speed: 'normal',
  seed: Date.now() % 100000,
};

// 次の相手を引く（5タイプから一様・自分と同じタイプもあり）。画面の層の選びなので Math.random でよい（取組の計算の乱数とは別）
export function nextOpponent(rand = Math.random) {
  session.opp = TYPE_IDS[Math.min(TYPE_IDS.length - 1, Math.floor(rand() * TYPE_IDS.length))];
  session.oppStrategy = null;
  return session.opp;
}
