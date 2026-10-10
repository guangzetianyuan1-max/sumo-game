// src/scenes/GuidePickScene.js — 新しい一代記の1歩目：入門する相撲部屋を3つから選ぶ → 入門（タイプ）へ。
// 10/11 本人「はじめの画面で相撲部屋が3つあり、入門部屋を選べる・女子はその各々の入門部屋に在籍・各入門部屋に親方が存在する」。
// 部屋の札を押す＝その部屋の娘を session.guide にする（一代記は今までどおり guide を持ち、部屋はそこから引く）。
// 初めの画面で空きの記録（またははじめから）を押すとここへ来る。保存先の記録は session.slot（初めの画面で決めてある）
import { HEYA_IDS, HEYA, heyaOfGuide } from '../data/heya.js?v=16';
import { t } from '../i18n/i18n.js?v=16';
import { session } from '../state.js?v=16';
import {
  button, backButton, topTitle, fitText, roundBox, hitZone, textStyle, preloadGuideArt, preloadOyakataArt, speakerFace, clearScene, COLORS,
} from '../ui/widgets.js?v=16';

const CARD = { w: 660, h: 300, top: 115, gap: 20 }; // 札3枚：115〜1055（下に理由の1行と「次へ」）
const PAD = 26;
const FACE = 110; // 親方と娘の顔の四角

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
    this.time.delayedCall(0, () => this.draw()); // 押しの最中に札を消さない
  }

  draw() {
    clearScene(this);
    this.hint = null;
    const { width } = this.scale;
    backButton(this, () => this.scene.start('guide')); // 初めの画面（記録を選ぶ）へ
    topTitle(this, 55, t('heya.title'), 52, COLORS.gold);
    const chosen = heyaOfGuide(session.guide);
    HEYA_IDS.forEach((id, i) => this.card(id, width / 2, CARD.top + CARD.h / 2 + i * (CARD.h + CARD.gap), id === chosen));
    // 選ぶまでは「次へ」を薄い色にして、押しても進まない（理由を出す）
    button(this, width / 2, 1190, 460, 110, t('guide.next'), () => {
      if (!heyaOfGuide(session.guide)) {
        this.hint?.destroy();
        this.hint = fitText(this.add.text(width / 2, 1100, t('hint.pickHeya'), textStyle(30, COLORS.gold, { align: 'center' })).setOrigin(0.5), width - 60);
        return;
      }
      this.scene.start('setup');
    }, { size: 38, color: chosen ? COLORS.button : COLORS.buttonSub });
  }

  // 部屋の札：部屋の名（大）／親方の顔と名・娘の顔と「娘：千鶴」／紹介の1行／得意の稽古の1行（金）
  card(id, x, y, on) {
    const left = x - CARD.w / 2;
    const top = y - CARD.h / 2;
    const room = CARD.w - 2 * PAD;
    const gfx = roundBox(this, x, y, CARD.w, CARD.h, on ? COLORS.panelOn : COLORS.panel, { radius: 30, stroke: COLORS.frame });
    fitText(this.add.text(left + PAD, top + 42, t(`heya.${id}.name`), textStyle(44, COLORS.ink)).setOrigin(0, 0.5), room);

    // 顔の段：左半分に親方、右半分に娘（顔の右に名）
    const faceY = top + 135;
    const half = room / 2;
    const guide = HEYA[id].guide;
    const person = (who, label, x0) => {
      speakerFace(this, who, x0 + FACE / 2, faceY, FACE);
      fitText(this.add.text(x0 + FACE + 14, faceY, label, textStyle(26, COLORS.ink)).setOrigin(0, 0.5), half - FACE - 24);
    };
    person(id, t(`heya.${id}.oyakata`), left + PAD);
    person(guide, t('heya.daughter', { name: t(`guide.${guide}.name`) }), left + PAD + half);

    fitText(this.add.text(left + PAD, top + 226, t(`heya.${id}.desc`), textStyle(22, COLORS.ink, { fontStyle: '500' })).setOrigin(0, 0.5), room);
    fitText(this.add.text(left + PAD, top + 266, t(`heya.${id}.specialty`), textStyle(24, COLORS.gold)).setOrigin(0, 0.5), room);

    const zone = hitZone(this, x, y, CARD.w, CARD.h);
    let down = false;
    zone.on('pointerdown', () => {
      down = true;
      gfx.setAlpha(0.8);
    });
    zone.on('pointerout', () => {
      down = false;
      gfx.setAlpha(1);
    });
    zone.on('pointerup', () => {
      gfx.setAlpha(1);
      if (!down) return;
      down = false;
      session.guide = guide;
      this.redraw();
    });
  }
}
