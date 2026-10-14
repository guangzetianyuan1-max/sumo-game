// src/scenes/CautionScene.js — ゲームの一番はじめの「注意書きの札」（10/14 本人「注意書きのサインも冒頭に付けて欲しい」）
// 起動のたびに出す。約3.5秒で表紙へ・たたけばすぐ表紙へ。音楽は鳴らさない（まだ画面に触れていないので鳴らせない・SCENE_SONG.caution = null）
// 絵は使わない：木の板の色の札（Graphics）・黄色い三角の注意の印・字（本文は30px以上＝シニア向け）
import { t } from '../i18n/i18n.js?v=37';
import { roundBox, bubbleText, fitText, textStyle, COLORS, clearScene } from '../ui/widgets.js?v=37';

export const CAUTION_MS = 3500; // 自動で表紙へ進むまで
const CARD = { x: 360, top: 150, w: 640, h: 940 };
const WOOD = 0xcfa56a; // 木の板
const WOOD_EDGE = 0x6d4a1f;
const INK = '#2b1a08';
const LINES = ['caution.sound', 'caution.light', 'caution.rest', 'caution.fiction'];
const SLOT = { first: 528, step: 152, w: 560, h: 140 }; // 本文1つの枠（中心の y は first から step ずつ）
const TEXT_SIZE = 32; // 本文はここから始め、収まらなければ 30 まで縮める
const TEXT_MIN = 30;

export class CautionScene extends Phaser.Scene {
  constructor() {
    super('caution');
  }

  create() {
    this.leaving = false;
    clearScene(this);
    const { width } = this.scale;
    const cy = CARD.top + CARD.h / 2;
    roundBox(this, CARD.x, cy, CARD.w, CARD.h, WOOD, { radius: 28, stroke: WOOD_EDGE });
    // 札の内側のふち（板の縁取り）
    const g = this.add.graphics();
    g.lineStyle(4, WOOD_EDGE, 0.55);
    g.strokeRoundedRect(CARD.x - CARD.w / 2 + 16, CARD.top + 16, CARD.w - 32, CARD.h - 32, 18);
    // 黄色い三角の注意の印と「！」
    const tx = CARD.x, ty = 300, r = 70;
    g.fillStyle(0xf2c21b, 1);
    g.fillTriangle(tx, ty - r, tx - r * 1.1, ty + r * 0.75, tx + r * 1.1, ty + r * 0.75);
    g.lineStyle(8, 0x3b2810, 1);
    g.strokeTriangle(tx, ty - r, tx - r * 1.1, ty + r * 0.75, tx + r * 1.1, ty + r * 0.75);
    this.add.text(tx, ty + 14, '!', textStyle(92, '#3b2810')).setOrigin(0.5);
    fitText(this.add.text(CARD.x, 415, t('caution.head'), textStyle(54, INK)).setOrigin(0.5), CARD.w - 80);
    LINES.forEach((k, i) => {
      const y = SLOT.first + i * SLOT.step;
      bubbleText(this, CARD.x, y, t(k), { w: SLOT.w, h: SLOT.h }, { size: TEXT_SIZE, min: TEXT_MIN, lineSpacing: 6 }).setColor(INK).setAlign('center');
      if (i < LINES.length - 1) g.lineStyle(2, WOOD_EDGE, 0.35).lineBetween(CARD.x - 220, y + SLOT.step / 2, CARD.x + 220, y + SLOT.step / 2);
    });
    // 下に小さく
    const hint = fitText(this.add.text(width / 2, 1160, t('caution.tap'), textStyle(32, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), width - 80);
    this.tweens.add({ targets: hint, alpha: 0.35, duration: 800, yoyo: true, repeat: -1 });
    // たたけばすぐ表紙へ・何もしなくても約3.5秒で表紙へ
    this.input.once('pointerdown', () => this.go());
    this.time.delayedCall(CAUTION_MS, () => this.go());
  }

  go() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('cover');
  }
}
