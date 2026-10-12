// 敵100体＝変わり種20体×5段階（設計書 §8・10/12 夜 本人「敵キャラは100体」→ 20体×5段階）
// 名前は i18n の foe.<id>・段階は foe.stage.<0〜4>（壱号〜伍号）。type＝第1段の取組で使うタイプ（絵が届くまでの仮の姿もこのタイプの絵）
export const FOE_IDS = [
  'robot', 'ninja', 'alien', 'itamae', 'daiku', 'shobo', 'yubin', 'samurai', 'astronaut', 'wizard',
  'dino', 'snowman', 'manekineko', 'vending', 'shogi', 'fisher', 'farmer', 'prowrestler', 'kappa', 'pirate',
];
export const FOES = {
  robot: { type: 'heavy' }, ninja: { type: 'small' }, alien: { type: 'tall' }, itamae: { type: 'balance' },
  daiku: { type: 'yotsu' }, shobo: { type: 'heavy' }, yubin: { type: 'small' }, samurai: { type: 'balance' },
  astronaut: { type: 'tall' }, wizard: { type: 'small' }, dino: { type: 'heavy' }, snowman: { type: 'yotsu' },
  manekineko: { type: 'heavy' }, vending: { type: 'yotsu' }, shogi: { type: 'balance' }, fisher: { type: 'yotsu' },
  farmer: { type: 'balance' }, prowrestler: { type: 'heavy' }, kappa: { type: 'small' }, pirate: { type: 'tall' },
};
export const STAGE_COUNT = 5;
export const FOE_COUNT = FOE_IDS.length * STAGE_COUNT; // 100

// index 番目（0から）の敵：20体ごとに段階が1つ上がる
export function foeAt(index) {
  const id = FOE_IDS[index % FOE_IDS.length];
  return { index, id, stage: Math.floor(index / FOE_IDS.length), type: FOES[id].type };
}
