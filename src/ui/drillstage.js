// src/ui/drillstage.js — 稽古の舞台の置き場所と、相手の見せ方の計算（10/15 ボタン2つに戻す Task 2）。Phaser を使わない（node で試験する）
// 主人公は3つの遊びとも右向き（FACE = +1：型紙は右向きなのでそのまま・突く向き・傾ける向きは FACE で決める）。
//   一押し：主人公は真ん中より少し左（右へ突く）
//   連打：主人公は左・鉄砲柱は右・回数は柱のさらに右（主人公にも柱にも重ならない）
//   長押し：主人公は左・相手は右（左向き・今の次の相手の型紙）。左端のバー（HUD.bar）にかからない
// ボタン2つは本番（KamiScene）と同じ場所と大きさ：左（連打）・右（一押しと長押し）
import { currentFoe } from '../core/run.js?v=39';
import { foeAt } from '../data/foes.js?v=39';

export const FACE = 1;
export const FIG_H = 330; // 型紙の高さ（取組と同じ）
export const FEET_Y = 800; // 型紙の足もと（稽古場の床の上）
export const HERO_W = Math.round((FIG_H * 265) / 432); // 主人公の型紙の幅（265x432）＝約 202
export const HERO_X = { ippon: 340, renda: 270, nagaoshi: 270 }; // 型紙の中心 x
export const PILLAR = { x: 450, w: 64, top: -10 }; // 鉄砲柱（主人公の右）
export const COUNT = { x: 612, y: 470, w: 200 }; // 連打の回数（柱の右・w＝3桁でも収まる幅）
export const OPP = { x: 572, w: 290, dx: 18, tilt: 10, thrust: 36, push: 34 }; // 長押しの相手（w＝大ボスの幅の上限）。dx・tilt＝ゲージが満ちる間の寄りと傾き
export const BTN = { left: { x: 190, y: 1104, d: 280 }, right: { x: 530, y: 1104, d: 280 } }; // 本番（KamiScene の LEFT_BTN・RIGHT_BTN）と同じ

// 今の次の相手（無ければ 1体目）：稽古の長押しに立たせる相手
export function drillFoe(run) {
  return (run && currentFoe(run)) || foeAt(0);
}

// ゲージ gv（0〜1）が満ちる間の、相手の寄り：左（主人公のほう）へ dx 寄り、頭を主人公のほうへ傾ける（左向きの型紙は反時計回りが前）
export function oppLean(gv) {
  const v = Math.max(0, Math.min(1, gv || 0));
  return { x: OPP.x - OPP.dx * v, angle: -OPP.tilt * v };
}

// 離した時の結果：緑の帯の中（点が付く）＝こらえる（主人公は動かない）・外＝押し戻される
export const holdBlocked = (point) => point > 0;
