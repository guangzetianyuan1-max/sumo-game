// src/scenes/ResultScene.js — 場所の結果：場所の名前・星の数・勝ち越し／負け越し・優勝・番付の動き・伸びた心技体（経験）
// 締めは取組の順の画面で1度だけ済ませてある（ここは session.lastResult を読むだけ＝読み直しで2度締めない）
import { t, rankLabel, bashoLabel } from '../i18n/i18n.js?v=9';
import { session } from '../state.js?v=9';
import { button, fitText, roundBox, textStyle, statBars, COLORS } from '../ui/widgets.js?v=9';

const STATS = ['shin', 'gi', 'tai'];
const BARS = { x: 80, w: 540 };
const r1 = (v) => Math.round(v * 10) / 10;

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('result');
  }

  create() {
    const r = session.lastResult;
    if (!r || !session.career) {
      this.scene.start(session.career ? 'training' : 'guide');
      return;
    }
    const { summary, basho, before, after } = r;
    const { width } = this.scale;
    const cx = width / 2;
    fitText(this.add.text(cx, 52, t('result.title'), textStyle(56, COLORS.gold)).setOrigin(0.5), width - 80);
    fitText(this.add.text(cx, 118, bashoLabel(basho), textStyle(32, COLORS.ink)).setOrigin(0.5), width - 80);

    // 星の札は中身に合わせる：星の数＋勝ち越し（170〜374）・優勝の時だけ朱の帯のぶん下へ伸ばす（〜510）
    const boxBottom = summary.yusho ? 510 : 374;
    roundBox(this, cx, (170 + boxBottom) / 2, 640, boxBottom - 170, COLORS.panel, { radius: 36, stroke: COLORS.frame });
    fitText(this.add.text(cx, 236, t('result.record', { w: summary.wins, l: summary.losses }), textStyle(88, COLORS.ink)).setOrigin(0.5), 580);
    const kachi = summary.wins > summary.losses;
    fitText(this.add.text(cx, 322, t(kachi ? 'result.kachikoshi' : 'result.makekoshi'), textStyle(44, kachi ? COLORS.gold : COLORS.sub)).setOrigin(0.5), 580);
    if (summary.yusho) {
      // 優勝は朱の帯に大きく
      roundBox(this, cx, 432, 520, 120, COLORS.panelOn, { radius: 60, stroke: COLORS.frame, shadow: false });
      fitText(this.add.text(cx, 432, t('result.yusho'), textStyle(80, COLORS.ink)).setOrigin(0.5), 480);
    }

    // 札の下の行は札の下の端から並べる
    const y0 = boxBottom + 90;
    // 番付の動き（英語は「Maegashira 16 West → Maegashira 15 East」まで長くなる＝枠の幅に縮める）
    fitText(this.add.text(cx, y0, t('result.move', { from: rankLabel(summary.fromPos), to: rankLabel(summary.toPos) }), textStyle(34, COLORS.ink)).setOrigin(0.5), width - 60);

    // 伸びた心技体（場所の経験）：棒は締めた後の値・伸びた分を棒の右に
    fitText(this.add.text(cx, y0 + 112, t('result.exp'), textStyle(30, COLORS.gold)).setOrigin(0.5), width - 80);
    const barsY = y0 + 160;
    statBars(this, BARS.x, barsY, BARS.w, after);
    STATS.forEach((k, i) => {
      const d = r1(after[k] - before[k]);
      if (d <= 0) return;
      this.add.text(BARS.x + BARS.w + 12, barsY + i * 44 + 22, t('train.gain', { n: d }), textStyle(24, COLORS.gold, { fontStyle: '500' })).setOrigin(0, 0.5);
    });

    button(this, cx, 1190, 460, 110, t('result.go'), () => this.scene.start('training'), { size: 38 });
  }
}
