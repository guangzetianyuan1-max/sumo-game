// src/scenes/GuideScene.js — 最初の画面：案内役（相手の弱みを教えてくれる女子）を3人から選ぶ
import { GUIDE_IDS } from '../data/guides.js?v=6';
import { t, getLang, setLang } from '../i18n/i18n.js?v=6';
import { session } from '../state.js?v=6';
import { button, fitText, roundBox, hitZone, textStyle, preloadGuideArt, COLORS, storage } from '../ui/widgets.js?v=6';

const CARD_W = 205;
const CARD_H = 480;
const GAP = 22;
const FACE_H = 230;

export class GuideScene extends Phaser.Scene {
  constructor() {
    super('guide');
  }

  preload() {
    preloadGuideArt(this);
  }

  create() {
    const { width } = this.scale;
    fitText(this.add.text(40, 55, t('guide.title'), textStyle(56, COLORS.gold)).setOrigin(0, 0.5), width - 280);
    button(this, width - 105, 55, 170, 70, t('lang.toggle'), () => {
      setLang(getLang() === 'ja' ? 'en' : 'ja', storage());
      document.documentElement.lang = getLang();
      this.scene.restart();
    }, { size: 28, color: COLORS.buttonSub });
    const left = (width - (GUIDE_IDS.length * CARD_W + (GUIDE_IDS.length - 1) * GAP)) / 2;
    GUIDE_IDS.forEach((id, i) => this.card(id, left + CARD_W / 2 + i * (CARD_W + GAP), 220 + CARD_H / 2));
    // 選ぶまでは「次へ」を薄い色にして押しても進まない
    button(this, width / 2, 1190, 460, 110, t('guide.next'), () => {
      if (session.guide) this.scene.start('setup');
    }, { size: 38, color: session.guide ? COLORS.button : COLORS.buttonSub });
  }

  card(id, x, y) {
    const on = session.guide === id;
    const gfx = roundBox(this, x, y, CARD_W, CARD_H, on ? COLORS.panelOn : COLORS.panel, { radius: 32, stroke: COLORS.frame });
    const top = y - CARD_H / 2;
    const key = `guide-${id}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(x, top + 40 + FACE_H / 2, key);
      img.setScale(FACE_H / img.height);
    }
    fitText(this.add.text(x, top + 40 + FACE_H + 50, t(`guide.${id}.name`), textStyle(44, COLORS.ink)).setOrigin(0.5), CARD_W - 24);
    const descStr = t(`guide.${id}.desc`);
    const desc = this.add.text(x, top + 40 + FACE_H + 100, descStr, textStyle(22, COLORS.ink, {
      fontStyle: '500', align: 'center', wordWrap: { width: CARD_W - 20, useAdvancedWrap: true },
    })).setOrigin(0.5, 0);
    // 日本語は1字だけ余る折り返しを避け、前半・後半の2行にそろえる（英語は語で折り返す）
    if (getLang() === 'ja' && desc.getWrappedText().length > 1) {
      const chars = [...descStr];
      const k = Math.ceil(chars.length / 2);
      desc.setText(`${chars.slice(0, k).join('')}
${chars.slice(k).join('')}`);
    }
    fitText(desc, CARD_W - 20);
    const zone = hitZone(this, x, y, CARD_W, CARD_H);
    zone.on('pointerdown', () => gfx.setAlpha(0.8));
    zone.on('pointerout', () => gfx.setAlpha(1));
    zone.on('pointerup', () => {
      gfx.setAlpha(1);
      session.guide = id;
      this.scene.restart();
    });
  }
}
