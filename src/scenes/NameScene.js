// src/scenes/NameScene.js — しこ名を選ぶ：候補3つを大きな札で縦に並べる・引き直せる・決めると一代記が始まる（保存）→ 稽古
import { shikonaCandidates } from '../core/shikona.js?v=12';
import { makeRng } from '../core/rng.js?v=12';
import { t, getLang, shikonaLabel } from '../i18n/i18n.js?v=12';
import { session, startCareer } from '../state.js?v=12';
import { button, fitText, roundBox, hitZone, textStyle, COLORS } from '../ui/widgets.js?v=12';

const CARD_W = 600;
const CARD_H = 170;
const CARD_Y = [300, 500, 700];

export class NameScene extends Phaser.Scene {
  constructor() {
    super('name');
  }

  create() {
    this.rolls = 0;
    this.roll();
    this.draw();
  }

  roll() {
    this.cands = shikonaCandidates(makeRng(Date.now() + this.rolls++), 3, new Set());
    this.pick = 0;
  }

  redraw() {
    this.time.delayedCall(0, () => this.draw()); // 押しの最中に札を消さない
  }

  draw() {
    this.children.removeAll(true);
    const { width } = this.scale;
    fitText(this.add.text(width / 2, 70, t('name.title'), textStyle(56, COLORS.gold)).setOrigin(0.5), width - 80);
    this.cands.forEach((name, i) => this.card(name, i, width / 2, CARD_Y[i]));
    button(this, width / 2, 900, 360, 84, t('name.reroll'), () => {
      this.roll();
      this.redraw();
    }, { color: COLORS.buttonSub, size: 30 });
    button(this, width / 2, 1075, 320, 64, t('common.back'), () => this.scene.start('setup'), { color: COLORS.buttonSub, size: 26 });
    button(this, width / 2, 1190, 460, 110, t('name.go'), () => {
      startCareer({ guide: session.guide ?? 'chizuru', type: session.you, name: this.cands[this.pick], seed: Date.now() % 1000000 });
      this.scene.start('training');
    }, { size: 38 });
  }

  // 上に今の言葉のしこ名（大きく）・下にもう一方の言葉の読み（小さく）
  card(name, i, x, y) {
    const on = this.pick === i;
    const gfx = roundBox(this, x, y, CARD_W, CARD_H, on ? COLORS.panelOn : COLORS.panel, { radius: 32, stroke: COLORS.frame });
    const other = getLang() === 'ja' ? 'en' : 'ja';
    fitText(this.add.text(x, y - 18, shikonaLabel(name), textStyle(72, COLORS.ink)).setOrigin(0.5), CARD_W - 60);
    fitText(this.add.text(x, y + 52, shikonaLabel(name, other), textStyle(28, on ? COLORS.ink : COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), CARD_W - 60);
    const zone = hitZone(this, x, y, CARD_W, CARD_H);
    zone.on('pointerdown', () => gfx.setAlpha(0.8));
    zone.on('pointerout', () => gfx.setAlpha(1));
    zone.on('pointerup', () => {
      gfx.setAlpha(1);
      this.pick = i;
      this.redraw();
    });
  }
}
