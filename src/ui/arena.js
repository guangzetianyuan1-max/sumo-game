// src/ui/arena.js — 紙相撲の舞台（土俵の絵の背景・段ボールの箱・紙の土俵）。取組（kami）・懸賞旗（kensho）・クリア（clear）で同じ形を描く
import { KAMI } from '../core/kami.js?v=59';
import { t } from '../i18n/i18n.js?v=59';
import { textStyle, fitText } from './widgets.js?v=59';
import { boutBgKey, bgPath, pickBackdrop, DOHYO_BG } from '../core/bgkey.js?v=59';
import { edgeFade } from './backdrop.js?v=59';

export const GROUND = 800; // 箱の上の面（画面の y）
export const BOX_H = 100; // 箱の前の面の高さ（下の端 900 ＝ 立体のボタンの弧の上端 947 より上・間に案内の1行。ボタンが直径300になったので140から詰めた）

// 背景は20体とも土俵（国技館・v42 第2段）。foeIndex は呼ぶ側を変えずに受ける（bgkey.boutBgKey が鍵を決める）。読み込みに失敗しても止まらない
export function preloadArena(scene, foeIndex) {
  new Set([DOHYO_BG, boutBgKey(foeIndex)]).forEach((key) => { // 同じ鍵は1回だけ読む（2回読むと Phaser が「鍵が使われている」と言う）
    if (!scene.textures.exists(key)) scene.load.image(key, bgPath(key));
  });
}

// 一番後ろ：土俵のイラストを、画面の上から箱の上の面まで。上に夜の藍を重ねて暗くし、型紙とボタンを目立たせる
// 絵の上と左右の端は藍へ溶かし、ページの余白も藍（v42 第2段：端の段差を消す・backdrop.edgeFade）。箱より下は藍の地のまま
export function drawBackdrop(scene, width, foeIndex) {
  const key = pickBackdrop(foeIndex == null ? null : boutBgKey(foeIndex), (k) => scene.textures.exists(k));
  if (scene.textures.exists(key)) {
    const bg = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(-20);
    bg.setScale(width / bg.width).setCrop(0, 0, bg.width, GROUND / (width / bg.width)); // 箱の上の面より下ははみ出さず切る
  }
  scene.add.rectangle(0, 0, width, GROUND, 0x141a2e, 0.45).setOrigin(0, 0).setDepth(-19);
  edgeFade(scene, { bottom: GROUND, depth: -19 });
}

// 箱（段ボール）の前の面と上の面・紙の土俵・俵・仕切り線・箱の前の字（試作 prototype/kamizumo.html と同じ形）
// 描いた物 { g, label } を返す（取組の画面は連打のたびに箱ごと沈めて戻す・10/15 手ごたえ）
export function drawBox(scene, width) {
  const { BOX, RING } = KAMI;
  const g = scene.add.graphics();
  g.fillStyle(0x8a6a3c, 1).fillRect(BOX.l, GROUND, BOX.r - BOX.l, BOX_H);
  g.fillStyle(0xb08a52, 1).fillRect(BOX.l - 10, GROUND - 8, BOX.r - BOX.l + 20, 16);
  g.fillStyle(0xe8d6a6, 1).fillRect(RING.l - 30, GROUND - 6, RING.r - RING.l + 60, 8);
  g.fillStyle(0x6d4a1f, 1).fillRect(RING.l - 8, GROUND - 14, 16, 12).fillRect(RING.r - 8, GROUND - 14, 16, 12);
  g.fillStyle(0xffffff, 0.9).fillRect(width / 2 - 40, GROUND - 4, 6, 4).fillRect(width / 2 + 34, GROUND - 4, 6, 4);
  const box = scene.add.text(width / 2, GROUND + BOX_H / 2, t('kami.box'), textStyle(56, '#3b2810')).setOrigin(0.5).setAlpha(0.6);
  fitText(box, BOX.r - BOX.l - 60);
  return { g, label: box };
}

export function drawArena(scene, foeIndex) {
  const { width } = scene.scale;
  drawBackdrop(scene, width, foeIndex);
  return drawBox(scene, width);
}
