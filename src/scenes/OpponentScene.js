// src/scenes/OpponentScene.js — 今日の相手の情報（しこ名・番付・タイプの絵・得意・弱み・心技体）と、案内役の女子のひとこと。作戦表の前に見せる
// 相手は一代記の場所の今日の相手（currentOpponent）。作戦表は prepareOpponent が組む（同じ相手に戻った時は組み直さない）
import { TYPES } from '../data/types.js?v=27';
import { boutStats } from '../core/career.js?v=27';
import { SCENES } from '../core/strategy.js?v=27';
import { recommendStrategy, recommendReason } from '../core/recommend.js?v=27';
import { adviceKeys } from '../core/advice.js?v=27';
import { t, techLabel, rankLabel, shikonaLabel, getLang } from '../i18n/i18n.js?v=27';
import { session, prepareOpponent } from '../state.js?v=27';
import { button, backButton, topTitle, fitText, roundBox, textStyle, statBars, bubbleText, preloadTypeArt, preloadGuideArt, COLORS } from '../ui/widgets.js?v=27';

const ART_H = 240;
const ART_Y = 285; // 絵の札の中心（札は 140〜430）
const FACE_W = 140;
const BUBBLE = { x: 200, y: 872, w: 480, h: 232 }; // 吹き出し（左上・幅・高さ）

export class OpponentScene extends Phaser.Scene {
  constructor() {
    super('opponent');
  }

  preload() {
    preloadTypeArt(this);
    preloadGuideArt(this);
  }

  create() {
    const { width } = this.scale;
    // 今日の相手から、相手の作戦表と自分のお勧めを組む（作戦表の画面と取組で同じものを使う）
    this.foe = prepareOpponent();
    if (!this.foe) {
      this.scene.start(session.career ? 'schedule' : 'guide');
      return;
    }
    const opp = session.opp;

    backButton(this, () => this.scene.start('schedule')); // 同じ相手にもう一度来ても作戦表は組み直さない（prepareOpponent）
    topTitle(this, 44, t('opp.title'), 50, COLORS.gold);
    fitText(this.add.text(width / 2, 104, t('career.who', { name: shikonaLabel(this.foe.name), rank: rankLabel(this.foe.pos) }), textStyle(36, COLORS.ink)).setOrigin(0.5), width - 80);
    roundBox(this, width / 2, ART_Y, 640, 290, COLORS.panel, { radius: 36, stroke: COLORS.frame });
    this.add.circle(width / 2, ART_Y, 125, 0x2a3456);
    const key = `type-${opp}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(width / 2, ART_Y, key);
      img.setScale(ART_H / img.height);
      img.setFlipX(true); // 自分のほうを向く
    }

    const line = (y, str, size, color, extra) => fitText(this.add.text(width / 2, y, str, textStyle(size, color, extra)).setOrigin(0.5), width - 80);
    line(468, t(`type.${opp}.name`), 48, COLORS.ink);
    line(514, t('opp.strong', { x: t(`type.${opp}.strong`) }), 26, COLORS.ink, { fontStyle: '500' });
    line(548, t('strat.oppWeak', { weak: t(`type.${opp}.weak`) }), 26, COLORS.sub, { fontStyle: '500' });
    line(582, t('opp.moves', { moves: this.favourites().map((id) => techLabel(id)).join(' / ') }), 26, COLORS.gold, { fontStyle: '500' });

    this.drawStats(width);
    this.drawAdvice();

    button(this, width / 2, 1190, 460, 110, t('opp.go'), () => this.scene.start('strategy'), { size: 38 });
  }

  // 心・技・体：左があなた・右が相手（今日の相手の値）。10/12 疲れと調子を無くした
  drawStats(width) {
    const colW = 300;
    const xs = [width / 2 - colW - 20, width / 2 + 20];
    [[xs[0], 'stat.you', boutStats(session.career)], [xs[1], 'stat.opp', this.foe.stats]].forEach(([x, head, stats]) => {
      const title = this.add.text(x + colW / 2, 640, t(head), textStyle(28, COLORS.gold)).setOrigin(0.5);
      fitText(title, colW - 20);
      statBars(this, x, 664, colW, stats);
    });
  }

  // 案内役の顔（左）と吹き出し（右）。お勧めの手は recommendStrategy から
  drawAdvice() {
    const guide = session.guide ?? 'chizuru';
    const rec = recommendStrategy(session.career.known, session.you, session.opp); // 10/12 覚えた手から
    const moves = recommendReason(rec).moves.map((id) => techLabel(id)).join(t('advice.join'));
    // 2行：相手の弱み（性格ごとの言い方）と、力の比べか疲れの一言（10/11 本人「すずはイケイケ、琴音は慎重、千鶴は中間」）
    // 琴音の英語は文の途中に弱み・強みが入る＝頭の大文字を小文字にする
    const mid = getLang() === 'en' && guide === 'kotone' ? (s) => s.charAt(0).toLowerCase() + s.slice(1) : (s) => s;
    const text = {
      type: t(`type.${session.opp}.name`), weak: mid(t(`type.${session.opp}.weak`)), strong: mid(t(`type.${session.opp}.strong`)), moves,
    };
    const sum = (s) => s.shin + s.gi + s.tai;
    const lines = adviceKeys(guide, {
      oppType: session.opp, mySum: sum(boutStats(session.career)), oppSum: sum(this.foe.stats), condition: 'good', text,
    });
    const str = lines.map((l) => t(l.key, l.params)).join('\n');

    const { x, y, w, h } = BUBBLE;
    const faceKey = `guide-${guide}`;
    if (this.textures.exists(faceKey)) {
      const img = this.add.image(FACE_W / 2 + 40, y + h / 2, faceKey);
      img.setScale(FACE_W / img.width);
    }
    roundBox(this, x + w / 2, y + h / 2, w, h, COLORS.panel, { radius: 28, stroke: COLORS.frame });
    // 吹き出しのしっぽ（顔のほうへ）
    const tail = this.add.graphics();
    tail.fillStyle(COLORS.panel, 1);
    tail.fillTriangle(x + 3, y + h / 2 - 16, x + 3, y + h / 2 + 16, x - 18, y + h / 2);
    tail.lineStyle(3, COLORS.frame, 1);
    tail.lineBetween(x, y + h / 2 - 16, x - 18, y + h / 2);
    tail.lineBetween(x - 18, y + h / 2, x, y + h / 2 + 16);

    // 吹き出しに収まるまで字を一段ずつ小さくする
    bubbleText(this, x + w / 2, y + h / 2, str, { w: w - 48, h: h - 36 }, { size: 30, min: 16, lineSpacing: 8 });
  }

  // 相手の作戦表を 立ち合い → 中 → 土俵際 の順に見て、重ならない手を3つ
  favourites() {
    const out = [];
    for (const sc of SCENES) {
      for (const id of session.oppStrategy[sc]) {
        if (id && !out.includes(id)) out.push(id);
        if (out.length === 3) return out;
      }
    }
    return out;
  }
}
