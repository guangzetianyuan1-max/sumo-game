// src/ui/arena.js — 紙相撲の舞台（土俵の絵の背景・段ボールの箱・紙の土俵）。取組（kami）・懸賞旗（kensho）・クリア（clear）で同じ形を描く
import { KAMI } from '../core/kami.js?v=38';
import { t } from '../i18n/i18n.js?v=38';
import { textStyle, fitText } from './widgets.js?v=38';
import { boutBgKey, boutBgPath, pickBackdrop, backdropEdge, DOHYO_BG } from '../core/bgkey.js?v=38';

export const GROUND = 800; // 箱の上の面（画面の y）
export const BOX_H = 100; // 箱の前の面の高さ（下の端 900 ＝ 立体のボタンの弧の上端 947 より上・間に案内の1行。ボタンが直径300になったので140から詰めた）

// foeIndex を渡すと本番の背景（5体ごと）も読む。読み込みに失敗しても止まらない（Phaser は他の絵を読み続け、無い鍵は drawBackdrop が土俵の背景に替える）
export function preloadArena(scene, foeIndex) {
  if (!scene.textures.exists(DOHYO_BG)) scene.load.image(DOHYO_BG, 'assets/bg/dohyo.jpg');
  if (foeIndex != null) {
    const key = boutBgKey(foeIndex);
    if (!scene.textures.exists(key)) scene.load.image(key, boutBgPath(key));
  }
}

// 一番後ろ：土俵のイラストを、画面の上から箱の上の面まで。上に夜の藍を重ねて暗くし、型紙とボタンを目立たせる
export function drawBackdrop(scene, width, foeIndex) {
  const key = pickBackdrop(foeIndex == null ? null : boutBgKey(foeIndex), (k) => scene.textures.exists(k));
  if (scene.textures.exists(key)) {
    const bg = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(-20);
    bg.setScale(width / bg.width).setCrop(0, 0, bg.width, GROUND / (width / bg.width)); // 箱の上の面より下ははみ出さず切る
  }
  scene.add.rectangle(0, 0, width, GROUND, 0x141a2e, 0.45).setOrigin(0, 0).setDepth(-19);
  // 縦長の画面の上下（と横長の画面の左右）の余白を、今の背景の絵の一番上の色（暗くした後・bgkey の backdropEdge）にそろえる。出る時は元に戻す
  // 上半分は絵の一番上の色・下半分は今の藍（絵は上から始まり、下は箱の下の藍へ続く）
  if (typeof document !== 'undefined') {
    const els = [document.documentElement, document.body].filter(Boolean);
    const old = els.map((el) => el.style.background);
    const edge = backdropEdge(key);
    els.forEach((el) => { el.style.background = edge; });
    scene.events.once('shutdown', () => els.forEach((el, i) => { el.style.background = old[i]; }));
  }
}

// 箱（段ボール）の前の面と上の面・紙の土俵・俵・仕切り線・箱の前の字（試作 prototype/kamizumo.html と同じ形）
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
}

export function drawArena(scene, foeIndex) {
  const { width } = scene.scale;
  drawBackdrop(scene, width, foeIndex);
  drawBox(scene, width);
}
