// src/scenes/BanzukeScene.js — 番付：場所の名前と、自分の席の上下5人ずつ（東を左・西を右）。相手は場所の相手から席が近い順
// 番付表の絵（art_in の番付枠）は第4段で入れる。いまは角丸の和紙色の札
import { neighbourRows } from '../core/banzuke.js?v=35';
import { t, rankLabel, shikonaLabel, bashoLabel } from '../i18n/i18n.js?v=35';
import { session, beginBasho } from '../state.js?v=35';
import { button, backButton, saveButton, topTitle, fitText, roundBox, textStyle, COLORS } from '../ui/widgets.js?v=35';

const PAPER = 0xf3e6c8; // 和紙色
const INK_DARK = '#3a2a20'; // 和紙の上の墨
const INK_SOFT = '#7a6a58';
const RULE = 0xc9b48e; // 罫
const BOARD = { x: 360, top: 170, w: 670, maxH: 940 }; // 札の下の端は 1110 まで
const ROW_MAX = 92;
const COL_W = 312;
const COL_X = [360 - 164, 360 + 164]; // 東・西の行の中心

export class BanzukeScene extends Phaser.Scene {
  constructor() {
    super('banzuke');
  }

  create() {
    if (!session.career) {
      this.scene.start('guide');
      return;
    }
    // 10/12 稽古を無くした＝場所は番付の画面で始める（始まっていれば始め直さない）
    const c = beginBasho();
    const { width } = this.scale;
    // 初めの画面へ戻っても場所は消えない（つづきからで取組の順へ戻る）
    backButton(this, () => this.scene.start('guide'));
    saveButton(this);
    topTitle(this, 52, t('banzuke.title'), 56, COLORS.gold, { save: true });
    fitText(this.add.text(width / 2, 118, bashoLabel(c.basho), textStyle(32, COLORS.ink)).setOrigin(0.5), width - 80);

    // 札の高さは行の数に合わせる（最低3行ぶん・下は「取組の順へ」の上まで）
    const rows = neighbourRows(c);
    const { x, top, w } = BOARD;
    const HEAD = 84;
    const rowH = Math.floor(Math.min(ROW_MAX, (BOARD.maxH - HEAD - 16) / rows.length));
    const h = HEAD + Math.max(3, rows.length) * rowH + 16;
    roundBox(this, x, top + h / 2, w, h, PAPER, { radius: 26, stroke: COLORS.frame });
    // 東・西の見出し
    [['rank.east', COL_X[0]], ['rank.west', COL_X[1]]].forEach(([k, cx]) => {
      fitText(this.add.text(cx, top + 40, t(k), textStyle(32, INK_DARK)).setOrigin(0.5), COL_W - 20);
    });
    // 罫は細い四角で引く（線の端に小さな縦のかけらが出ないように）
    const rule = (cx, cy, rw, rh) => this.add.rectangle(Math.round(cx), Math.round(cy), Math.round(rw), Math.round(rh), RULE);
    rule(x, top + 72, w - 32, 2);
    rule(x, top + (16 + h - 16) / 2, 2, h - 32);

    const areaTop = top + HEAD;
    rows.forEach((row, i) => {
      const cy = Math.round(areaTop + rowH * (i + 0.5));
      if (row.east) this.cell(row.east, COL_X[0], cy, rowH - 8);
      if (row.west) this.cell(row.west, COL_X[1], cy, rowH - 8);
      if (i < rows.length - 1) rule(x, areaTop + rowH * (i + 1), w - 32, 2);
    });

    button(this, width / 2, 1190, 460, 110, t('banzuke.go'), () => this.scene.start('schedule'), { size: 38 });
  }

  // 1人の欄：上に番付（小さく）、下にしこ名（左）とタイプ（右）。自分の欄は朱
  cell(e, cx, cy, h) {
    const left = cx - COL_W / 2 + 14;
    const right = cx + COL_W / 2 - 14;
    const inner = COL_W - 28;
    if (e.you) roundBox(this, cx, cy, COL_W - 8, h, COLORS.panelOn, { radius: 14, shadow: false });
    const ink = e.you ? COLORS.ink : INK_DARK;
    const soft = e.you ? COLORS.ink : INK_SOFT;
    const small = Math.round(Math.min(20, h * 0.26));
    const big = Math.round(Math.min(30, h * 0.4));
    fitText(this.add.text(left, Math.round(cy - h * 0.22), rankLabel(e.pos), textStyle(small, soft, { fontStyle: '500' })).setOrigin(0, 0.5), inner);
    const type = this.add.text(right, Math.round(cy + h * 0.18), t(`type.${e.type}.name`), textStyle(small, soft, { fontStyle: '500' })).setOrigin(1, 0.5);
    fitText(type, inner * 0.36);
    fitText(this.add.text(left, Math.round(cy + h * 0.18), shikonaLabel(e.name), textStyle(big, ink)).setOrigin(0, 0.5), inner - type.displayWidth - 10);
  }
}
