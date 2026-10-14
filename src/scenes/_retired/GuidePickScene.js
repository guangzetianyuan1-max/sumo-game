// src/scenes/GuidePickScene.js — 新しい勝ち抜きの1歩目：部屋は1つ（10/12 夜 本人「相撲部屋は1つとする」）。親方の娘3人から案内役を選ぶ → 主人公へ
// 部屋の名・親方・娘の名と紹介は i18n（heya.tsurumai.* と guide.<id>.*）。部屋の id は ONE_HEYA
import { GUIDE_IDS } from '../data/guides.js?v=36';
import { t } from '../i18n/i18n.js?v=36';
import { session } from '../state.js?v=36';
import {
  button, backButton, topTitle, fitText, roundBox, hitZone, textStyle, preloadGuideArt, preloadOyakataArt, speakerFace, clearScene, COLORS,
} from '../ui/widgets.js?v=36';

const ONE_HEYA = 'tsurumai'; // 仮（本人が名前を決める）
const HEAD = { y: 175, face: 120 }; // 親方の段
const CARD = { w: 660, h: 230, top: 290, gap: 22 }; // 娘の札3枚：290〜1024
const FACE = 150;

export class GuidePickScene extends Phaser.Scene {
  constructor() {
    super('guidePick');
  }

  preload() {
    preloadGuideArt(this);
    preloadOyakataArt(this);
  }

  create() {
    this.hint = null;
    this.draw();
  }

  redraw() {
    this.time.delayedCall(0, () => this.draw());
  }

  draw() {
    clearScene(this);
    this.hint = null;
    const { width } = this.scale;
    backButton(this, () => this.scene.start('guide'));
    topTitle(this, 55, t('heya.one', { name: t(`heya.${ONE_HEYA}.name`) }), 46, COLORS.gold);
    // 親方の段（顔と名・紹介）
    speakerFace(this, ONE_HEYA, 60 + HEAD.face / 2, HEAD.y, HEAD.face);
    fitText(this.add.text(60 + HEAD.face + 20, HEAD.y - 22, t(`heya.${ONE_HEYA}.oyakata`), textStyle(32, COLORS.ink)).setOrigin(0, 0.5), width - 240);
    fitText(this.add.text(60 + HEAD.face + 20, HEAD.y + 22, t(`heya.${ONE_HEYA}.desc`), textStyle(22, COLORS.sub, { fontStyle: '500' })).setOrigin(0, 0.5), width - 240);
    fitText(this.add.text(width / 2, CARD.top - 34, t('guide.title'), textStyle(32, COLORS.ink)).setOrigin(0.5), width - 60);
    GUIDE_IDS.forEach((id, i) => this.card(id, width / 2, CARD.top + CARD.h / 2 + i * (CARD.h + CARD.gap), id === session.guide));
    button(this, width / 2, 1190, 460, 110, t('guide.next'), () => {
      if (!GUIDE_IDS.includes(session.guide)) {
        this.hint?.destroy();
        this.hint = fitText(this.add.text(width / 2, 1100, t('hint.pickHeya'), textStyle(30, COLORS.gold, { align: 'center' })).setOrigin(0.5), width - 60);
        return;
      }
      this.scene.start('setup');
    }, { size: 38, color: GUIDE_IDS.includes(session.guide) ? COLORS.button : COLORS.buttonSub });
  }

  // 娘の札：左に顔・右に名（大）と紹介
  card(id, x, y, on) {
    const left = x - CARD.w / 2;
    const gfx = roundBox(this, x, y, CARD.w, CARD.h, on ? COLORS.panelOn : COLORS.panel, { radius: 30, stroke: COLORS.frame });
    speakerFace(this, id, left + 30 + FACE / 2, y, FACE);
    const tx = left + 30 + FACE + 24;
    const room = x + CARD.w / 2 - 24 - tx;
    fitText(this.add.text(tx, y - 30, t(`guide.${id}.name`), textStyle(48, COLORS.ink)).setOrigin(0, 0.5), room);
    fitText(this.add.text(tx, y + 34, t(`guide.${id}.desc`), textStyle(26, COLORS.sub, { fontStyle: '500' })).setOrigin(0, 0.5), room);
    const zone = hitZone(this, x, y, CARD.w, CARD.h);
    let down = false;
    zone.on('pointerdown', () => { down = true; gfx.setAlpha(0.8); });
    zone.on('pointerout', () => { down = false; gfx.setAlpha(1); });
    zone.on('pointerup', () => {
      gfx.setAlpha(1);
      if (!down) return;
      down = false;
      session.guide = id;
      this.redraw();
    });
  }
}
