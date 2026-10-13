// src/scenes/TrainingScene.js — 稽古（10/12 夜 本人「倒せない敵が出た場合、稽古モードに移り、新技や心技体を鍛える」）
// 1回3コマ。コマごとに遊びを選ぶ（20体版 Task 6・10/13 本人「一押し、連打、長押しの訓練が欲しい」）：
//   一押し稽古＝技・連打稽古＝体・長押し稽古＝心（遊びは DrillScene）／決め技を覚える（解禁していて覚えていない時だけ）
//   決め技の札（10/14 本人「稽古の出来で決め技を習得できるようにしてください」）＝その技に合った遊び（kimete.js の drill）を決め技モードで開く。
//   出来で習得ゲージ（run.kimeteProgress）がたまり、満タンで覚える。札にゲージの％（0%は出さない）
// 親方が一番低い心技体に合う遊びを勧める（★と金の字）。
// 負けた後の稽古は3コマ終えると同じ相手へ。番付からいつでも入る稽古（training.voluntary・10/13 本人「好きなときに稽古が出来るように」）は、
// どのコマでも「番付へ戻る」で抜けられる（残りのコマは捨てる）・終われば番付へ
import { t } from '../i18n/i18n.js?v=35';
import { session, trainLeaveNow } from '../state.js?v=35';
import { canLeaveTraining, kimeteGauge, STATS } from '../core/run.js?v=35';
import { kimeteById } from '../data/kimete.js?v=35';
import { techCards, TECH_CARD_LIMIT } from '../core/training.js?v=35';
import { DRILLS, STAT_DRILL, kimetePct } from '../core/drills.js?v=35';
import { playBout } from '../ui/sfx.js?v=35';
import {
  topTitle, fitText, roundBox, hitZone, textStyle, statBars, speakerFace, speechBubble, button, preloadOyakataArt, clearScene, COLORS,
} from '../ui/widgets.js?v=35';

// 札の行：top から bottom までに収める。行の高さは最大 step・札の数が多いときは縮める（1235 は「稽古おわり」の字・1210 は番付へ戻る）
const CARD = { w: 640, top: 470, step: 120, bottom: 1150 };
const LEAVE_Y = 1212;

export class TrainingScene extends Phaser.Scene {
  constructor() {
    super('training');
  }

  preload() {
    preloadOyakataArt(this);
  }

  create() {
    if (!session.run) { this.scene.start('guide'); return; }
    if (!session.run.training) { this.scene.start('opponent'); return; }
    this.busy = false;
    this.draw();
  }

  draw() {
    clearScene(this);
    const r = session.run;
    const { width } = this.scale;
    const free = canLeaveTraining(r);
    topTitle(this, 60, t('train2.title'), 56, COLORS.gold);
    fitText(this.add.text(width / 2, 130, t('train2.left', { n: r.training ? r.training.left : 0 }), textStyle(34, COLORS.ink)).setOrigin(0.5), width - 60);
    statBars(this, 40, 190, 640, r.stats);
    // 親方のおすすめ＝一番低い値に合う遊び（設計書 §7）
    const low = STATS.reduce((a, b) => (r.stats[b] < r.stats[a] ? b : a), STATS[0]);
    const rec = STAT_DRILL[low];
    // 琴浪親方：負けた後は怒鳴る顔・自分から来た時はふつうの顔（心技体の棒と札の間）
    speakerFace(this, 'kotonami', 100, 398, 112, free ? 'normal' : 'shout');
    const line = `${t(free ? 'train2.oyakataFree' : 'train2.oyakata')} ${t('train2.recDrill', { stat: t(`stat.${low}`), drill: t(`drill.${rec}`) })}`;
    speechBubble(this, 180, 342, 500, 112, line, { size: 26, min: 14 });
    const cards = techCards(r, TECH_CARD_LIMIT);
    const techs = cards.show;
    const nextAt = cards.nextAt;
    // 行の数（札＋鍵の行）から行の高さを決める。札が多くても bottom の上に収まる
    const rows = DRILLS.length + techs.length + (cards.more ? 1 : 0) + (nextAt !== undefined ? 1 : 0);
    const step = Math.min(CARD.step, Math.floor((CARD.bottom - CARD.top) / rows));
    const h = step - 16;
    let i = 0;
    for (const kind of DRILLS) {
      const isRec = kind === rec;
      const label = isRec ? t('train2.rec', { label: t(`drill.${kind}.card`) }) : t(`drill.${kind}.card`);
      this.card(i++, label, () => this.toDrill(kind), isRec ? COLORS.gold : COLORS.ink, step, h);
    }
    for (const id of techs) {
      const k = kimeteById(id);
      if (!k) continue;
      const pct = kimetePct(kimeteGauge(r, id));
      const label = t('train2.tech', { tech: t(`newtech.${id}`), drill: t(`drill.${k.drill}.short`) });
      this.card(i++, label, () => this.toDrill(k.drill, id), COLORS.gold, step, h, true, pct > 0 ? t('kimete.progress', { pct }) : '');
    }
    if (cards.more) {
      fitText(this.add.text(width / 2, CARD.top + i * step + step / 2, t('train2.more', { n: cards.more }), textStyle(24, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), width - 60);
      i += 1;
    }
    if (nextAt !== undefined) {
      fitText(this.add.text(width / 2, CARD.top + i * step + step / 2, t('train2.locked', { n: nextAt - r.wins }), textStyle(26, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), width - 60);
    }
    // 番付からの稽古だけ：いつでも番付へ戻れる（残りのコマは捨てる）
    if (free) {
      button(this, width / 2, LEAVE_Y, 360, 84, t('train2.leave'), () => {
        if (this.busy) return;
        trainLeaveNow();
        this.scene.start('ladder');
      }, { size: 30, color: COLORS.buttonSub });
    }
  }

  // sub＝札の2行目（決め技の習得％）。あれば1行目を上へずらし、下に小さく出す
  card(i, label, onTap, color, step, h, pon = true, sub = '') {
    const { width } = this.scale;
    const y = CARD.top + step * i + step / 2;
    const gfx = roundBox(this, width / 2, y, CARD.w, h, COLORS.panel, { radius: 26, stroke: COLORS.frame });
    const lift = sub ? Math.min(20, h * 0.18) : 0;
    fitText(this.add.text(width / 2, y - lift, label, textStyle(sub ? 30 : 32, color)).setOrigin(0.5), CARD.w - 40);
    if (sub) fitText(this.add.text(width / 2, y + h * 0.28, sub, textStyle(24, COLORS.ink, { fontStyle: '500' })).setOrigin(0.5), CARD.w - 40);
    const zone = hitZone(this, width / 2, y, CARD.w, h);
    let down = false; // 押しはこの札の上で始まったものだけ数える（widgets.button と同じ）
    zone.on('pointerdown', () => { down = true; gfx.setAlpha(0.8); });
    zone.on('pointerout', () => { down = false; gfx.setAlpha(1); });
    zone.on('pointerup', () => {
      gfx.setAlpha(1);
      if (!down) return;
      down = false;
      if (pon) playBout('pon');
      onTap();
    });
  }

  // 遊びの画面へ（押しの最中に場面を替えない：次のフレームへ）。kimete＝決め技の id（決め技モード）
  toDrill(kind, kimete = null) {
    if (this.busy) return;
    this.busy = true;
    this.time.delayedCall(0, () => this.scene.start('drill', kimete ? { kind, kimete } : { kind }));
  }
}
