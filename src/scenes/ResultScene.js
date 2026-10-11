// src/scenes/ResultScene.js — 場所の結果：場所の名前・星の数・勝ち越し／負け越し・優勝・番付の動き・伸びた心技体（経験）
// 締めは取組の順の画面で1度だけ済ませてある（ここは session.lastResult を読むだけ＝読み直しで2度締めない）
import { t, rankLabel, bashoLabel } from '../i18n/i18n.js?v=22';
import { session } from '../state.js?v=22';
import { recordNote } from '../core/honors.js?v=22';
import { button, backButton, saveButton, topTitle, fitText, roundBox, textStyle, statBars, COLORS } from '../ui/widgets.js?v=22';

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
    // 場所はもう締めてある＝初めの画面へ戻っても2度は締めない（つづきからは稽古へ）
    backButton(this, () => this.scene.start('guide'));
    saveButton(this);
    topTitle(this, 52, t('result.title'), 56, COLORS.gold, { save: true });
    fitText(this.add.text(cx, 118, bashoLabel(basho), textStyle(32, COLORS.ink)).setOrigin(0.5), width - 80);

    // 星の札は中身に合わせる：星の数＋勝ち越し（170〜374）・優勝の時だけ朱の帯のぶん下へ伸ばす（〜510）
    const boxBottom = summary.yusho ? 510 : 374;
    roundBox(this, cx, (170 + boxBottom) / 2, 640, boxBottom - 170, COLORS.panel, { radius: 36, stroke: COLORS.frame });
    fitText(this.add.text(cx, 236, t('result.record', { w: summary.wins, l: summary.losses }), textStyle(88, COLORS.ink)).setOrigin(0.5), 580);
    const kachi = summary.wins > summary.losses;
    // 休場は勝ち越し・負け越しの代わりに「休場」（星は0勝N敗のまま）
    // 全部勝って優勝した時は「全勝優勝」
    const zenshoYusho = summary.yusho && recordNote(summary.wins, summary.losses, summary.wins + summary.losses) === 'zensho';
    const verdict = summary.kyujo ? 'result.kyujo' : zenshoYusho ? 'result.zenshoYusho' : kachi ? 'result.kachikoshi' : 'result.makekoshi';
    fitText(this.add.text(cx, 322, t(verdict), textStyle(44, kachi ? COLORS.gold : COLORS.sub)).setOrigin(0.5), 580);
    if (summary.yusho) {
      // 優勝は朱の帯に大きく
      roundBox(this, cx, 432, 520, 120, COLORS.panelOn, { radius: 60, stroke: COLORS.frame, shadow: false });
      fitText(this.add.text(cx, 432, t('result.yusho'), textStyle(80, COLORS.ink)).setOrigin(0.5), 480);
    }

    // 札の下の行は札の下の端から並べる：金星・三賞の札 → 昇進の知らせ → 番付の動き
    let y = boxBottom + 40;
    const badges = [];
    if (summary.kinboshi > 0) badges.push(summary.kinboshi > 1 ? `${t('award.kinboshi')} ×${summary.kinboshi}` : t('award.kinboshi'));
    (summary.sansho || []).forEach((k) => badges.push(t(`award.${k}`)));
    if (badges.length) y = this.badgeRows(badges, cx, y, width - 80) + 10;
    if (summary.promotion) {
      const promo = this.add.text(cx, y + 10, t(`promo.${summary.promotion}`), textStyle(36, COLORS.gold, {
        align: 'center', wordWrap: { width: width - 80, useAdvancedWrap: true },
      })).setOrigin(0.5, 0);
      y += 10 + promo.height + 26;
    }
    const y0 = Math.max(boxBottom + 90, y + 50);
    // 棒の下の端（y0+292）がボタンの上（1135）に掛かる時は、見出しと棒を詰める（最大60）
    const lift = Math.min(60, Math.max(0, y0 + 292 - 1120));
    // 番付の動き（英語は「Maegashira 16 West → Maegashira 15 East」まで長くなる＝枠の幅に縮める）
    fitText(this.add.text(cx, y0, t('result.move', { from: rankLabel(summary.fromPos), to: rankLabel(summary.toPos) }), textStyle(34, COLORS.ink)).setOrigin(0.5), width - 60);

    // 伸びた心技体（場所の経験）：棒は締めた後の値・伸びた分を棒の右に
    fitText(this.add.text(cx, y0 + 112 - lift, t('result.exp'), textStyle(30, COLORS.gold)).setOrigin(0.5), width - 80);
    const barsY = y0 + 160 - lift;
    statBars(this, BARS.x, barsY, BARS.w, after);
    STATS.forEach((k, i) => {
      const d = r1(after[k] - before[k]);
      if (d <= 0) return;
      this.add.text(BARS.x + BARS.w + 12, barsY + i * 44 + 22, t('train.gain', { n: d }), textStyle(24, COLORS.gold, { fontStyle: '500' })).setOrigin(0, 0.5);
    });

    button(this, cx, 1190, 460, 110, t('result.go'), () => this.scene.start('training'), { size: 38 });
  }

  // 金星・三賞の小さな金の札を、幅 maxW の中に左から詰めて並べる（入らなければ次の段）。段は真ん中にそろえる。下の端を返す
  badgeRows(labels, cx, top, maxW) {
    const H = 48;
    const STEP = 60;
    const GAP = 12;
    const PADX = 18;
    const items = labels.map((str) => {
      const text = this.add.text(0, 0, str, textStyle(24, COLORS.ink)).setOrigin(0.5);
      fitText(text, maxW - 2 * PADX);
      return { text, w: text.displayWidth + 2 * PADX };
    });
    const rows = [[]];
    let used = 0;
    items.forEach((it) => {
      const row = rows[rows.length - 1];
      if (row.length && used + GAP + it.w > maxW) {
        rows.push([it]);
        used = it.w;
      } else {
        used += (row.length ? GAP : 0) + it.w;
        row.push(it);
      }
    });
    rows.forEach((row, r) => {
      const total = row.reduce((s, it) => s + it.w, 0) + GAP * (row.length - 1);
      let x = cx - total / 2;
      const cy = top + H / 2 + r * STEP;
      row.forEach((it) => {
        const box = roundBox(this, x + it.w / 2, cy, it.w, H, COLORS.panel, { radius: H / 2, stroke: COLORS.frame, shadow: false });
        box.setDepth(0);
        it.text.setPosition(x + it.w / 2, cy).setColor(COLORS.gold).setDepth(1);
        x += it.w + GAP;
      });
    });
    return top + H + (rows.length - 1) * STEP;
  }
}
