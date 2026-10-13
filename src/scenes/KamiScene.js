// src/scenes/KamiScene.js — 紙相撲の取組（10/13 本人「紙相撲に切り替える」・設計書 2026-10-13-sumo-kamizumo-design.md）
// 箱の上の紙の土俵に型紙2枚。画面をたたくと主人公（東・左）が跳ねて前へ。敵（西・右）は機械がたたく。箱から落ちた方の負け
// 動きの計算は src/core/kami.js（画面から切り離してある）。この画面は描くのと、指を計算へ渡すだけ
// 指：立っている時＝触れた瞬間を1回のたたき（押したままでは連打にならない）／倒れている時＝押している間を長押し
// 終わったら 0.8秒そのまま見せ、勝ち負けを出して recordNow を1回だけ・1.2秒後に取組の後（after）へ
import { KAMI, newBout, step, tap, hold, beatOffset, gaugeLit } from '../core/kami.js?v=31';
import { fighterParams, cpuParams, driver } from '../core/kamiai.js?v=31';
import { kimariteOf } from '../core/kamiresult.js?v=31';
import { foeArt, kamiArt, heroArt, stageAura, stageScale } from '../core/foeart.js?v=31';
import { currentFoe, foeStats } from '../core/run.js?v=31';
import { makeRng } from '../core/rng.js?v=31';
import { HERO_TYPE } from '../data/heroes.js?v=31';
import { t, foeLabel, techLabel } from '../i18n/i18n.js?v=31';
import { session, prepareOpponent, boutSeed, recordNow } from '../state.js?v=31';
import { playBout } from '../ui/sfx.js?v=31';
import { preloadHeroFigures, addAura, textStyle, fitText, COLORS } from '../ui/widgets.js?v=31';

const GROUND = 820; // 箱の上の面（画面の y）
const FIG_H = 230; // 型紙の高さ（敵は段階の倍率を掛ける）
const HOP_DRAW = 3; // 跳ねの高さは計算の3倍で描く（計算の跳ねは低い・Ruling 6）
const BEAT_Y = GROUND + 48; // 拍の丸（主人公の足もとの下・箱の前の面）
const GAUGE_Y = GROUND - FIG_H - 70; // 決め技の金の帯（主人公の頭の上）
const STAND_Y = GROUND - 130; // 起き上がりのゲージ（倒れた主人公のすぐ上・箱の面の近く）
const STAND_BACK = 100; // 倒れた型紙は足もとから後ろへ寝る＝ゲージはその真ん中の上へ
const DOUBLE_MS = 60; // 同じ指の二度押しは数えない
const SHOW_FALL = 0.8; // 落ちていく型紙をそのまま見せる長さ（秒）
const TO_AFTER_MS = 1200; // 勝ち負けを出してから取組の後へ
const HERO_FILE = `hero_${HERO_TYPE}`;
const SIDES = ['east', 'west'];

export class KamiScene extends Phaser.Scene {
  constructor() {
    super('kami');
  }

  preload() {
    preloadHeroFigures(this); // 型紙が無い時の主人公の代わり
    const load = (a) => { if (!this.textures.exists(a.key)) this.load.image(a.key, a.path); };
    load(kamiArt(HERO_FILE));
    const foe = session.run ? currentFoe(session.run) : null;
    if (foe) {
      const a = foeArt(foe);
      load(kamiArt(a.file));
      load(a); // 型紙が無い時の敵の代わり（今の立ち絵）
    }
  }

  create() {
    const run = session.run;
    if (!run) { this.scene.start('guide'); return; }
    const foe = prepareOpponent();
    if (!foe) { this.scene.start('ladder'); return; }
    this.foe = foe;
    const seed = boutSeed();
    this.st = newBout({
      east: fighterParams(run.stats, HERO_TYPE),
      west: { ...fighterParams(foeStats(foe.type, foe.index), foe.type), canFinish: cpuParams(foe.index).finisher },
      seed,
    });
    this.cpu = driver(cpuParams(foe.index), makeRng(seed ^ 0x9e3779b9));
    this.lastDown = -Infinity; // 前に指が触れた時（ms）
    this.wasDown = false; // 1コマ前に主人公が倒れていたか
    this.prev = { east: { y: 0 }, west: { y: 0 }, gap: Infinity, finisherAt: -Infinity };
    this.lastThud = -Infinity;
    this.doneT = -1; // 終わってからの秒（終わる前は −1）
    this.recorded = false;
    this.leaving = false;
    this.fall = null; // 終わった後の、落ちていく型紙の見た目だけの動き

    const { width } = this.scale;
    this.cx = width / 2;
    this.drawBox(width);

    // 上：見出しと相手の名前
    fitText(this.add.text(width / 2, 70, t('kami.title'), textStyle(52, COLORS.gold)).setOrigin(0.5), width - 80);
    fitText(this.add.text(width / 2, 132, foeLabel(foe), textStyle(34, COLORS.ink)).setOrigin(0.5), width - 80);

    // 型紙2枚（足もとが計算の x・箱の面からの高さ）と足もとの影
    this.shadows = {};
    this.figs = {};
    SIDES.forEach((side) => {
      this.shadows[side] = this.add.ellipse(0, GROUND + 2, 120, 16, 0x000000, 0.3);
    });
    this.figs.east = this.figure(kamiArt(HERO_FILE).key, heroArt(HERO_TYPE).key, FIG_H);
    this.figs.west = this.figure(kamiArt(foeArt(foe).file).key, foeArt(foe).key, FIG_H * stageScale(foe.stage));
    if (this.figs.west) addAura(this, this.figs.west, stageAura(foe.stage));

    // 拍の丸（主人公の足もとの下）
    this.beat = this.add.circle(this.st.f.east.x, BEAT_Y, 26, 0xffd98a, 0.15).setStrokeStyle(4, 0xffd98a, 0.8);
    // 起き上がりのゲージ（倒れている間）と決め技の金の帯（光っている間）
    this.standBg = this.add.rectangle(0, STAND_Y, 180, 22, 0x000000, 0.5).setStrokeStyle(3, 0xf6efe2, 0.9).setVisible(false);
    this.standBar = this.add.rectangle(0, STAND_Y, 170, 16, 0x9cf0b4, 1).setOrigin(0, 0.5).setVisible(false);
    this.finishBand = this.add.rectangle(0, GAUGE_Y, 240, 56, 0xe3c27a, 0.9).setStrokeStyle(4, 0xfff3c4, 1).setVisible(false);
    this.finishText = fitText(this.add.text(0, GAUGE_Y, t('kami.finish'), textStyle(34, '#3b2810')).setOrigin(0.5), 228).setVisible(false);

    // はっけよい・勝ち負け（大きく）・下の案内の1行
    this.call = this.add.text(width / 2, 330, t('kami.hakkeyoi'), textStyle(72, COLORS.gold, { stroke: '#141a2e', strokeThickness: 8 })).setOrigin(0.5).setVisible(false);
    fitText(this.call, width - 60);
    this.banner = this.add.text(width / 2, 420, '', textStyle(110, COLORS.gold, { stroke: '#141a2e', strokeThickness: 10 })).setOrigin(0.5).setDepth(10);
    this.kimarite = this.add.text(width / 2, 520, '', textStyle(46, COLORS.ink, { stroke: '#141a2e', strokeThickness: 6 })).setOrigin(0.5).setDepth(10);
    this.hint = this.add.text(width / 2, 1160, '', textStyle(36, COLORS.ink)).setOrigin(0.5);
    this.hintKey = null;

    // 指：触れた瞬間に1回だけ（押したままでは連打しない）。倒れている時は押している間を長押し
    this.input.on('pointerdown', () => this.press());
    this.input.on('pointerup', () => this.release());
    this.input.on('pointerupoutside', () => this.release());
    // 画面が裏へ回ったら長押しを離す（戻った時に勝手に起き上がらない）
    const onHidden = () => this.release();
    this.game.events.on('hidden', onHidden);
    this.events.once('shutdown', () => this.game.events.off('hidden', onHidden));

    this.draw();
  }

  // 型紙が無ければ今の立ち絵、それも無ければ置かない
  figure(key, fallback, h) {
    const k = this.textures.exists(key) ? key : this.textures.exists(fallback) ? fallback : null;
    if (!k) return null;
    const img = this.add.image(0, GROUND, k).setOrigin(0.5, 1);
    img.setScale(h / img.height);
    return img;
  }

  // 箱（段ボール）の前の面と上の面・紙の土俵・俵・仕切り線・箱の前の字（試作 prototype/kamizumo.html と同じ形）
  drawBox(width) {
    const { BOX, RING } = KAMI;
    const g = this.add.graphics();
    g.fillStyle(0x8a6a3c, 1).fillRect(BOX.l, GROUND, BOX.r - BOX.l, 240);
    g.fillStyle(0xb08a52, 1).fillRect(BOX.l - 10, GROUND - 8, BOX.r - BOX.l + 20, 16);
    g.fillStyle(0xe8d6a6, 1).fillRect(RING.l - 30, GROUND - 6, RING.r - RING.l + 60, 8);
    g.fillStyle(0x6d4a1f, 1).fillRect(RING.l - 8, GROUND - 14, 16, 12).fillRect(RING.r - 8, GROUND - 14, 16, 12);
    g.fillStyle(0xffffff, 0.9).fillRect(width / 2 - 40, GROUND - 4, 6, 4).fillRect(width / 2 + 34, GROUND - 4, 6, 4);
    const box = this.add.text(width / 2, GROUND + 150, t('kami.box'), textStyle(56, '#3b2810')).setOrigin(0.5).setAlpha(0.6);
    fitText(box, BOX.r - BOX.l - 60);
  }

  press() {
    const st = this.st;
    if (!st || st.phase === 'done') return;
    const now = this.time.now;
    if (now - this.lastDown < DOUBLE_MS) return; // 同じ指の二度押し
    this.lastDown = now;
    if (st.f.east.down) hold(st, 'east', true);
    else tap(st, 'east');
  }

  release() {
    if (this.st) hold(this.st, 'east', false);
  }

  update(time, delta) {
    const st = this.st;
    if (!st) return;
    const dt = Math.min(delta / 1000, KAMI.MAX_DT);
    if (st.phase !== 'done') {
      this.cpu.tick(st, 'west', dt);
      step(st, dt);
      // 起き上がったら長押しを切る（指を離さないまま次に倒れても、押し直すまで起きない）
      if (this.wasDown && !st.f.east.down) hold(st, 'east', false);
      this.wasDown = st.f.east.down;
      this.sounds();
    } else {
      this.afterDone(dt);
    }
    this.draw();
  }

  // 着地＝ぱん・ぶつかり＝どん・決め技＝シャキーン
  sounds() {
    const st = this.st;
    SIDES.forEach((side) => {
      const f = st.f[side];
      if (this.prev[side].y > 0 && f.y === 0 && !f.fell) playBout('slap', side === 'east' ? 0.4 : 0.25);
      this.prev[side].y = f.y;
    });
    const e = st.f.east, w = st.f.west;
    const gap = w.x - e.x - (e.w + w.w) / 2;
    if (gap <= 0.5 && this.prev.gap > 0.5 && st.t - this.lastThud > 0.15) { playBout('thud', 0.6); this.lastThud = st.t; }
    this.prev.gap = gap;
    if (st.finisherAt !== this.prev.finisherAt) { playBout('kumi'); this.prev.finisherAt = st.finisherAt; }
  }

  // 終わった後：落ちた型紙は見た目だけ落ち続ける（計算はもう動かさない）→ 0.8秒で勝ち負け → 1.2秒後に取組の後へ
  afterDone(dt) {
    const st = this.st;
    if (this.doneT < 0) {
      this.doneT = 0;
      this.fall = {};
      SIDES.forEach((side) => {
        const f = st.f[side];
        if (f.fell) this.fall[side] = { x: f.x, y: f.y, vx: f.vx, vy: f.vy, a: f.a, va: (f.a >= 0 ? 1 : -1) * 2.5 };
        else this.fall[side] = { x: f.x, y: f.y, vx: 0, vy: Math.min(f.vy, 0), a: f.a, va: 0, settle: true }; // 勝った側は宙に浮いたままにせず、箱の面へ降りる（見た目だけ）
      });
    }
    this.doneT += dt;
    Object.keys(this.fall).forEach((side) => {
      const v = this.fall[side];
      v.vy -= KAMI.G * dt;
      v.x += v.vx * dt;
      v.y += v.vy * dt;
      v.a += v.va * dt;
      if (v.settle && v.y <= 0) { v.y = 0; v.vy = 0; }
    });
    if (this.doneT >= SHOW_FALL && !this.recorded) {
      this.recorded = true;
      const won = st.winner === 'east';
      const kimarite = kimariteOf(st);
      this.banner.setText(t(won ? 'kami.win' : 'kami.lose')).setColor(won ? COLORS.gold : COLORS.ink);
      fitText(this.kimarite.setText(t('bout.kimarite', { tech: techLabel(kimarite) })), this.scale.width - 60);
      recordNow(won, kimarite);
      this.time.delayedCall(TO_AFTER_MS, () => {
        if (this.leaving) return;
        this.leaving = true;
        this.scene.start('after');
      });
    }
  }

  draw() {
    const st = this.st;
    const e = st.f.east;
    SIDES.forEach((side) => {
      const f = st.f[side];
      const v = this.fall && this.fall[side] ? this.fall[side] : f;
      const lift = v.y > 0 ? v.y * HOP_DRAW : v.y; // 跳ねは3倍で見せる・箱から落ちる所はそのまま
      const img = this.figs[side];
      if (img) {
        img.setPosition(v.x, GROUND - lift);
        img.setRotation(-f.dir * v.a); // 反る向き（＋）が自分の後ろになるように
      }
      // 影：箱の上にいる間だけ・高く跳ねるほど小さく薄く
      const sh = this.shadows[side];
      const onBox = v.x >= KAMI.BOX.l && v.x <= KAMI.BOX.r && v.y > KAMI.FALL_Y;
      const k = Math.max(0.4, 1 - Math.max(0, lift) / 200);
      sh.setPosition(v.x, GROUND + 2).setScale(k, 1).setAlpha(onBox ? 0.3 * k + 0.05 : 0);
    });

    // 拍の丸：合図の前は暗く・合図で金色・取組の間は拍のたびに明るく
    this.beat.x = e.x;
    if (st.phase === 'ready') {
      const go = st.t >= st.signalAt;
      this.beat.setFillStyle(go ? 0xffc83d : 0xffd98a, go ? 1 : 0.12).setScale(go ? 1.35 : 1);
    } else if (st.phase === 'push') {
      const on = beatOffset(st) < 0.09;
      this.beat.setFillStyle(0xffd98a, on ? 0.95 : 0.15).setScale(on ? 1.2 : 1);
    } else {
      this.beat.setFillStyle(0xffd98a, 0.1).setScale(1);
    }
    // はっけよい：合図から、ぶつかって少しの間
    this.call.setVisible(st.t >= st.signalAt && st.t < st.signalAt + 1.2 && st.phase !== 'done');

    // 起き上がりのゲージ
    const down = st.phase === 'push' && e.down;
    const sx = e.x - e.dir * STAND_BACK;
    this.standBg.setVisible(down).setPosition(sx, STAND_Y);
    this.standBar.setVisible(down).setPosition(sx - 85, STAND_Y);
    if (down) this.standBar.setScale(Math.min(1, e.standHeld / e.standTime), 1);
    // 決め技の金の帯
    const lit = gaugeLit(st, 'east');
    this.finishBand.setVisible(lit).setPosition(e.x, GAUGE_Y);
    this.finishText.setVisible(lit).setPosition(e.x, GAUGE_Y);

    // 下の案内（変わった時だけ書き直す）
    let key = null;
    if (st.phase === 'ready') key = 'kami.hint.ready';
    else if (st.phase === 'push') key = e.down ? 'kami.hint.down' : lit ? 'kami.hint.finish' : 'kami.hint.push';
    if (key !== this.hintKey) {
      this.hintKey = key;
      this.hint.setScale(1).setText(key ? t(key) : '').setColor(key === 'kami.hint.finish' ? COLORS.gold : COLORS.ink);
      fitText(this.hint, this.scale.width - 60);
    }
  }
}
