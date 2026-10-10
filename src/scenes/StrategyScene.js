// src/scenes/StrategyScene.js — 作戦表（設計書 §2）。四角を押すと1つ上へ・長押しで外す・下の覚えた手を押すと段に入る
import { SCENES, ROW, addTech, raise, remove, defaultStrategy } from '../core/strategy.js?v=3';
import { TYPES } from '../data/types.js?v=3';
import { KIMARITE } from '../data/kimarite.js?v=3';
import { classifyPress, LONG_PRESS_MS } from '../ui/press.js?v=3';
import { t, techLabel, getLang } from '../i18n/i18n.js?v=3';
import { session } from '../state.js?v=3';
import { button, fitText, roundBox, hitZone, textStyle, COLORS, GROUP_COLOR } from '../ui/widgets.js?v=3';

const ICON = 120;

export class StrategyScene extends Phaser.Scene {
  constructor() {
    super('strategy');
  }

  create() {
    session.strategy ??= defaultStrategy(TYPES[session.you].sample, session.you);
    session.oppStrategy ??= defaultStrategy(TYPES[session.opp].sample, session.opp);
    this.msg = '';
    this.draw();
  }

  redraw() {
    this.time.delayedCall(0, () => this.draw()); // 押しの最中に四角を消さない
  }

  draw() {
    this.children.removeAll(true);
    const { width } = this.scale;
    this.add.text(30, 26, t('strat.title'), textStyle(48, COLORS.gold));
    fitText(this.add.text(30, 78, t('strat.today', { type: t(`type.${session.opp}.name`) }), textStyle(32, COLORS.ink)), width - 60);
    fitText(this.add.text(30, 116, t(`type.${session.opp}.strong`), textStyle(22, COLORS.sub)), width - 60);
    fitText(this.add.text(30, 142, t('strat.oppWeak', { weak: t(`type.${session.opp}.weak`) }), textStyle(22, COLORS.sub)), width - 60);
    fitText(this.add.text(30, 170, t('strat.hint'), textStyle(24, COLORS.gold)), width - 60);

    SCENES.forEach((sc, r) => {
      const y = 305 + r * 180;
      this.add.text(30, y - 104, t(`scene.${sc}`), textStyle(32, COLORS.gold));
      for (let i = 0; i < ROW; i++) {
        const id = session.strategy[sc][i];
        this.icon(100 + i * 130, y, id, (kind) => {
          if (!id) return;
          session.strategy = kind === 'long' ? remove(session.strategy, sc, i) : raise(session.strategy, sc, i);
          this.msg = '';
          this.redraw();
        }, true);
      }
    });

    this.add.text(30, 760, t('strat.known'), textStyle(30, COLORS.ink));
    TYPES[session.you].sample.forEach((id, k) => {
      this.icon(100 + (k % 5) * 130, 870 + Math.floor(k / 5) * 135, id, () => {
        const res = addTech(session.strategy, id);
        if (res.ok) session.strategy = res.strategy;
        this.msg = res.ok ? '' : t(res.reason === 'dup' ? 'strat.dup' : 'strat.noroom');
        this.redraw();
      });
    });

    if (this.msg) fitText(this.add.text(width / 2, 1115, this.msg, textStyle(30, COLORS.gold)).setOrigin(0.5), width - 60);
    button(this, 190, 1215, 320, 100, t('strat.retype'), () => this.scene.start('setup'), { color: COLORS.buttonSub, size: 36 });
    button(this, width - 190, 1215, 320, 100, t('strat.go'), () => this.scene.start('bout'), { size: 36 });
  }

  // removable：長押しで外せる四角（作戦表の中）。押している間は暗く、長押しの時間を越えたら「離すと外れる」しるしに更に暗くする
  icon(x, y, id, onPress, removable = false) {
    const filled = Boolean(id);
    const parts = [];
    parts.push(roundBox(this, x, y, ICON, ICON, filled ? GROUP_COLOR[KIMARITE[id].group] : COLORS.empty, {
      radius: 20, stroke: COLORS.frame, strokeAlpha: filled ? 1 : 0.25, shadow: filled,
    }));
    if (filled) {
      // 5字までは1行・6字以上は前半（切り上げ）と後半の2行にそろえる（1字だけ余る折り返しを避ける）。英語は1行のまま fitText で縮める
      let name = techLabel(id);
      const chars = [...name];
      if (getLang() === 'ja' && chars.length >= 6) {
        const k = Math.ceil(chars.length / 2);
        name = `${chars.slice(0, k).join('')}
${chars.slice(k).join('')}`;
      }
      const label = this.add.text(x, y, name, textStyle(26, COLORS.ink, { align: 'center' })).setOrigin(0.5);
      fitText(label, ICON - 10);
      parts.push(label);
    }
    const setAlpha = (a) => parts.forEach((p) => p.setAlpha(a));
    const zone = hitZone(this, x, y, ICON, ICON);
    // 押しはこの四角の上で始まったものだけ数える（外で押して滑り込んだ離しは無視）
    let downAt = null;
    let timer = null;
    const release = () => {
      downAt = null;
      timer?.remove(false);
      timer = null;
      setAlpha(1);
    };
    zone.on('pointerdown', () => {
      downAt = this.time.now;
      setAlpha(0.75);
      if (filled && removable) timer = this.time.delayedCall(LONG_PRESS_MS, () => setAlpha(0.45));
    });
    zone.on('pointerout', release);
    zone.on('pointerup', () => {
      if (downAt === null) return;
      const ms = this.time.now - downAt;
      release();
      onPress(classifyPress(ms));
    });
  }
}
