// フィギュア風の立ち絵の選び方（10/12 夜 設計書 §8・§10／50体版 2026-10-16 Ruling R9・R10）：主人公・敵の絵の鍵と置き場・段階の見せ方・取組での敵の傾け方
// 絵は tools/prep_figures.py（本物）と tools/prep_placeholders.py（新しい30人の仮の姿）が assets/figures/ に置く
import { PLAY_COUNT } from './ladder.js?v=56';

// 1〜20体目（段 0・1）＝ふだんの姿／21〜49体目（段 2〜4）＝本気の姿／50体目（PLAY_COUNT - 1）＝大ボスの姿
export function foeForm(foe) {
  if (foe.index === PLAY_COUNT - 1) return 'boss';
  return foe.stage >= 2 ? 'honki' : 'normal';
}

const foeFile = (foe) => `foe_${foe.id}_${foeForm(foe)}`;

// 画面用（相手の情報）と取組用（ドット）の絵の鍵と置き場
export function foeArt(foe) {
  const f = foeFile(foe);
  return { file: f, key: `fig-${f}`, path: `assets/figures/${f}.png`, dotKey: `dot-${f}`, dotPath: `assets/figures/dot/${f}.png` };
}

export function heroArt(type) {
  return { key: `fig-hero-${type}`, path: `assets/figures/hero_${type}.png` };
}

// 段階ごとの光るオーラ（無し→青→赤→金→虹）と体の大きさ（最大1.15倍）
export const STAGE_AURA = [null, 0x4da3ff, 0xff4d4d, 0xffc83d, 'rainbow'];
export const stageAura = (stage) => STAGE_AURA[Math.max(0, Math.min(STAGE_AURA.length - 1, stage))];
// 敵の光：大ボスは虹・ほかは段階の光
export const foeAura = (foe) => (foeForm(foe) === 'boss' ? 'rainbow' : stageAura(foe.stage));
export const stageScale = (stage) => 1 + 0.0375 * Math.max(0, Math.min(4, stage));

// 取組の敵（正面向きのドット1枚）を、西の力士の姿勢の名に合わせて傾ける。angle＝度（−で東＝主人公のほうへ倒れる・＋で後ろへ）・sy＝縦の縮み
const FOE_POSE = {
  shikiri: { angle: -4, sy: 0.9 },
  tachiai: { angle: -12, sy: 0.95 },
  both: { angle: -6, sy: 1 },
  grip: { angle: -6, sy: 1 },
  grip2: { angle: -8, sy: 1 },
  push: { angle: -10, sy: 1 },
  brace: { angle: -3, sy: 0.96 },
  throw: { angle: -18, sy: 1 },
  tsR: { angle: -8, sy: 1 },
  tsL: { angle: -4, sy: 1 },
  hit: { angle: 6, sy: 1 },
  recoil: { angle: 10, sy: 1 },
  stagger: { angle: 16, sy: 1 },
  back: { angle: 22, sy: 1 },
  rise: { angle: 0, sy: 1 },
  fall: { angle: 75, sy: 1 },
  topple: { angle: 85, sy: 1 },
};
export function foePose(pose) {
  return Object.prototype.hasOwnProperty.call(FOE_POSE, pose) ? FOE_POSE[pose] : { angle: 0, sy: 1 };
}

// 取組の敵の姿勢の絵（横向き・左向き・10/12 夜 本人「敵も、主人公と同様、手や足に動きが欲しい」）
// 絵は届いた物だけ（assets/figures/dot/poses.json）。push＝押す構え・shikiri＝仕切り・sori＝反って踏ん張る・fall＝倒れる
export const foePoseArt = (file, img) => ({ key: `dotp-${file}-${img}`, path: `assets/figures/dot/${file}/${img}.png` });
// 西の力士の姿勢の名 → [使う絵, 傾け（度）, 縦の縮み]
const FRAME = {
  shikiri: ['shikiri', 0, 1], tachiai: ['push', -10, 1], both: ['push', -4, 1], grip: ['push', -4, 1], grip2: ['push', -6, 1],
  push: ['push', -6, 1], brace: ['push', 0, 0.97], throw: ['push', -14, 1], tsR: ['push', -6, 1], tsL: ['push', -2, 1],
  hit: ['sori', 0, 1], recoil: ['sori', 0, 1], stagger: ['sori', 4, 1], back: ['sori', 8, 1], rise: ['push', 0, 1],
  fall: ['fall', 0, 1], topple: ['fall', 8, 1],
};
// 欲しい絵が無い時に「押す構え」を傾けて代える角度と縮み
const FALLBACK = { shikiri: [-4, 0.9], hit: [6, 1], recoil: [10, 1], stagger: [16, 1], back: [22, 1], fall: [75, 1], topple: [85, 1] };
// have＝届いている姿勢の絵の名。押す構えも無ければ null（正面のドットを foePose で傾ける）
export function foeFrame(pose, have) {
  const f = Object.prototype.hasOwnProperty.call(FRAME, pose) ? FRAME[pose] : ['push', 0, 1];
  if (have.includes(f[0])) return { img: f[0], angle: f[1], sy: f[2] };
  if (!have.includes('push')) return null;
  const fb = Object.prototype.hasOwnProperty.call(FALLBACK, pose) ? FALLBACK[pose] : [f[1], f[2]];
  return { img: 'push', angle: fb[0], sy: fb[1] };
}

// 紙相撲の型紙（白いふち・足もとの折り返し＝tools/prep_kami.py が作る）
export const kamiArt = (file) => ({ key: `kami-${file}`, path: `assets/figures/kami/${file}.png` });
