// src/scenes/StrategyScene.js — 作戦表（設計書 §2）。
// 10/11 本人「技の一押しでどのような技かの図解が出る。長押しで移動ができる。移動先がいっぱいの場合、押されたほうが覚えた手に戻る」
// 押す＝図解の札が開く（段の手も覚えた手も）／長押し＝持ち上げて指（マウス）について来る・離した枠へ置く（規則は core/strategy.js の moveTech）
import { SCENES, ROW, canPlace, scenesOf, moveTech, defaultStrategy } from '../core/strategy.js?v=56';
import { recommendStrategy, effectiveAgainst } from '../core/recommend.js?v=56';
import { TYPES } from '../data/types.js?v=56';
import { KIMARITE } from '../data/kimarite.js?v=56';
import { KIMARITE_DESC_JA } from '../data/kimarite_desc.js?v=56';
import { classifyPress, movedTooFar, LONG_PRESS_MS } from '../ui/press.js?v=56';
import { t, techLabel, getLang } from '../i18n/i18n.js?v=56';
import { session } from '../state.js?v=56';
import {
  button, backButton, fitText, roundBox, hitZone, textStyle, preloadKimariteIndex, loadKimariteArt, COLORS, GROUP_COLOR, clearScene, TOP_LEFT_FREE,
} from '../ui/widgets.js?v=56';

const ICON = 120;
const STEP = 130; // 段の枠の間隔
const ROW_Y = (r) => 305 + r * 180;
const SLOT_X = (i) => 100 + i * STEP;
const KNOWN_TOP = 740; // ここから下（ボタンの上まで）に落とすと「覚えた手へ」
const KNOWN_BOTTOM = 1150;
const MSG_MS = 1800; // 断りの一言を出しておく時間
const ART_W = 560;
const ART_H = 420;

// 日本語の説明を n 字ごとに折る。読点・句点の後ろで折れるときはそこで折る（注釈以外に日本語を書かないので \u で書く）
function wrapChars(str, n) {
  const segs = [];
  let cur = '';
  for (const ch of str) {
    cur += ch;
    if (ch === '\u3001' || ch === '\u3002') {
      segs.push(cur);
      cur = '';
    }
  }
  if (cur) segs.push(cur);
  const lines = [];
  let line = '';
  for (const seg of segs) {
    if ([...line].length + [...seg].length <= n) {
      line += seg;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    for (const ch of seg) {
      if ([...line].length >= n) {
        lines.push(line);
        line = '';
      }
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

export class StrategyScene extends Phaser.Scene {
  constructor() {
    super('strategy');
  }

  preload() {
    preloadKimariteIndex(this);
  }

  create() {
    session.strategy = session.strategy ?? recommendStrategy(this.known(), session.you, session.opp);
    session.oppStrategy = session.oppStrategy ?? defaultStrategy(TYPES[session.opp].sample, session.opp);
    this.msg = '';
    this.msgToken = 0;
    this.press = null; // 押している最中（長押しの時間が来る前）
    this.drag = null; // 持ち上げている最中
    this.popup = null;
    this.glows = [];
    loadKimariteArt(this); // 図解は後から届く（届く前に開いた札は絵なしで出る）

    // 指（マウス）の動きと離しは画面全体で受ける（持ち上げた手は四角の外まで動く）。場面を出る時に外す
    const onMove = (p) => this.onPointerMove(p);
    const onUp = (p) => this.onPointerUp(p);
    const onUpOutside = (p) => this.onPointerUp(p, true);
    this.input.on('pointermove', onMove);
    this.input.on('pointerup', onUp);
    this.input.on('pointerupoutside', onUpOutside);
    this.events.once('shutdown', () => {
      this.input.off('pointermove', onMove);
      this.input.off('pointerup', onUp);
      this.input.off('pointerupoutside', onUpOutside);
    });
    this.draw();
  }

  redraw() {
    this.time.delayedCall(0, () => this.draw()); // 押しの最中に四角を消さない
  }

  // 断りの一言を金の字で少しのあいだ出す
  flash(msg) {
    this.msg = msg;
    const token = ++this.msgToken;
    this.time.delayedCall(MSG_MS, () => {
      if (token !== this.msgToken) return;
      this.msg = '';
      if (!this.drag && !this.popup) this.draw(); // 持ち上げ中・札を開いている時は消さない（次の描き直しで消える）
    });
  }

  draw() {
    this.cancelPress();
    this.drag = null;
    this.popup = null;
    this.glows.forEach((tw) => tw.remove());
    this.glows = [];
    clearScene(this);
    const { width } = this.scale;
    backButton(this, () => this.scene.start('opponent')); // 作戦表の手直しは残る
    // 見出しは「もどる」と「お勧めに戻す」（左の端 390）の間
    fitText(this.add.text(TOP_LEFT_FREE, 26, t('strat.title'), textStyle(48, COLORS.gold)), 390 - 12 - TOP_LEFT_FREE);
    // 相手に合わせたお勧めへ作戦表を戻す（手直しは消える）
    button(this, width - 180, 48, 300, 52, t('strat.recommend'), () => {
      session.strategy = recommendStrategy(this.known(), session.you, session.opp);
      this.msg = '';
      this.redraw();
    }, { color: COLORS.buttonSub, size: 24 });
    fitText(this.add.text(30, 78, t('strat.today', { type: t(`type.${session.opp}.name`) }), textStyle(32, COLORS.ink)), width - 60);
    fitText(this.add.text(30, 116, t(`type.${session.opp}.strong`), textStyle(22, COLORS.sub, { fontStyle: '500' })), width - 60);
    fitText(this.add.text(30, 142, t('strat.oppWeak', { weak: t(`type.${session.opp}.weak`) }), textStyle(22, COLORS.sub, { fontStyle: '500' })), width - 60);
    fitText(this.add.text(30, 170, t('strat.hint'), textStyle(24, COLORS.gold, { fontStyle: '500' })), width - 60);

    SCENES.forEach((sc, r) => {
      const y = ROW_Y(r);
      this.add.text(30, y - 104, t(`scene.${sc}`), textStyle(32, COLORS.gold));
      for (let i = 0; i < ROW; i++) {
        const id = session.strategy[sc][i];
        const parts = this.tile(SLOT_X(i), y, id);
        if (id) this.pressable(SLOT_X(i), y, id, { scene: sc, index: i }, parts);
      }
    });

    fitText(this.add.text(30, 760, t('strat.known'), textStyle(30, COLORS.ink)), width - 60);
    // 10/12 覚えた手（一代記の known）。10手までは5列・11手から（節目で覚えて増える・最大21手）は小さい札で7列×3段
    const known = this.known();
    const big = known.length <= 10;
    const L = big ? { cols: 5, size: ICON, step: STEP, x0: 100, y0: 870, dy: 135 } : { cols: 7, size: 84, step: 92, x0: 84, y0: 842, dy: 92 };
    known.forEach((id, k) => {
      const x = L.x0 + (k % L.cols) * L.step;
      const y = L.y0 + Math.floor(k / L.cols) * L.dy;
      if (effectiveAgainst(id, session.opp)) this.glow(x, y, L.size); // 今日の相手に効く手は周りが光る（四角と押し当たりより下に描く）
      const parts = this.tile(x, y, id, L.size);
      this.pressable(x, y, id, null, parts, L.size);
    });

    if (this.msg) fitText(this.add.text(width / 2, 1115, this.msg, textStyle(30, COLORS.gold)).setOrigin(0.5), width - 60);
    // 「もどる」は左上へ移した＝「取組へ」は真ん中に大きく（ほかの画面の決めのボタンと同じ大きさ）
    button(this, width / 2, 1205, 460, 110, t('strat.go'), () => this.scene.start('bout'), { size: 38 });
  }

  // 覚えた手：一代記の known（10/12）。一代記が無い時はタイプの見本の手
  known() {
    return session.run?.known ?? TYPES[session.you].sample;
  }

  // 金の縁を四角の少し外側に描き、ゆっくり明滅させる（押し当たりは持たない）
  glow(x, y, size = ICON) {
    const g = this.add.graphics();
    const w = size + 14;
    g.lineStyle(6, COLORS.frame, 1);
    g.strokeRoundedRect(x - w / 2, y - w / 2, w, w, 26);
    g.setAlpha(0.4);
    this.glows.push(this.tweens.add({ targets: g, alpha: 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
  }

  // 手の四角を描く（x, y を中心に）。描いた部品の並びを返す（持ち上げた写しにも使う）
  tile(x, y, id, size = ICON) {
    const filled = Boolean(id);
    const parts = [];
    parts.push(roundBox(this, x, y, size, size, filled ? GROUP_COLOR[KIMARITE[id].group] : COLORS.empty, {
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
      const label = this.add.text(x, y, name, textStyle(Math.round(26 * size / ICON), COLORS.ink, { align: 'center' })).setOrigin(0.5);
      fitText(label, size - 10);
      parts.push(label);
    }
    return parts;
  }

  // 押し当たり。押しはこの四角の上で始まったものだけ数える。離し・動きは画面全体で受ける（onPointerMove / onPointerUp）
  // from＝段の中なら { scene, index }・覚えた手なら null
  pressable(x, y, id, from, parts, size = ICON) {
    const zone = hitZone(this, x, y, size, size);
    zone.on('pointerdown', (p) => {
      if (this.press || this.drag || this.popup) return;
      const setAlpha = (a) => parts.forEach((o) => o.setAlpha(a));
      setAlpha(0.75);
      this.press = {
        id, from, setAlpha, pointerId: p.id, x0: p.x, y0: p.y, downAt: this.time.now,
        timer: this.time.delayedCall(LONG_PRESS_MS, () => this.pickUp(p)),
      };
    });
  }

  cancelPress() {
    if (!this.press) return;
    this.press.timer.remove(false);
    this.press.setAlpha(1);
    this.press = null;
  }

  // 長押しの時間が来た：手を持ち上げる（写しが指について来る・置ける枠を照らす）
  pickUp(p) {
    const press = this.press;
    if (!press) return;
    this.press = null;
    press.setAlpha(press.from ? 0.3 : 1); // 段から持ち上げたら元の場所は薄く・覚えた手はそのまま残る
    const ghost = this.add.container(p.x, p.y, this.tile(0, 0, press.id)).setDepth(500).setScale(1.08).setAlpha(0.92);
    const marks = this.add.graphics().setDepth(400);
    const hover = this.add.graphics().setDepth(401);
    this.drag = { id: press.id, from: press.from, pointerId: press.pointerId, ghost, marks, hover, setAlpha: press.setAlpha };
    // 置ける枠は金の縁・置けない段は暗く
    SCENES.forEach((sc, r) => {
      const ok = canPlace(press.id, sc);
      for (let i = 0; i < ROW; i++) {
        const x = SLOT_X(i) - ICON / 2;
        const y = ROW_Y(r) - ICON / 2;
        if (ok) {
          marks.lineStyle(4, COLORS.frame, 0.9);
          marks.strokeRoundedRect(x - 4, y - 4, ICON + 8, ICON + 8, 22);
        } else {
          marks.fillStyle(0x000000, 0.55);
          marks.fillRoundedRect(x, y, ICON, ICON, 20);
        }
      }
    });
    this.showHover(p);
  }

  // 指の下の落とし先：段の枠 { scene, index }・覚えた手 'learned'・どこでもない null
  dropTarget(x, y) {
    for (let r = 0; r < SCENES.length; r++) {
      if (Math.abs(y - ROW_Y(r)) <= 85 && x >= 20 && x <= 700) {
        const index = Math.max(0, Math.min(ROW - 1, Math.round((x - SLOT_X(0)) / STEP)));
        return { scene: SCENES[r], index };
      }
    }
    if (y >= KNOWN_TOP && y <= KNOWN_BOTTOM) return 'learned';
    return null;
  }

  showHover(p) {
    const d = this.drag;
    d.ghost.setPosition(p.x, p.y);
    d.hover.clear();
    const to = this.dropTarget(p.x, p.y);
    if (to && to !== 'learned' && canPlace(d.id, to.scene)) {
      const x = SLOT_X(to.index) - ICON / 2;
      const y = ROW_Y(SCENES.indexOf(to.scene)) - ICON / 2;
      d.hover.fillStyle(COLORS.frame, 0.3);
      d.hover.fillRoundedRect(x - 4, y - 4, ICON + 8, ICON + 8, 22);
      d.hover.lineStyle(6, COLORS.frame, 1);
      d.hover.strokeRoundedRect(x - 4, y - 4, ICON + 8, ICON + 8, 22);
    } else if (to === 'learned' && d.from) {
      // 段から覚えた手の所へ持って来た＝離すと段から外れる
      d.hover.lineStyle(4, COLORS.frame, 0.8);
      d.hover.strokeRoundedRect(20, KNOWN_TOP, 680, KNOWN_BOTTOM - KNOWN_TOP - 30, 24);
    }
  }

  onPointerMove(p) {
    if (this.drag) {
      if (p.id === this.drag.pointerId) this.showHover(p);
      return;
    }
    const press = this.press;
    if (press && p.id === press.pointerId && movedTooFar(p.x - press.x0, p.y - press.y0)) this.cancelPress();
  }

  onPointerUp(p, outside = false) {
    const press = this.press;
    if (press && p.id === press.pointerId) {
      const ms = this.time.now - press.downAt;
      this.cancelPress();
      if (!outside && classifyPress(ms) === 'tap') this.openDetail(press.id);
      return;
    }
    const d = this.drag;
    if (!d || p.id !== d.pointerId) return;
    const to = outside ? null : this.dropTarget(p.x, p.y);
    const res = moveTech(session.strategy, { id: d.id, from: d.from, to });
    this.drag = null; // 描き直すまで次の押しを受けない（redraw で全部作り直す）
    d.ghost.setVisible(false);
    d.marks.clear();
    d.hover.clear();
    if (res.ok) {
      session.strategy = res.strategy;
      if (res.returned) this.flash(t('strat.returned', { name: techLabel(res.returned) }));
      else this.msg = '';
    } else if (res.reason === 'scene') {
      this.flash(t('strat.noscene'));
    } else if (res.reason === 'dup') {
      this.flash(t('strat.dup'));
    }
    this.redraw();
  }

  // 図解の札：絵（あれば）・名前・組・使える場面・説明。どこを押しても閉じる。開いている間は下の物は反応しない
  openDetail(id) {
    const k = KIMARITE[id];
    if (!k || this.popup) return;
    const { width, height } = this.scale;
    const D = 1000;
    const W = 620;
    const inner = W - 60;
    const cx = width / 2;
    const objs = [];
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.65).setOrigin(0).setDepth(D).setInteractive();
    objs.push(overlay);

    // 中身を上から積む（高さが決まってから札の箱を敷いて、全体を縦の真ん中へ寄せる）
    const rows = []; // { obj, gap }
    const key = `kim-${id}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(cx, 0, key).setOrigin(0.5, 0);
      img.setScale(Math.min(ART_W / img.width, ART_H / img.height));
      rows.push({ obj: img, gap: 20 });
    }
    const text = (str, size, color, extra = {}) => this.add.text(cx, 0, str, textStyle(size, color, { align: 'center', ...extra })).setOrigin(0.5, 0);
    rows.push({ obj: fitText(text(techLabel(id), 46, COLORS.gold), inner), gap: 8 });
    rows.push({ obj: fitText(text(t(`group.${k.group}`), 24, COLORS.sub, { fontStyle: '500' }), inner), gap: 6 });
    const scenes = scenesOf(id).map((sc) => t(`scene.${sc}`)).join(t('strat.sceneSep'));
    rows.push({ obj: fitText(text(t('strat.usable', { scenes }), 24, COLORS.ink, { fontStyle: '500' }), inner), gap: 22 });
    const ja = getLang() === 'ja';
    const desc = ja ? wrapChars(KIMARITE_DESC_JA[id] ?? k.en, 17) : k.en;
    const descText = text(desc, 30, COLORS.ink, { fontStyle: '500', lineSpacing: 8, ...(ja ? {} : { wordWrap: { width: inner } }) });
    rows.push({ obj: fitText(descText, inner), gap: 26 });
    rows.push({ obj: fitText(text(t('strat.close'), 22, COLORS.sub, { fontStyle: '500' }), inner), gap: 0 });

    const PAD = 36;
    const contentH = rows.reduce((s, r) => s + r.obj.displayHeight + r.gap, 0);
    const h = contentH + PAD * 2;
    const top = Math.max(20, (height - h) / 2);
    const box = roundBox(this, cx, top + h / 2, W, h, COLORS.panel, { radius: 30, stroke: GROUP_COLOR[k.group] }).setDepth(D + 1);
    objs.push(box);
    let y = top + PAD;
    rows.forEach((r) => {
      r.obj.setY(y).setDepth(D + 2);
      objs.push(r.obj);
      y += r.obj.displayHeight + r.gap;
    });

    // 押して離したら閉じる（開いた時の離しでは閉じない＝押しはこの暗幕の上で始まったものだけ数える）
    let down = false;
    overlay.on('pointerdown', () => {
      down = true;
    });
    overlay.on('pointerup', () => {
      if (!down) return;
      this.time.delayedCall(0, () => this.closeDetail());
    });
    this.popup = { objs };
  }

  closeDetail() {
    if (!this.popup) return;
    this.popup.objs.forEach((o) => o.destroy());
    this.popup = null;
    this.draw(); // 札を開いている間に時間の切れた一言を消す（描き直しは安い）
  }
}
