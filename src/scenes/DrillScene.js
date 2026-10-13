// src/scenes/DrillScene.js — 稽古の遊び1つ（20体版 Task 6・10/13 本人「稽古がしょぼい。一押し、連打、長押しの訓練が欲しい」）
// 稽古の1コマ。下の真ん中の立体の大きなボタン（src/ui/bigbutton.js）1つで遊ぶ。点数と倍率の計算は src/core/drills.js
//   ippon（一押し・技）：金の輪が縮んで的の輪に重なった瞬間に一押し。5回
//   renda（連打・体）：5秒間の連打（最初のひとたたきで始まる）。主人公の型紙が柱を突き、たたくたびに柱が揺れる
//   nagaoshi（長押し・心）：押している間に足が上がりゲージがたまる。緑の帯でちょうど離す。3回
// 終わったら伸ばして保存（drillStatNow を1回だけ）→ 結果（点数・伸び・親方の一言）→ 次のコマ／相手へ／番付へ
// 絵：稽古場の背景（assets/bg/keiko.jpg）と主人公の横向きの型紙。新しく描いた絵は無い（柱・輪・ゲージは図形）
// 決め技モード（10/14 本人「稽古の出来で決め技を習得できるようにしてください」・data.kimete＝決め技の id）：
//   遊びはその決め技の drill（kimete.js）。心技体は伸びず、出来で習得ゲージ（drills.kimeteGain）がたまる（drillKimeteNow を1回だけ）。
//   結果＝点数と出来 → ゲージが前→後へたまる → 満タンなら「習得！」・決めのカットイン（kime）・kan の音／満タンでなければ「習得 75%」
import { t } from '../i18n/i18n.js?v=35';
import { session, drillStatNow, drillKimeteNow } from '../state.js?v=35';
import { canLeaveTraining } from '../core/run.js?v=35';
import { kimeteById } from '../data/kimete.js?v=35';
import { cutinArt } from '../core/cutin.js?v=35';
import {
  DRILLS, DRILL_STAT, drillMult, drillGrade, gradeMood,
  IPPON, ipponHitMs, ipponRadius, ipponJudge, ipponMissed, ipponScore,
  RENDA, rendaScore, NAGAOSHI, nagaoshiGauge, nagaoshiPoint, nagaoshiScore, shiftForHidden, kimetePct,
} from '../core/drills.js?v=35';
import { kamiArt, heroArt } from '../core/foeart.js?v=35';
import { HERO_TYPE } from '../data/heroes.js?v=35';
import { createBigButton } from '../ui/bigbutton.js?v=35';
import { drawCutinBand } from '../ui/cutinband.js?v=35';
import { playTraining, playBout } from '../ui/sfx.js?v=35';
import {
  button, fitText, textStyle, statBars, speakerFace, speechBubble, preloadOyakataArt, preloadHeroFigures, clearScene, COLORS,
} from '../ui/widgets.js?v=35';

const BG_KEY = 'keiko-bg';
const HERO_FILE = `hero_${HERO_TYPE}`;
const FIG_H = 330; // 型紙の高さ（取組と同じ）
const FEET_Y = 800; // 型紙の足もと（稽古場の床の上）
const BTN = { x: 360, y: 1104, d: 300, hit: 165 }; // 取組と同じ立体のボタン
const RING = { x: 470, y: 430 }; // 一押しの輪の中心（主人公の前・上）
const PILLAR = { x: 452, w: 64, top: -10 }; // 鉄砲柱（背景の柱の上に重ねる図形）
const GAUGE = { x: 620, top: 300, h: 460, w: 46 }; // 長押しのゲージ（縦）
const FEEDBACK_Y = 560;
const HEAD_H = 196; // 上の見出しの帯の高さ
const COUNT = { x: 600, y: 470 }; // 連打の回数（柱の右に大きく）
const READY_MS = 900; // 一押しの「よーい」
const RESULT_GUARD_MS = 600; // 結果の画面が出てから次へのボタンを出すまで（連打の最後のひとたたきが、そのまま結果を飛ばさない）
const TXT_SHADOW = [0, 3, '#0a0f20', 6, false, true];
// 決め技モードの結果：習得ゲージ（字と横の棒）とたまる動き・習得のカットイン（取組の帯と同じ形・親方の吹き出しの上に重ねる）
const KGAUGE = { labelY: 352, barY: 405, w: 560, h: 30, delay: 250, ms: 700 };
const KCUT = { y: 560, h: 220, faceX: 125, faceH: 260, textX: 460, textW: 470, ms: 1800 };

export class DrillScene extends Phaser.Scene {
  constructor() {
    super('drill');
  }

  init(data) {
    this.kind = data && DRILLS.indexOf(data.kind) >= 0 ? data.kind : 'ippon';
    this.kimeteId = data && typeof data.kimete === 'string' ? data.kimete : null;
  }

  preload() {
    if (!this.textures.exists(BG_KEY)) this.load.image(BG_KEY, 'assets/bg/keiko.jpg');
    const a = kamiArt(HERO_FILE);
    if (!this.textures.exists(a.key)) this.load.image(a.key, a.path);
    preloadHeroFigures(this); // 型紙が無い時の主人公の代わり
    preloadOyakataArt(this);
    const kime = cutinArt('kime'); // 決め技を覚えた時のカットイン
    if (!this.textures.exists(kime.key)) this.load.image(kime.key, kime.path);
  }

  create() {
    if (!session.run) { this.scene.start('guide'); return; }
    if (!session.run.training) { this.scene.start('training'); return; }
    // 決め技モード：解禁していて覚えていない決め技だけ。遊びはその決め技の物にそろえる（それ以外はふつうの稽古）
    const k = this.kimeteId ? kimeteById(this.kimeteId) : null;
    const run = session.run;
    if (k && run.unlocked.indexOf(k.id) >= 0 && run.newKnown.indexOf(k.id) < 0) this.kind = k.drill;
    else this.kimeteId = null;
    this.phase = 'ready';
    this.finished = false;
    this.round = 0;
    this.points = [];
    this.count = 0;
    this.feedbackUntil = 0;
    this.btn = null;
    this.events.once('shutdown', () => this.dropButton());
    const onHidden = () => this.onHidden();
    this.game.events.on('hidden', onHidden);
    this.events.once('shutdown', () => this.game.events.off('hidden', onHidden));
    this.hiddenAt = null; // 裏へ回った時（ms）
    this.resumed = false; // 表へ戻った：最初のコマで時計を直す
    const onVisible = () => { if (this.hiddenAt !== null) this.resumed = true; };
    this.game.events.on('visible', onVisible);
    this.events.once('shutdown', () => this.game.events.off('visible', onVisible));
    this.drawPlay();
  }

  dropButton() {
    if (this.btn) this.btn.destroy();
    this.btn = null;
  }

  // ---- 遊びの画面 ----
  drawBackdrop() {
    const { width, height } = this.scale;
    if (this.textures.exists(BG_KEY)) {
      const bg = this.add.image(0, 0, BG_KEY).setOrigin(0, 0);
      bg.setScale(Math.max(width / bg.width, height / bg.height));
    }
    this.add.rectangle(0, 0, width, height, 0x141a2e, 0.4).setOrigin(0, 0); // 型紙と字を目立たせる
  }

  drawPlay() {
    clearScene(this);
    const { width } = this.scale;
    const kind = this.kind;
    this.drawBackdrop();
    // 上の見出しの帯（柱や輪より前・字が絵に負けない）
    this.add.rectangle(0, 0, width, HEAD_H, 0x141a2e, 0.72).setOrigin(0, 0).setDepth(4);
    fitText(this.add.text(width / 2, 56, this.headLabel(), textStyle(50, COLORS.gold)).setOrigin(0.5).setShadow(...TXT_SHADOW).setDepth(5), width - 60);
    fitText(this.add.text(width / 2, 112, t(`drill.${kind}.how`), textStyle(28, COLORS.ink)).setOrigin(0.5).setShadow(...TXT_SHADOW).setDepth(5), width - 50);
    this.info = this.add.text(width / 2, 162, '', textStyle(30, COLORS.gold)).setOrigin(0.5).setShadow(...TXT_SHADOW).setDepth(5);

    // 鉄砲柱（連打だけ）：型紙の後ろ
    this.pillar = null;
    if (kind === 'renda') {
      const g = this.add.graphics();
      const h = FEET_Y + 20 - PILLAR.top;
      g.fillStyle(0x3a2c20, 1).fillRect(-PILLAR.w / 2, 0, PILLAR.w, h);
      g.fillStyle(0x5b4532, 1).fillRect(-PILLAR.w / 2 + 8, 0, 14, h);
      g.fillStyle(0x2a2018, 1).fillRect(PILLAR.w / 2 - 12, 0, 12, h);
      g.fillStyle(0xd9c79a, 1).fillRect(-PILLAR.w / 2 - 2, 470, PILLAR.w + 4, 10).fillRect(-PILLAR.w / 2 - 2, 600, PILLAR.w + 4, 10); // 巻いた縄
      g.setPosition(PILLAR.x, PILLAR.top);
      this.pillar = g;
    }
    // 足もとの影と型紙
    const heroX = kind === 'renda' ? 318 : kind === 'nagaoshi' ? 290 : 230;
    this.heroX = heroX;
    this.add.ellipse(heroX, FEET_Y + 2, 170, 22, 0x000000, 0.35);
    this.hero = this.figure(heroX);

    // 一押しの輪（的＝白・縮む金）
    this.ring = kind === 'ippon' ? this.add.graphics() : null;
    // 長押しのゲージ
    this.gauge = kind === 'nagaoshi' ? this.add.graphics() : null;

    this.counter = kind === 'renda' ? this.add.text(COUNT.x, COUNT.y, '0', textStyle(110, COLORS.gold, { stroke: '#141a2e', strokeThickness: 10 })).setOrigin(0.5).setDepth(6) : null;
    this.feedback = this.add.text(width / 2, FEEDBACK_Y, '', textStyle(76, COLORS.gold, { stroke: '#141a2e', strokeThickness: 8 })).setOrigin(0.5).setDepth(10);

    this.btn = createBigButton(this, {
      x: BTN.x, y: BTN.y, d: BTN.d, hit: BTN.hit,
      onDown: () => this.press(),
      onUp: () => this.release(),
    });
    this.btn.setLook({ color: 0xc8553d, label: t(`drill.btn.${kind}`) });
    if (kind === 'ippon') this.startAt = this.time.now + READY_MS;
    this.phase = kind === 'ippon' ? 'ready' : 'wait';
  }

  // 見出し：決め技モードは「決め技「○○」の稽古」・ふつうは遊びの名前
  headLabel() {
    return this.kimeteId ? t('drill.kimeteHead', { tech: t(`newtech.${this.kimeteId}`) }) : t(`drill.${this.kind}`);
  }

  figure(x) {
    const a = kamiArt(HERO_FILE);
    const key = this.textures.exists(a.key) ? a.key : this.textures.exists(heroArt(HERO_TYPE).key) ? heroArt(HERO_TYPE).key : null;
    if (!key) return null;
    const img = this.add.image(x, FEET_Y, key).setOrigin(0.5, 1);
    img.setScale(FIG_H / img.height);
    return img;
  }

  say(key, color = COLORS.gold, ms = 650) {
    this.tweens.killTweensOf(this.feedback);
    this.feedback.setScale(1).setText(t(key)).setColor(color).setAlpha(1);
    fitText(this.feedback, this.scale.width - 60);
    const base = this.feedback.scaleX;
    this.feedback.setScale(base * 1.25);
    this.tweens.add({ targets: this.feedback, scale: base, duration: 140, ease: 'Back.Out' });
    this.feedbackUntil = this.time.now + ms;
  }

  // 主人公が前へ突く（一押し・連打）
  lunge(dx, ms) {
    if (!this.hero) return;
    this.tweens.killTweensOf(this.hero);
    this.hero.x = this.heroX;
    this.hero.angle = 0;
    this.tweens.add({ targets: this.hero, x: this.heroX + dx, angle: 4, duration: ms, yoyo: true, ease: 'Quad.Out' });
  }

  shakePillar() {
    if (!this.pillar) return;
    this.tweens.killTweensOf(this.pillar);
    this.pillar.x = PILLAR.x;
    this.tweens.add({ targets: this.pillar, x: PILLAR.x + 7, duration: 40, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
  }

  // ボタンを押した：遊びの1手にしたら true（沈む）・受け付けない時は false
  press() {
    if (this.finished) return false;
    const now = this.time.now;
    if (this.kind === 'ippon') {
      if (this.phase !== 'ring') return false;
      const pts = ipponJudge(now - this.roundAt - this.hitMs);
      this.scoreIppon(pts);
      this.lunge(70, 110);
      return true;
    }
    if (this.kind === 'renda') {
      if (this.phase === 'wait') { this.phase = 'run'; this.runAt = now; this.count = 0; }
      if (this.phase !== 'run') return false;
      this.count += 1;
      if (this.counter) {
        this.tweens.killTweensOf(this.counter);
        this.counter.setText(String(this.count)).setScale(1.25);
        this.tweens.add({ targets: this.counter, scale: 1, duration: 120, ease: 'Quad.Out' });
      }
      this.lunge(26, 45);
      this.shakePillar();
      playBout('dosu');
      return true;
    }
    // 長押し：帯の外で待っている時だけ始まる
    if (this.phase !== 'wait') return false;
    this.phase = 'hold';
    this.holdAt = now;
    return true;
  }

  release() {
    if (this.finished || this.kind !== 'nagaoshi' || this.phase !== 'hold') return;
    const g = nagaoshiGauge(this.time.now - this.holdAt);
    this.scoreNagaoshi(g);
  }

  // 画面が裏へ回った：長押しの途中ならその回はやり直し（点にしない）
  onHidden() {
    if (this.hiddenAt === null) this.hiddenAt = this.time.now;
    if (this.btn) this.btn.releaseAll();
    if (this.kind === 'nagaoshi' && this.phase === 'hold') {
      this.phase = 'wait';
      this.stomp(false);
    }
  }

  // 表へ戻った最初のコマ：裏にいた間に進んだ時計を直す（一押しの輪はやり直し・連打の残りは裏で減らさない）
  resumeClocks(now) {
    const dur = now - this.hiddenAt;
    this.hiddenAt = null;
    this.resumed = false;
    const c = shiftForHidden(this.kind, this, now, dur);
    this.roundAt = c.roundAt;
    this.startAt = c.startAt;
    this.gapUntil = c.gapUntil;
    this.runAt = c.runAt;
  }

  scoreIppon(pts) {
    this.points.push(pts);
    this.phase = 'gap';
    this.gapUntil = this.time.now + IPPON.gapMs;
    if (pts === 2) { this.say('drill.perfect', COLORS.gold); playBout('kan'); }
    else if (pts === 1) { this.say('drill.near', COLORS.ink); playBout('slap'); }
    else { this.say('drill.miss', COLORS.sub); playBout('bosu'); }
  }

  scoreNagaoshi(g) {
    const p = nagaoshiPoint(g);
    this.points.push(p);
    this.phase = 'gap';
    this.gapUntil = this.time.now + NAGAOSHI.gapMs;
    this.lastGauge = g;
    if (p >= 0.8) this.say('drill.perfect', COLORS.gold);
    else if (p > 0) this.say('drill.good', COLORS.ink);
    else this.say(g < NAGAOSHI.center ? 'drill.early' : 'drill.late', COLORS.sub);
    this.stomp(true);
  }

  // 足を下ろす：型紙が下りて、四股の音と画面の揺れ
  stomp(loud) {
    if (this.hero) {
      this.tweens.killTweensOf(this.hero);
      this.tweens.add({ targets: this.hero, y: FEET_Y, angle: 0, duration: 90, ease: 'Quad.In' });
    }
    if (loud) {
      playBout('zushin');
      this.cameras.main.shake(140, 0.006);
    }
  }

  update() {
    if (!this.btn || this.finished) return;
    const now = this.time.now;
    const kind = this.kind;
    if (this.resumed) this.resumeClocks(now);
    if (kind === 'ippon') this.updateIppon(now);
    else if (kind === 'renda') this.updateRenda(now);
    else this.updateNagaoshi(now);
    if (this.feedbackUntil && now > this.feedbackUntil) {
      this.feedback.setAlpha(Math.max(0, 1 - (now - this.feedbackUntil) / 200));
      if (now > this.feedbackUntil + 200) this.feedbackUntil = 0;
    }
    if (!this.finished && this.btn) this.btn.update();
  }

  updateIppon(now) {
    const g = this.ring;
    g.clear();
    if (this.phase === 'ready') {
      this.info.setText(t('drill.ready'));
      if (now >= this.startAt) this.nextRing(now);
      return;
    }
    if (this.phase === 'gap' && now >= this.gapUntil) {
      if (this.points.length >= IPPON.rounds) { this.finish(ipponScore(this.points)); return; }
      this.nextRing(now);
    }
    // 的の輪（白・太い）と、ぴったりの幅の薄い帯
    g.lineStyle(20, 0xffffff, 0.18).strokeCircle(RING.x, RING.y, IPPON.targetR);
    g.lineStyle(5, 0xffffff, 0.95).strokeCircle(RING.x, RING.y, IPPON.targetR);
    if (this.phase === 'ring') {
      const el = now - this.roundAt;
      if (ipponMissed(el, this.hitMs)) { this.scoreIppon(0); return; }
      const r = ipponRadius(el, this.hitMs);
      g.lineStyle(10, 0xe3b23c, 1).strokeCircle(RING.x, RING.y, Math.max(2, r));
      const near = Math.abs(el - this.hitMs) <= IPPON.perfectMs;
      this.btn.setLook({ pulse: near ? 1 : Math.max(0, 1 - Math.abs(el - this.hitMs) / 500) });
    } else {
      this.btn.setLook({ pulse: 0 });
    }
  }

  nextRing(now) {
    this.round = this.points.length;
    this.hitMs = ipponHitMs(this.round);
    this.roundAt = now;
    this.phase = 'ring';
    this.info.setText(t('drill.round', { n: this.round + 1, all: IPPON.rounds }));
  }

  updateRenda(now) {
    if (this.phase === 'wait') {
      this.info.setText(t('drill.tapToStart'));
      this.btn.setLook({ throb: true });
      return;
    }
    const left = Math.max(0, RENDA.ms - (now - this.runAt));
    this.info.setText(t('drill.time', { s: (left / 1000).toFixed(1), n: this.count }));
    this.btn.setLook({ throb: false, fill: left / RENDA.ms, arc: true });
    if (left <= 0) this.finish(rendaScore(this.count));
  }

  updateNagaoshi(now) {
    const done = this.points.length;
    if (this.phase === 'gap' && now >= this.gapUntil) {
      if (done >= NAGAOSHI.rounds) { this.finish(nagaoshiScore(this.points)); return; }
      this.phase = 'wait';
      this.lastGauge = 0;
    }
    let gv = this.phase === 'gap' ? this.lastGauge : 0;
    if (this.phase === 'hold') {
      gv = nagaoshiGauge(now - this.holdAt);
      if (gv >= 1) { this.scoreNagaoshi(1); gv = 1; } // 満タンまで上げすぎ
      else if (this.hero) { // 足を上げる：型紙を持ち上げて後ろへ傾ける
        this.hero.y = FEET_Y - 70 * gv;
        this.hero.angle = -14 * gv;
      }
    }
    const shown = Math.min(done + (this.phase === 'gap' ? 0 : 1), NAGAOSHI.rounds);
    this.info.setText(t('drill.round', { n: shown, all: NAGAOSHI.rounds }));
    this.drawGauge(gv);
    this.btn.setLook({ fill: gv, arc: true, throb: this.phase === 'wait' });
  }

  drawGauge(v) {
    const g = this.gauge;
    const { x, top, h, w } = GAUGE;
    const y0 = top + h; // 下の端（0）
    const at = (p) => y0 - h * p;
    g.clear();
    g.fillStyle(0x141a2e, 0.85).fillRoundedRect(x - w / 2 - 6, top - 6, w + 12, h + 12, 14);
    const b0 = NAGAOSHI.center - NAGAOSHI.half, b1 = NAGAOSHI.center + NAGAOSHI.half;
    g.fillStyle(0x6fcf7f, 0.9).fillRect(x - w / 2, at(b1), w, at(b0) - at(b1)); // 緑の帯
    g.fillStyle(0xffffff, 0.9).fillRect(x - w / 2, at(NAGAOSHI.center) - 1, w, 2); // 帯の真ん中
    if (v > 0) g.fillStyle(0xe3b23c, 0.85).fillRect(x - w / 2 + 8, at(v), w - 16, y0 - at(v));
    g.lineStyle(4, 0xe3c27a, 1).strokeRoundedRect(x - w / 2 - 6, top - 6, w + 12, h + 12, 14);
    g.fillStyle(0xffffff, 1).fillTriangle(x - w / 2 - 22, at(v) - 10, x - w / 2 - 22, at(v) + 10, x - w / 2 - 6, at(v)); // 今の高さの矢印
  }

  // ---- 終わり：伸ばして保存（1回だけ）→ 結果 ----
  finish(score) {
    if (this.finished) return;
    this.finished = true;
    const run = session.run;
    const stat = DRILL_STAT[this.kind];
    const voluntary = canLeaveTraining(run);
    if (this.kimeteId) { // 決め技モード：心技体は伸びず、ゲージがたまる（ここで保存まで）
      const note = drillKimeteNow(this.kimeteId, score);
      const after = note.run;
      this.result = { score, kimete: this.kimeteId, from: note.from, to: note.to, learned: note.learned, voluntary, left: after.training ? after.training.left : 0, count: this.count };
      playTraining(this.kind === 'ippon' ? 'waza' : this.kind === 'renda' ? 'teppo' : 'shiko');
      this.time.delayedCall(0, () => this.drawResult());
      return;
    }
    const mult = drillMult(score);
    const from = run.stats[stat];
    drillStatNow(stat, mult);
    const after = session.run;
    this.result = { score, mult, stat, from, to: after.stats[stat], voluntary, left: after.training ? after.training.left : 0, count: this.count };
    playTraining(this.kind === 'ippon' ? 'waza' : this.kind === 'renda' ? 'teppo' : 'shiko');
    // 押しの最中に部品を消さない：描き直しは次のフレームへ
    this.time.delayedCall(0, () => this.drawResult());
  }

  // 結果の画面の次へのボタン：連打の最後のひとたたきが結果の上に落ちて飛ばさないよう、少し遅らせて出す（3つの遊び共通）
  resultButtons() {
    const { width } = this.scale;
    const r = this.result;
    if (r.left > 0) {
      button(this, width / 2, 1190, 520, 110, t('drill.next', { n: r.left }), () => this.scene.start('training'), { size: 36 });
      return;
    }
    if (r.voluntary) button(this, width / 2, 1190, 460, 110, t('drill.toLadder'), () => this.scene.start('ladder'), { size: 38 });
    else button(this, width / 2, 1190, 460, 110, t('drill.toFoe'), () => this.scene.start('opponent'), { size: 38 });
  }

  drawResult() {
    this.dropButton();
    clearScene(this);
    const { width } = this.scale;
    const r = this.result;
    this.drawBackdrop();
    this.add.rectangle(0, 0, width, this.scale.height, 0x141a2e, 0.55).setOrigin(0, 0);
    fitText(this.add.text(width / 2, 70, t('drill.result'), textStyle(50, COLORS.gold)).setOrigin(0.5), width - 60);
    fitText(this.add.text(width / 2, 130, this.headLabel(), textStyle(32, COLORS.ink)).setOrigin(0.5), width - 60);
    const pct = Math.round(r.score * 100);
    const raw = this.kind === 'ippon'
      ? t('drill.res.ippon', { pts: this.points.reduce((a, p) => a + p, 0) })
      : this.kind === 'renda' ? t('drill.res.renda', { n: r.count }) : t('drill.res.nagaoshi', { pts: pct });
    fitText(this.add.text(width / 2, 230, raw, textStyle(52, COLORS.ink)).setOrigin(0.5), width - 60);
    if (r.kimete) {
      fitText(this.add.text(width / 2, 300, t('drill.score', { pct }), textStyle(32, COLORS.gold)).setOrigin(0.5), width - 60);
      this.kimeteGaugeAnim(r);
    } else {
      fitText(this.add.text(width / 2, 305, t('drill.mult', { pct, m: r.mult.toFixed(2) }), textStyle(32, COLORS.gold)).setOrigin(0.5), width - 60);
      const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1);
      fitText(this.add.text(width / 2, 375, t('drill.gain', { stat: t(`stat.${r.stat}`), from: fmt(r.from), to: fmt(r.to) }), textStyle(40, COLORS.ink)).setOrigin(0.5), width - 60);
    }
    // 親方：上手＝笑う・下手＝怒鳴る
    // 決め技を覚えた時（learned）は出来が低くても『great』（笑う顔）＝習得の場面で怒鳴らない
    const grade = r.kimete && r.learned ? 'great' : drillGrade(r.score);
    speakerFace(this, 'kotonami', 110, 540, 150, gradeMood(grade));
    speechBubble(this, 210, 450, 470, 180, t(`drill.line.${grade}`), { size: 30, min: 16 });
    statBars(this, 40, 700, 640, session.run.stats);
    if (r.left <= 0) fitText(this.add.text(width / 2, 1080, t(r.voluntary ? 'train2.doneFree' : 'train2.done'), textStyle(34, COLORS.gold)).setOrigin(0.5), width - 60);
    this.time.delayedCall(RESULT_GUARD_MS, () => this.resultButtons());
  }

  // 決め技モードの結果：習得ゲージが前→後へたまる（短い tween）→ 満タンなら「習得！」・決めのカットイン・kan／でなければ「習得 75%」
  kimeteGaugeAnim(r) {
    const { width } = this.scale;
    const label = this.add.text(width / 2, KGAUGE.labelY, t('kimete.progress', { pct: kimetePct(r.from) }), textStyle(40, COLORS.ink)).setOrigin(0.5);
    fitText(label, width - 60);
    const bar = this.add.graphics();
    const x0 = (width - KGAUGE.w) / 2;
    const top = KGAUGE.barY - KGAUGE.h / 2;
    const rad = KGAUGE.h / 2;
    const draw = (v) => {
      bar.clear();
      bar.fillStyle(0x2f3858, 1).fillRoundedRect(x0, top, KGAUGE.w, KGAUGE.h, rad);
      const fw = KGAUGE.w * Math.max(0, Math.min(1, v));
      if (fw > 0) bar.fillStyle(0xe3c27a, 1).fillRoundedRect(x0, top, Math.max(KGAUGE.h, fw), KGAUGE.h, rad);
      bar.lineStyle(3, 0xe3c27a, 1).strokeRoundedRect(x0, top, KGAUGE.w, KGAUGE.h, rad);
    };
    draw(r.from);
    const g = { v: r.from };
    this.tweens.add({
      targets: g, v: r.to, delay: KGAUGE.delay, duration: KGAUGE.ms, ease: 'Cubic.easeOut',
      onUpdate: () => {
        draw(g.v);
        label.setText(t('kimete.progress', { pct: kimetePct(g.v) }));
      },
      onComplete: () => {
        draw(r.to);
        if (!r.learned) { label.setText(t('kimete.progress', { pct: kimetePct(r.to) })); return; }
        label.setScale(1).setText(t('drill.learned')).setFontSize(52).setColor(COLORS.gold);
        fitText(label, width - 60);
        const base = label.scaleX;
        label.setScale(base * 1.4);
        this.tweens.add({ targets: label, scale: base, duration: 180, ease: 'Back.Out' });
        playBout('kan');
        this.showLearnedCutin(r.kimete);
      },
    });
  }

  // 習得のカットイン（決めの表情 kime）：親方の吹き出しの上に重ね、少しして消える・たたくと閉じる
  showLearnedCutin(id) {
    const c = drawCutinBand(this, KCUT, 'kime', t(`newtech.${id}`), t('drill.learnedSub'));
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this.tweens.add({ targets: c, alpha: 0, duration: 150, onComplete: () => c.destroy() });
    };
    this.time.delayedCall(KCUT.ms, close);
    this.input.once('pointerdown', close);
  }
}
