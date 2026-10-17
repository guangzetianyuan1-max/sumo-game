// src/scenes/LearnScene.js — 節目で技を覚える（10/12 作り直し）：候補（run.pendingLearn・3つまで）を札で縦に並べ、1つ選んで覚える → 番付表（ladder）
// 候補は記録に書いてある＝途中で閉じても同じ候補が出る。候補が無ければすぐ番付へ
import { t, techLabel, getLang } from '../i18n/i18n.js?v=55';
import { session, learnNow } from '../state.js?v=55';
import { KIMARITE } from '../data/kimarite.js?v=55';
import { KIMARITE_DESC_JA } from '../data/kimarite_desc.js?v=55';
import { button, topTitle, fitText, roundBox, hitZone, textStyle, COLORS, clearScene } from '../ui/widgets.js?v=55';

const CARD_W = 620;
const CARD_H = 200;
const CARD_Y = [330, 560, 790];

// 技の短い説明（作戦表の図解の札と同じ言葉）
const shortDesc = (id) => (getLang() === 'ja' ? KIMARITE_DESC_JA[id] ?? KIMARITE[id].en : KIMARITE[id].en);

export class LearnScene extends Phaser.Scene {
  constructor() {
    super('learn');
  }

  create() {
    const c = session.run;
    if (!c || !c.pendingLearn) {
      this.scene.start(c ? 'ladder' : 'guide');
      return;
    }
    this.pick = 0;
    this.draw();
  }

  redraw() {
    this.time.delayedCall(0, () => this.draw()); // 押しの最中に札を消さない
  }

  draw() {
    clearScene(this);
    const { width } = this.scale;
    const c = session.run;
    const note = c.learnKind ? t('learn.promo', { rank: t(`div.${c.learnKind}`) }) : t('learn.kachikoshi');
    topTitle(this, 70, t('learn.title'), 56, COLORS.gold);
    fitText(this.add.text(width / 2, 160, note, textStyle(30, COLORS.ink)).setOrigin(0.5), width - 60);
    c.pendingLearn.forEach((id, i) => this.card(id, i, width / 2, CARD_Y[i]));
    button(this, width / 2, 1190, 460, 110, t('learn.go'), () => {
      learnNow(c.pendingLearn[this.pick]);
      this.scene.start('ladder');
    }, { size: 38 });
  }

  // 上に技の名（大きく）・下に短い説明
  card(id, i, x, y) {
    const on = this.pick === i;
    const gfx = roundBox(this, x, y, CARD_W, CARD_H, on ? COLORS.panelOn : COLORS.panel, { radius: 32, stroke: COLORS.frame });
    fitText(this.add.text(x, y - 36, techLabel(id), textStyle(60, COLORS.ink)).setOrigin(0.5), CARD_W - 60);
    fitText(this.add.text(x, y + 50, shortDesc(id), textStyle(26, on ? COLORS.ink : COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), CARD_W - 60);
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
