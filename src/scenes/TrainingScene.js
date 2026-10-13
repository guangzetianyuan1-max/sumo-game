// src/scenes/TrainingScene.js — 稽古（10/12 夜 本人「倒せない敵が出た場合、稽古モードに移り、新技や心技体を鍛える」）
// 1回3コマ。札＝心（ぶつかり稽古）・技（技の稽古）・体（鉄砲）・解禁した新技。押すと稽古の絵を1秒出して効果音 → 3コマ終われば同じ相手へ
import { t } from '../i18n/i18n.js?v=33';
import { session, trainStatNow, trainTechNow } from '../state.js?v=33';
import { techCards, TECH_CARD_LIMIT } from '../core/training.js?v=33';
import { playTraining } from '../ui/sfx.js?v=33';
import {
  topTitle, fitText, roundBox, hitZone, textStyle, statBars, speakerFace, speechBubble, preloadOyakataArt, preloadTrainingIndex, loadTrainingArt, clearScene, COLORS,
} from '../ui/widgets.js?v=33';

const STAT_CARDS = [['shin', 'butsukari'], ['gi', 'waza'], ['tai', 'teppo']]; // 値と、使う稽古の絵・音
// 札の行：top から bottom までに収める。行の高さは最大 step・札の数が多いときは縮める（1190 は「稽古おわり」の字）
const CARD = { w: 640, top: 470, step: 120, bottom: 1150 };
const POP_MS = 1000;

export class TrainingScene extends Phaser.Scene {
  constructor() {
    super('training');
  }

  preload() {
    preloadTrainingIndex(this);
    preloadOyakataArt(this);
  }

  create() {
    if (!session.run) { this.scene.start('guide'); return; }
    if (!session.run.training) { this.scene.start('opponent'); return; }
    loadTrainingArt(this);
    this.busy = false;
    this.draw();
  }

  draw() {
    clearScene(this);
    const r = session.run;
    const { width } = this.scale;
    topTitle(this, 60, t('train2.title'), 56, COLORS.gold);
    fitText(this.add.text(width / 2, 130, t('train2.left', { n: r.training ? r.training.left : 0 }), textStyle(34, COLORS.ink)).setOrigin(0.5), width - 60);
    statBars(this, 40, 190, 640, r.stats);
    // 琴浪親方：怒鳴る顔とひと言（心技体の棒と札の間）
    speakerFace(this, 'kotonami', 100, 398, 112, 'shout');
    speechBubble(this, 180, 342, 500, 112, t('train2.oyakata'), { size: 28, min: 16 });
    // 案内役のおすすめ＝一番低い値（設計書 §7。相手ごとの弱みの勧めは第3段の相性で）
    const low = STAT_CARDS.map(([s]) => s).reduce((a, b) => (r.stats[b] < r.stats[a] ? b : a));
    const cards = techCards(r, TECH_CARD_LIMIT);
    const techs = cards.show;
    const nextAt = cards.nextAt;
    // 行の数（札＋鍵の行）から行の高さを決める。札が多くても bottom の上に収まる
    const rows = STAT_CARDS.length + techs.length + (cards.more ? 1 : 0) + (nextAt !== undefined ? 1 : 0);
    const step = Math.min(CARD.step, Math.floor((CARD.bottom - CARD.top) / rows));
    const h = step - 16;
    let i = 0;
    for (const [stat, kind] of STAT_CARDS) {
      const label = stat === low ? t('train2.rec', { label: t(`train2.${stat}`) }) : t(`train2.${stat}`);
      this.card(i++, label, () => this.doStep(kind, () => trainStatNow(stat)), stat === low ? COLORS.gold : COLORS.ink, step, h);
    }
    for (const id of techs) {
      this.card(i++, t('train2.tech', { tech: t(`newtech.${id}`) }), () => this.doStep('waza', () => trainTechNow(id)), COLORS.gold, step, h);
    }
    if (cards.more) {
      fitText(this.add.text(width / 2, CARD.top + i * step + step / 2, t('train2.more', { n: cards.more }), textStyle(24, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), width - 60);
      i += 1;
    }
    if (nextAt !== undefined) {
      fitText(this.add.text(width / 2, CARD.top + i * step + step / 2, t('train2.locked', { n: nextAt - r.wins }), textStyle(26, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), width - 60);
    }
  }

  card(i, label, onTap, color, step, h) {
    const { width } = this.scale;
    const y = CARD.top + step * i + step / 2;
    const gfx = roundBox(this, width / 2, y, CARD.w, h, COLORS.panel, { radius: 26, stroke: COLORS.frame });
    fitText(this.add.text(width / 2, y, label, textStyle(32, color)).setOrigin(0.5), CARD.w - 40);
    const zone = hitZone(this, width / 2, y, CARD.w, h);
    zone.on('pointerdown', () => gfx.setAlpha(0.8));
    zone.on('pointerout', () => gfx.setAlpha(1));
    zone.on('pointerup', () => { gfx.setAlpha(1); onTap(); });
  }

  // 1コマ：記録して保存 → 絵（あれば）と効果音 → 描き直すか、終わったら同じ相手へ
  doStep(kind, apply) {
    if (this.busy) return;
    this.busy = true;
    apply();
    playTraining(kind);
    // 押しの最中に札を消さない：描き直しは次のフレームへ
    this.time.delayedCall(0, () => {
      this.draw(); // 残りコマと札を新しい状態に（下地・絵・字はこの上に重ねる）
      const { width, height } = this.scale;
      this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6); // 暗い下地（押せない）
      const key = `train-${kind}`;
      if (this.textures.exists(key)) {
        const img = this.add.image(width / 2, height / 2, key);
        img.setScale(Math.min(560 / img.width, 420 / img.height));
      }
      const done = !session.run.training;
      if (done) fitText(this.add.text(width / 2, 1235, t('train2.done'), textStyle(34, COLORS.gold)).setOrigin(0.5), width - 60);
      this.time.delayedCall(POP_MS, () => {
        this.busy = false;
        if (done) this.scene.start('opponent');
        else this.draw(); // 下地・絵ごと描き直す
      });
    });
  }
}
