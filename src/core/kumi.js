// 組み絵のカットイン（10/13 本人「各対戦相手との組んでいるイラストも複数欲しい。組んで踏ん張る、投げそう、投げられそう」）
// 立ち合いの後に fumbari・決まる直前に 勝ち＝nage／負け＝nagerare。絵は assets/figures/kumi/<id>_<場面>.jpg（届いた物だけ＝index.json）
// 本気の段階も同じ絵（ふだんの姿の組み絵）に段階の光を重ねる
import { stageAura } from './foeart.js?v=54';

export const KUMI_SCENES = ['fumbari', 'nage', 'nagerare'];

export function kumiName(foe, scene) {
  return `${foe.id}_${scene}`;
}

export function kumiPlan(foe, heroWon, have) {
  const pick = (scene) => {
    const name = kumiName(foe, scene);
    return have.indexOf(name) >= 0 ? name : null;
  };
  return { grip: pick('fumbari'), finish: pick(heroWon ? 'nage' : 'nagerare'), aura: stageAura(foe.stage) };
}
