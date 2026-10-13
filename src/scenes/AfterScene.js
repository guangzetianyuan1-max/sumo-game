// src/scenes/AfterScene.js — 取組の後（10/12 夜）：勝ち＝倒した相手・心技体の伸び・昇進・新技の解禁・クリア → 番付表
// 負け＝心技体の伸び（少し）・「もう一度」（相手の情報へ）か「稽古へ」。同じ相手に3連敗したら案内役が稽古を勧める（選ぶのは本人）
import { t, foeLabel } from '../i18n/i18n.js?v=35';
import { session, suggestTraining, trainBegin } from '../state.js?v=35';
import { playBout } from '../ui/sfx.js?v=35';
import { button, topTitle, fitText, textStyle, speechBubble, speakerFace, preloadGuideArt, preloadOyakataArt, COLORS } from '../ui/widgets.js?v=35';

const STATS = ['shin', 'gi', 'tai'];

export class AfterScene extends Phaser.Scene {
  constructor() {
    super('after');
  }

  preload() {
    preloadGuideArt(this);
    preloadOyakataArt(this);
  }

  create() {
    const lb = session.lastBout;
    const r = session.run;
    if (!r) { this.scene.start('guide'); return; }
    if (!lb) { this.scene.start('ladder'); return; }
    const { width } = this.scale;
    const line = (y, str, size, color, extra) => fitText(this.add.text(width / 2, y, str, textStyle(size, color, extra)).setOrigin(0.5), width - 60);
    topTitle(this, 90, t(lb.won ? 'after.win' : 'after.lose'), 72, lb.won ? COLORS.gold : COLORS.ink);
    if (lb.won) line(190, t('after.beat', { name: foeLabel(lb.foe) }), 34, COLORS.ink);
    // 心技体の伸び（1行ずつ）
    STATS.forEach((s, i) => line(280 + i * 52, t('after.growth', { stat: t(`stat.${s}`), from: lb.before[s].toFixed(1), to: lb.after[s].toFixed(1) }), 30, COLORS.ink, { fontStyle: '500' }));
    let y = 470;
    if (lb.promoted) { playBout('promo'); line(y, t('after.promoted', { rank: t(`div.${lb.promoted}`) }), 44, COLORS.gold); y += 70; }
    if (lb.unlocked) { line(y, t('after.unlocked', { tech: t(`newtech.${lb.unlocked}`) }), 30, COLORS.gold); y += 60; }
    if (lb.cleared) { line(y, t('after.cleared'), 48, COLORS.gold); y += 70; }

    if (lb.won) {
      if (lb.promoted) {
        speakerFace(this, 'kotonami', 110, 820, 150, 'smile');
        speechBubble(this, 210, 730, 470, 180, t('after.promoOyakata', { rank: t(`div.${lb.promoted}`) }), { size: 28, min: 16 });
      }
      // 20体目を倒した＝クリアの画面（横綱の土俵入り）へ
      if (lb.cleared) button(this, width / 2, 1190, 460, 110, t('after.toClear'), () => this.scene.start('clear'), { size: 38 });
      else button(this, width / 2, 1190, 460, 110, t('after.next'), () => this.scene.start('ladder'), { size: 38 });
      return;
    }
    if (suggestTraining(r)) {
      // 案内役の勧め：左に顔・右に吹き出し
      speakerFace(this, r.guide, 110, 820, 150);
      speechBubble(this, 210, 730, 470, 180, t(`after.suggest.${r.guide}`), { size: 28, min: 16 });
    }
    button(this, width / 2 - 170, 1190, 320, 110, t('after.retry'), () => this.scene.start('opponent'), { size: 36, color: COLORS.buttonSub });
    button(this, width / 2 + 170, 1190, 320, 110, t('after.train'), () => {
      trainBegin();
      this.scene.start('training');
    }, { size: 36 });
  }
}
