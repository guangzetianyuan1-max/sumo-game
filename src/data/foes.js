// 敵50体（設計書 2026-10-16-sumo-50-foes-design.md §2）：1・5・10…45体目＝ふつうの力士10人（5体目からは昇進がかかる関門）・
// 50体目＝新しい大ボス「鬼の大横綱」・残り39体＝変わり種（今の20体＋新しい19体・見かけの弱そうな順から強そうな順へ）
// 名前は i18n の foe.<id>（力士はしこ名）。type＝取組のタイプ。kind＝rikishi（力士）| variety（変わり種）| boss（大ボス）
// stage＝10体ごとの段（0〜4）：光と大きさ・演出の段・ふだん／本気（Ruling R9）
export const FOE_IDS = [
  'kaedesato', 'pan', 'yubin', 'ekiin', 'hagikawa', 'itamae', 'niwashi', 'daiku', 'farmer', 'tsubakinami',
  'fisher', 'akabeko', 'okiagari', 'kokeshi', 'kashitani', 'shogi', 'tanuki', 'vending', 'daruma', 'aone',
  'snowman', 'manekineko', 'haniwa', 'ninja', 'benishima', 'samurai', 'shobo', 'kuma', 'astronaut', 'geniwa',
  'alien', 'inoshishi', 'wizard', 'onigawara', 'washiumi', 'robot', 'dino', 'kappa', 'tengu', 'torakaze',
  'prowrestler', 'umibozu', 'odako', 'pirate', 'raine', 'yukiotoko', 'kaminari', 'fujin', 'ryujin', 'oni',
];
const R = 'rikishi', V = 'variety';
export const FOES = {
  kaedesato: { type: 'balance', kind: R }, pan: { type: 'yotsu', kind: V }, yubin: { type: 'small', kind: V },
  ekiin: { type: 'small', kind: V }, hagikawa: { type: 'small', kind: R }, itamae: { type: 'balance', kind: V },
  niwashi: { type: 'tall', kind: V }, daiku: { type: 'yotsu', kind: V }, farmer: { type: 'balance', kind: V },
  tsubakinami: { type: 'yotsu', kind: R }, fisher: { type: 'yotsu', kind: V }, akabeko: { type: 'heavy', kind: V },
  okiagari: { type: 'balance', kind: V }, kokeshi: { type: 'tall', kind: V }, kashitani: { type: 'heavy', kind: R },
  shogi: { type: 'balance', kind: V }, tanuki: { type: 'heavy', kind: V }, vending: { type: 'yotsu', kind: V },
  daruma: { type: 'balance', kind: V }, aone: { type: 'tall', kind: R }, snowman: { type: 'yotsu', kind: V },
  manekineko: { type: 'heavy', kind: V }, haniwa: { type: 'tall', kind: V }, ninja: { type: 'small', kind: V },
  benishima: { type: 'small', kind: R }, samurai: { type: 'balance', kind: V }, shobo: { type: 'heavy', kind: V },
  kuma: { type: 'yotsu', kind: V }, astronaut: { type: 'tall', kind: V }, geniwa: { type: 'heavy', kind: R },
  alien: { type: 'tall', kind: V }, inoshishi: { type: 'heavy', kind: V }, wizard: { type: 'small', kind: V },
  onigawara: { type: 'balance', kind: V }, washiumi: { type: 'tall', kind: R }, robot: { type: 'heavy', kind: V },
  dino: { type: 'heavy', kind: V }, kappa: { type: 'small', kind: V }, tengu: { type: 'tall', kind: V },
  torakaze: { type: 'yotsu', kind: R }, prowrestler: { type: 'heavy', kind: V }, umibozu: { type: 'yotsu', kind: V },
  odako: { type: 'small', kind: V }, pirate: { type: 'tall', kind: V }, raine: { type: 'heavy', kind: R },
  yukiotoko: { type: 'yotsu', kind: V }, kaminari: { type: 'small', kind: V }, fujin: { type: 'tall', kind: V },
  ryujin: { type: 'tall', kind: V }, oni: { type: 'heavy', kind: 'boss' },
};
export const FOE_COUNT = FOE_IDS.length; // 50
export const STAGE_SIZE = 10;
export const STAGE_COUNT = 5;
export const BOSS_ID = 'oni';
// 昇進がかかる関門の力士の番号（1体目の力士は関門でない）
export const GATE_INDEXES = FOE_IDS.map((id, i) => (FOES[id].kind === R && i > 0 ? i : -1)).filter((i) => i >= 0);

// index 番目（0から）の敵。範囲の外は端の敵（呼ぶ側は 0〜49 だけを渡す・壊れた値で止まらない・index も寄せた番号＝preflight L2）
export function foeAt(index) {
  const n = Math.floor(Number(index));
  const i = Number.isFinite(n) ? Math.max(0, Math.min(FOE_COUNT - 1, n)) : 0;
  const id = FOE_IDS[i];
  return { index: i, id, stage: Math.floor(i / STAGE_SIZE), type: FOES[id].type, kind: FOES[id].kind };
}
