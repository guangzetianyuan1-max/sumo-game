// src/core/cutin.js — 主人公のカットインの6表情（tools/prep_cutin.py で切り分けた絵）。画面から切り離した名前と絵の場所
// 出す所：立ち合いで光ってすぐ＝kiai・決め技＝kime・勝ち＝yorokobi・負け＝kuyashii（niyari・funbari は今は使わない）
import { HERO_TYPE } from '../data/heroes.js?v=56';

export const CUTIN = ['kiai', 'niyari', 'kime', 'funbari', 'yorokobi', 'kuyashii'];
export const KIAI_WINDOW = 0.15; // 立ち合いの合図からこの秒数のうちにたたくと「気合」

export const cutinArt = (name) => ({ key: `cutin-${HERO_TYPE}-${name}`, path: `assets/figures/cutin/${HERO_TYPE}_${name}.png` });

// ---- 取組の必殺技のカットイン（v42 第2段・本人 ③⑥⑦⑧ と 10/15「目の帯で」）----
// 目の帯＝怒り顔の目のあたり（tools/prep_eyes.py・720×200）：相手20体は foe の id・主人公は hero・守り成功は hero_funbari（踏ん張りの目・額の汗まで）
// v45（10/16 本人「必殺技のカットインは目のみ。マンガイラストは無し。でか過ぎました」「外してください。踏ん張る目があれば入れてください」）：
//   漫画の絵（主人公の決め技5つ・守り成功）は全部外した。主人公の必殺技＝目の帯だけ・守り成功＝踏ん張りの目の帯
export const EYE_HERO = 'hero';
export const EYE_FUNBARI = 'hero_funbari';
export const eyeArt = (id) => ({ key: `eyes-${id}`, path: `assets/figures/eyes/${id}.jpg` });
// 見せる長さ（ms）：主人公の必殺技＝目の帯 heroEye（この間は取組の時計を止める・漫画が無くなったので 0.5→0.7秒＝技の名前が読める）・
// 相手の必殺技の予告＝目の帯 foeEye（時計を止める）・守り成功＝踏ん張りの目の帯 funbari（時計は止めない・入力を取らない）。守り成功が funbariGap 以内に続いたら2回目は出さない
export const EYE_MS = { heroEye: 700, foeEye: 900, funbari: 700, funbariGap: 4000 };
// 守り成功の目の帯を出すか（前に出した時刻 lastAt・今 now・どちらも ms）
export const funbariDue = (lastAt, now) => !(now - lastAt < EYE_MS.funbariGap);

// ---- たたいた時にカットインを閉じるか（v44・バグ探し M1「連打で漫画が見えない」）----
// kind＝今出ている帯（band・heroEye・foeEye）・via＝どこをたたいたか（left＝連打のボタン・right＝右のボタン・band＝帯そのもの・outside＝それ以外）
// 主人公の目の帯と、相手の目の帯（＝時計を止める帯）は、連打のボタンやほかの所では閉じない（時計は止まっているので待っても損は無い）。
// 閉じるのは時間切れ（呼ぶ側の時計）と、帯そのものをたたいた時。相手の目の帯だけは右のボタンで閉じて守りを始められる（v42 最終点検 M1）。
// 字だけの帯（band）は今まで通り、どこをたたいても閉じる
export const HOLD_CUTINS = ['heroEye', 'foeEye'];
export function cutinCloses(kind, via) {
  if (via === 'band') return true;
  if (HOLD_CUTINS.indexOf(kind) < 0) return true;
  return kind === 'foeEye' && via === 'right';
}

// ---- 主人公の必殺技の目の帯の間（0.7秒）は、下の案内を消し、ボタンを2つとも落ち着いた見た目にする（v44 点検の小さい物3）----
// この間は連打も一押しも効かない（時計が止まっている）ので、「連打！」の案内や光るボタンは見せない。相手の目の帯は右で守れるので対象外
export const NEUTRAL_CUTINS = ['heroEye'];
export const cutinNeutral = (kind) => NEUTRAL_CUTINS.indexOf(kind) >= 0;
