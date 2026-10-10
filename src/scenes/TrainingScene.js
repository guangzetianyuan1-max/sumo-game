// src/scenes/TrainingScene.js — 稽古（場所の前に6回）：上に自分のしこ名・番付・残りの回数・疲れ、心技体の棒、稽古7つの札（2列×4段）
// 押すと train → 保存 → 棒を描き直し、伸びた値を「+1.5」のように一瞬出す。0回になったら「番付を見る」→ 場所を始めて（保存）→ 番付
import { TRAININGS } from '../core/career.js?v=8';
import { t, rankLabel, shikonaLabel } from '../i18n/i18n.js?v=8';
import { session, trainNow, beginBasho } from '../state.js?v=8';
import { button, fitText, roundBox, hitZone, textStyle, statBars, COLORS } from '../ui/widgets.js?v=8';

const BARS = { x: 40, y: 196, w: 640 }; // 心技体の棒（statBars の大きい版：行の高さ44・名前の幅96・数の幅46）
const CARD = { w: 310, h: 150, cols: [190, 530], top: 450, step: 170 };
const STATS = ['shin', 'gi', 'tai'];
const r1 = (v) => Math.round(v * 10) / 10;

export class TrainingScene extends Phaser.Scene {
  constructor() {
    super('training');
  }

  create() {
    if (!session.career) {
      this.scene.start('guide');
      return;
    }
    this.draw();
  }

  redraw(gains) {
    this.time.delayedCall(0, () => {
      this.draw();
      if (gains) this.showGains(gains);
    });
  }

  draw() {
    this.children.removeAll(true);
    const c = session.career;
    const { width } = this.scale;
    fitText(this.add.text(40, 56, shikonaLabel(c.name), textStyle(52, COLORS.gold)).setOrigin(0, 0.5), width - 80);
    fitText(this.add.text(40, 112, rankLabel(c.pos), textStyle(30, COLORS.ink)).setOrigin(0, 0.5), width - 80);
    fitText(this.add.text(40, 158, t('train.left', { n: c.trainingLeft }), textStyle(30, COLORS.gold)).setOrigin(0, 0.5), width / 2 - 60);
    fitText(this.add.text(width - 40, 158, t('train.fatigue', { n: c.fatigue }), textStyle(30, c.fatigue >= 3 ? COLORS.gold : COLORS.sub)).setOrigin(1, 0.5), width / 2 - 60);
    statBars(this, BARS.x, BARS.y, BARS.w, c.stats);

    TRAININGS.forEach((kind, i) => this.card(kind, CARD.cols[i % 2], CARD.top + Math.floor(i / 2) * CARD.step, c.trainingLeft > 0));

    const done = c.trainingLeft === 0;
    button(this, width / 2, 1190, 460, 110, t('train.done'), () => {
      if (session.career.trainingLeft > 0) {
        this.needMore(); // 押しても進まない理由を出す（本人「番付を見るから進まない」）
        return;
      }
      beginBasho(); // basho が無い時だけ始める
      this.scene.start('banzuke');
    }, { size: 38, color: done ? COLORS.button : COLORS.buttonSub });
  }

  // 稽古が残っている時に「番付を見る」を押したら、ボタンの上に理由を出して少し揺らす
  needMore() {
    this.hint?.destroy();
    const { width } = this.scale;
    this.hint = fitText(this.add.text(width / 2, 1100, t('hint.trainFirst', { n: session.career.trainingLeft }), textStyle(30, COLORS.gold, { align: 'center' })).setOrigin(0.5), width - 60);
    this.tweens.add({ targets: this.hint, x: { from: width / 2 - 12, to: width / 2 }, duration: 300, ease: 'Bounce.Out' });
  }

  // 稽古の札：名前と効き目の2行。回数が残っていない時は薄く、押しても何もしない
  card(kind, x, y, open) {
    const gfx = roundBox(this, x, y, CARD.w, CARD.h, COLORS.panel, { radius: 28, stroke: COLORS.frame });
    const name = fitText(this.add.text(x, y - 24, t(`train.${kind}`), textStyle(34, COLORS.ink)).setOrigin(0.5), CARD.w - 30);
    const desc = fitText(this.add.text(x, y + 30, t(`train.${kind}.desc`), textStyle(24, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), CARD.w - 30);
    if (!open) {
      [gfx, name, desc].forEach((p) => p.setAlpha(0.4));
      return;
    }
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
      if (!down || session.career.trainingLeft <= 0) return;
      down = false;
      const before = session.career.stats;
      const after = trainNow(kind).stats;
      const gains = {};
      for (const k of STATS) if (after[k] > before[k]) gains[k] = r1(after[k] - before[k]);
      this.redraw(gains);
    });
  }

  // 伸びた値を、その棒の先の上に一瞬出す（上へ浮いて消える）
  showGains(gains) {
    const labelW = 96;
    const numW = 46;
    const bw = BARS.w - labelW - numW;
    STATS.forEach((k, i) => {
      if (!gains[k]) return;
      const v = Math.max(0, Math.min(100, session.career.stats[k]));
      const x = Math.min(BARS.x + labelW + bw * v / 100 + 6, BARS.x + BARS.w - numW - 60);
      const y = BARS.y + i * 44 + 22 - 4;
      const txt = this.add.text(x, y, t('train.gain', { n: gains[k] }), textStyle(28, COLORS.gold, { stroke: '#141a2e', strokeThickness: 6 })).setOrigin(0, 0.5);
      this.tweens.add({ targets: txt, y: y - 30, alpha: 0, delay: 500, duration: 700, onComplete: () => txt.destroy() });
    });
  }
}
