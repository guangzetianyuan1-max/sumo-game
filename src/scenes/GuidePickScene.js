// src/scenes/GuidePickScene.js — 新しい一代記の1歩目：案内役（相手の弱みを教えてくれる女子）を3人から選ぶ → 入門（タイプ）へ。
// 初めの画面で空きの記録（またははじめから）を押すとここへ来る。保存先の記録は session.slot（初めの画面で決めてある）
import { GUIDE_IDS } from '../data/guides.js?v=13';
import { t, getLang } from '../i18n/i18n.js?v=13';
import { session } from '../state.js?v=13';
import { button, backButton, topTitle, fitText, roundBox, hitZone, textStyle, preloadGuideArt, COLORS } from '../ui/widgets.js?v=13';

const CARD_W = 205;
const CARD_H = 480;
const GAP = 22;
const FACE_H = 230;

export class GuidePickScene extends Phaser.Scene {
  constructor() {
    super('guidePick');
  }

  preload() {
    preloadGuideArt(this);
  }

  create() {
    const { width } = this.scale;
    backButton(this, () => this.scene.start('guide')); // 初めの画面（記録を選ぶ）へ
    topTitle(this, 55, t('guide.title'), 56, COLORS.gold);
    const left = (width - (GUIDE_IDS.length * CARD_W + (GUIDE_IDS.length - 1) * GAP)) / 2;
    GUIDE_IDS.forEach((id, i) => this.card(id, left + CARD_W / 2 + i * (CARD_W + GAP), 220 + CARD_H / 2));
    // 選ぶまでは「次へ」を薄い色にして、押しても進まない（理由を出す）
    button(this, width / 2, 1190, 460, 110, t('guide.next'), () => {
      if (!session.guide) {
        this.hint?.destroy();
        this.hint = fitText(this.add.text(width / 2, 1110, t('hint.pickGuide'), textStyle(30, COLORS.gold, { align: 'center' })).setOrigin(0.5), width - 60);
        return;
      }
      this.scene.start('setup');
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
