// 力士を作る・得意と弱みの上乗せ（取組の計算から使う）
import { TYPES } from '../data/types.js?v=34';
import { STRONG_BONUS, WEAK_MAX } from './tuning.js?v=34';

export function makeWrestler(type, { shin, gi, tai, known, mastery = {} } = {}) {
  const T = TYPES[type];
  if (!T) throw new Error(`unknown type: ${type}`);
  return {
    type,
    shin: shin ?? T.base.shin,
    gi: gi ?? T.base.gi,
    tai: tai ?? T.base.tai,
    known: known ?? [...T.sample],
    mastery,
  };
}

export function strongBonus(wrestler, arch) {
  return TYPES[wrestler.type].strong.includes(arch) ? STRONG_BONUS : 0;
}

// 受ける側の弱み。by の値の平均が上がるほど減り、100で0
export function weakBonus(defender, arch, grip) {
  const wk = TYPES[defender.type].weak;
  if (!wk || !wk.arch.includes(arch)) return 0;
  if (wk.when && wk.when !== grip) return 0;
  const avg = wk.by.reduce((s, k) => s + defender[k], 0) / wk.by.length;
  return WEAK_MAX * Math.max(0, 1 - avg / 100);
}
