// src/state.js — 場面をまたぐ選び。strategy は自分の作戦表（null なら見本から組む）
export const session = {
  you: 'heavy',
  opp: 'tall',
  strategy: null,
  oppStrategy: null,
  planFor: null, // 作戦表を組んだときの { you, opp }。タイプが変わった側だけ見本から組み直す
  speed: 'normal',
  seed: Date.now() % 100000,
};
