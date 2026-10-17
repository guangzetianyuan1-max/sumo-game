// src/scenes/DrillScene.js — 稽古の遊び1つ（20体版 Task 6・10/13 本人「稽古がしょぼい。一押し、連打、長押しの訓練が欲しい」）
// 稽古の1コマ。下の立体の大きなボタン2つ（src/ui/bigbutton.js・本番と同じ場所：左＝連打・右＝一押しと長押し）で遊ぶ。点数と倍率の計算は src/core/drills.js
// 使わない方のボタンは暗い（連打＝左・一押しと長押し＝右・3・2・1・GO の間はどちらも効かない）。〇とバーの絵をさわる＝右と同じ。主人公は3つとも右向き
// 3つとも 3・2・1・GO から始まる（v47 本人「稽古の始め方をそろえる」・drills.drillStartPhase）。結果は3つとも「○点（100点満点）」＝出来の％
//   ippon（一押し・技）：金の輪が縮んで的の輪に重なった瞬間に一押し。5回
//   renda（連打・体）：5秒間の連打（最初のひとたたきで始まる）。主人公の型紙が柱を突き、たたくたびに柱が揺れる
//   nagaoshi（長押し・心）：押している間に足が上がりゲージがたまる。緑の帯でちょうど離す。3回。相手は置かない（v42 本人）：緑で離す＝四股を踏みしめてこらえる（ずしん）／外す＝主人公が後ろへよろける
// 終わったら伸ばして保存（drillStatNow を1回だけ）→ 結果（点数・伸び・親方の一言）→ 次のコマ／相手へ／番付へ
// 絵：稽古場の背景（assets/bg/keiko.jpg）と主人公の横向きの型紙。新しく描いた絵は無い（柱・輪・ゲージは図形）
// 決め技モード（10/14 本人「稽古の出来で決め技を習得できるようにしてください」・data.kimete＝決め技の id）：
//   遊びはその決め技の drill（kimete.js）。心技体は伸びず、出来で習得ゲージ（drills.kimeteGain）がたまる（drillKimeteNow を1回だけ）。
//   結果＝点数と出来 → ゲージが前→後へたまる → 満タンなら「習得！」・決めのカットイン（kime）・kan の音／満タンでなければ「習得 75%」
import { t } from '../i18n/i18n.js?v=55';
import { session, drillStatNow, drillKimeteNow } from '../state.js?v=55';
import { canLeaveTraining, currentFoe, atCeiling, allAtCeiling, statCeiling } from '../core/run.js?v=55';
import { kimeteById } from '../data/kimete.js?v=55';
import { cutinArt } from '../core/cutin.js?v=55';
import {
  DRILLS, DRILL_STAT, drillMult, drillGrade, gradeMood, statDrillGrade, kimeteGrade,
  IPPON, ipponHitMs, ipponJudge, ipponMissed, ipponScore,
  RENDA, COUNTDOWN, countdownAt, rendaScore, drillStartPhase, afterCountdown, NAGAOSHI, nagaoshiHalf, nagaoshiGauge, nagaoshiPoint, nagaoshiScore, shiftForHidden, kimetePct, armStart,
} from '../core/drills.js?v=55';
import { kamiArt, heroArt } from '../core/foeart.js?v=55';
import { HERO_TYPE } from '../data/heroes.js?v=55';
import { createBigButton } from '../ui/bigbutton.js?v=55';
import { BUTTON_COLOR } from '../core/kamibutton.js?v=55';
import { FACE, FIG_H, FEET_Y, HERO_X, PILLAR, COUNT, GOAL, HOLD, BTN, holdBlocked, DRILL_MAIN, drillButtonColor } from '../ui/drillstage.js?v=55'; // 置き場所と長押しの見せ方の計算（Phaser を使わない）
import { drawCutinBand } from '../ui/cutinband.js?v=55';
import { edgeFade } from '../ui/backdrop.js?v=55';
import { HUD, HUD_HIT, HIT_MARK, ringShape, barShape, drawRing, drawBar } from '../ui/hud.js?v=55'; // 〇とバーの置き場所と形は本番（KamiScene）と同じ物を読む
import { playTraining, playBout, whine, whineStop } from '../ui/sfx.js?v=55';
import { ringProgress } from '../core/whine.js?v=55';
import { newChime, greenChime, drillGreen, rendaGoal } from '../core/chime.js?v=55';
import { guardOpen, openGuarded } from '../ui/openguard.js?v=55';
import {
  button, fitText, wrapText, textStyle, statBars, speakerFace, speechBubble, preloadOyakataArt, preloadHeroFigures, clearScene, COLORS,
} from '../ui/widgets.js?v=55';

const BG_KEY = 'keiko-bg';
const HERO_FILE = `hero_${HERO_TYPE}`;
const HUD_DEPTH = 6; // 〇とバー：上の見出しの帯と字（4・5）より上
const FEEDBACK_Y = 380; // 結果の字（こらえ成功！など）：〇の的（〜340）の下・型紙の頭（大ボスで 420）の上＝頭にかからない
const INFO_Y = 224; // 回数・残りの1行（見出しの帯の中・字36）
const INFO_Y_IPPON = 872; // 一押しだけは足もと（800）とボタンの弧（約944）の間へ：縮み始めの金の輪（中央上・半径 230＝y 30〜490）が字にかからない（最終点検の直し 6）
const HEAD_H = 256; // 上の見出しの帯の高さ（題56・説明36を2行まで・回数36。左端のバーの枠 294 の上で終わる）
const CD = { x: 360, y: 560, size: 280, goMs: 650 }; // 3つの稽古の前の 3・2・1・GO（大きな字・真ん中・v47 で3つとも）
const RESULT_GUARD_MS = 600; // 結果の画面が出てから次へのボタンを出すまで（連打の最後のひとたたきが、そのまま結果を飛ばさない）
// ボタンの見た目：使う方＝ふつうの明るさ・使わない方（と 3・2・1・GO の間）＝暗く平らに沈んで字も灰（本番の暗いボタンと同じ）
const DIM_LOOK = { color: BUTTON_COLOR.off, dim: true, raise: 0.35, pulse: 0, fill: 0, arc: false, band: null, throb: false, ink: { color: COLORS.sub, stroke: '#141a2e' } };
const MAIN_COLOR = DRILL_MAIN; // 使う方のボタンの朱（長押しは取組と同じ緑＝drillButtonColor）
const LIVE_LOOK = { dim: false, raise: 1, ink: { color: COLORS.ink, stroke: '#141a2e' } };
const TXT_SHADOW = [0, 3, '#0a0f20', 6, false, true];
// 決め技モードの結果：習得ゲージ（字と横の棒）とたまる動き・習得のカットイン（取組の帯と同じ形・親方の吹き出しの上に重ねる）
const KGAUGE = { labelY: 352, barY: 405, w: 560, h: 30, delay: 250, ms: 700 };
const KCUT = { y: 560, h: 220, faceX: 125, faceH: 260, textX: 460, textW: 470, ms: 1800, keepFace: true };

// 決め技モードにできる決め技か（解禁していて、まだ覚えていない）／今回の遊びの種類（決め技モードならその決め技の遊び・それ以外は渡された kind）
const kimeteOk = (run, k) => !!(run && k && run.unlocked.indexOf(k.id) >= 0 && run.newKnown.indexOf(k.id) < 0);
function drillKind(run, kimeteId, kind) {
  const k = kimeteId ? kimeteById(kimeteId) : null;
  return kimeteOk(run, k) ? k.drill : kind;
}

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
    // 決め技モード：解禁していて覚えていない決め技だけ。遊びはその決め技の物にそろえる（それ以外はふつうの稽古）。preload も同じ drillKind で決める
    const k = this.kimeteId ? kimeteById(this.kimeteId) : null;
    this.kind = drillKind(session.run, this.kimeteId, this.kind);
    if (!k || this.kind !== k.drill || !kimeteOk(session.run, k)) this.kimeteId = null;
    this.phase = 'ready';
    this.finished = false;
    // 長押しの緑の帯（v43）：次の相手の番号で取組と同じだけ狭める（1体目＝今の幅・大ボス＝3/4）
    const nextFoe = currentFoe(session.run);
    this.nagaHalf = nagaoshiHalf(nextFoe ? nextFoe.index : 0);
    this.round = 0;
    this.points = [];
    this.count = 0;
    this.chime = newChime(); // 長押し：緑の帯に入った「ここだ」の音を押しごとに1度だけ（v45）
    this.feedbackUntil = 0;
    this.lbtn = null;
    this.rbtn = null;
    this.events.once('shutdown', () => this.dropButton());
    this.events.once('shutdown', () => whineStop()); // 画面を離れる＝「ギュイーン」は必ず止める
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
    if (this.lbtn) this.lbtn.destroy();
    if (this.rbtn) this.rbtn.destroy();
    this.lbtn = null;
    this.rbtn = null;
    this.main = null;
    this.idle = null;
  }

  // ---- 遊びの画面 ----
  drawBackdrop() {
    const { width, height } = this.scale;
    if (this.textures.exists(BG_KEY)) {
      const bg = this.add.image(0, 0, BG_KEY).setOrigin(0, 0);
      bg.setScale(Math.max(width / bg.width, height / bg.height));
    }
    this.add.rectangle(0, 0, width, height, 0x141a2e, 0.4).setOrigin(0, 0); // 型紙と字を目立たせる
    edgeFade(this, { depth: 0 }); // 絵の上下左右の端を藍へ溶かす＝ページの余白（藍）と段差が出ない（v42 第2段）
  }

  drawPlay() {
    clearScene(this);
    const { width } = this.scale;
    const kind = this.kind;
    this.drawBackdrop();
    // 上の見出しの帯（柱や輪より前・字が絵に負けない）
    this.add.rectangle(0, 0, width, HEAD_H, 0x141a2e, 0.72).setOrigin(0, 0).setDepth(4);
    fitText(this.add.text(width / 2, 44, this.headLabel(), textStyle(56, COLORS.gold)).setOrigin(0.5).setShadow(...TXT_SHADOW).setDepth(5), width - 40);
    wrapText(this, width / 2, 80, t(`drill.${kind}.how`), width - 40, 36, COLORS.ink).setShadow(...TXT_SHADOW).setDepth(5); // 説明は ja・en とも改行で2行（どのボタンかも書く）。v44：題を2・説明を6上げた＝2行目の下の端（約172）が一押しの白い的の輪（上の端 180）と回数の行（約206〜）より上（tests/drilltext.test.js）
    this.info = this.add.text(width / 2, kind === 'ippon' ? INFO_Y_IPPON : INFO_Y, '', textStyle(36, COLORS.gold)).setOrigin(0.5).setShadow(...TXT_SHADOW).setDepth(5);

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
    const heroX = HERO_X[kind];
    this.heroX = heroX;
    this.add.ellipse(heroX, FEET_Y + 2, 170, 22, 0x000000, 0.35);
    this.hero = this.figure(heroX);

    // 一押しの輪（的＝白・縮む金）＝本番と同じ中央上・長押しのバー＝本番と同じ左端
    this.ring = kind === 'ippon' ? this.add.graphics().setDepth(HUD_DEPTH) : null;
    // ◎（ぴったり）の時だけ〇の中に大きく「合」（本番と同じ HIT_MARK・v42）
    this.hitMark = kind === 'ippon' ? this.add.text(HUD.ring.x, HUD.ring.y, t('kami.ring.hit'), textStyle(HIT_MARK.size, COLORS.gold, { stroke: '#141a2e', strokeThickness: 10 })).setOrigin(0.5).setDepth(HUD_DEPTH + 0.1).setVisible(false) : null;
    if (this.hitMark) fitText(this.hitMark, HIT_MARK.w);
    this.gauge = kind === 'nagaoshi' ? this.add.graphics().setDepth(HUD_DEPTH) : null;

    // 回数は白・目標（30回）に届いたら金に光る（v45b）。目標の字は回数の真上（3・2・1 の間から見える＝何回たたけばよいか先に分かる）
    this.counter = kind === 'renda' ? this.add.text(COUNT.x, COUNT.y, '0', textStyle(110, COLORS.ink, { stroke: '#141a2e', strokeThickness: 10 })).setOrigin(0.5).setDepth(6) : null; // 柱の右（主人公にも柱にも重ならない）
    this.goal = kind === 'renda' ? fitText(this.add.text(GOAL.x, GOAL.y, t('drill.renda.goal', { n: RENDA.full }), textStyle(GOAL.size, COLORS.ink, { stroke: '#141a2e', strokeThickness: 6, align: 'center' })).setOrigin(0.5).setShadow(...TXT_SHADOW).setDepth(6), GOAL.w) : null;
    // 稽古の前の 3・2・1・GO（v47：3つとも）
    this.cd = this.add.text(CD.x, CD.y, '', textStyle(CD.size, COLORS.gold, { stroke: '#141a2e', strokeThickness: 16 })).setOrigin(0.5).setDepth(11).setVisible(false);
    this.cdN = null; // 今出している数（3・2・1・0＝GO）
    if (this.counter) this.counter.setVisible(false); // 数えるのは GO から
    this.feedback = this.add.text(width / 2, FEEDBACK_Y, '', textStyle(76, COLORS.gold, { stroke: '#141a2e', strokeThickness: 8 })).setOrigin(0.5).setDepth(10);

    // 下のボタン2つ（本番と同じ場所と大きさ）：連打＝左・一押しと長押し＝右。使わない方は暗く、押すと小さく揺れるだけ。
    // 右は〇とバーの絵をさわっても同じ押し（一押し＝〇の円・長押し＝左端のバーの帯）
    const isRenda = kind === 'renda';
    this.lbtn = createBigButton(this, {
      ...BTN.left,
      onDown: () => (isRenda ? this.press() : this.refuse(this.lbtn)),
    });
    this.rbtn = createBigButton(this, {
      ...BTN.right,
      zone: (p) => this.rightZone(p),
      onDown: () => {
        if (isRenda) return this.refuse(this.rbtn);
        const ok = this.press();
        if (!ok && !this.finished) this.rbtn.shake(); // 受け付けない時（よーい・輪と輪の間・長押しの最中）は小さく揺れるだけ
        return ok;
      },
      onUp: () => { if (!isRenda && !this.rbtn.pressed) this.release(); }, // 2本の指（右のボタンとバー）は、両方離すまで押したまま
    });
    this.main = isRenda ? this.lbtn : this.rbtn;
    this.idle = isRenda ? this.rbtn : this.lbtn;
    this.idle.setLook({ ...DIM_LOOK, label: t(isRenda ? 'drill.btn.toLeft' : 'kami.btn.toRight') });
    this.main.setLook({ ...LIVE_LOOK, color: drillButtonColor(kind), label: t(`drill.btn.${kind}`) }); // 長押しは取組の長押しと同じ緑（v42 第2段）
    // 始まりの時刻は最初のコマで決める（drills.armStart）：ここ（create）の this.time.now は前にこの画面を閉じた時刻のまま＝2回目以降は 3・2・1 を飛ばしていきなり GO になった（v42）
    this.startAt = null;
    this.phase = drillStartPhase(kind); // 3つとも入ってすぐ 3・2・1・GO（押しは数えない）→ GO の後は afterCountdown（v47）
    guardOpen(this); // 開いてから 0.3秒は長押しを始めない（札の二度たたき）
  }

  // 見出し：決め技モードは「決め技「○○」の稽古」・ふつうは遊びの名前
  headLabel() {
    return this.kimeteId ? t('drill.kimeteHead', { tech: t(`newtech.${this.kimeteId}`) }) : t(`drill.${this.kind}`);
  }

  // 使わない方のボタン：押しても何も起きない（沈まず小さく横に揺れる）
  refuse(btn) {
    btn.shake();
    return false;
  }

  // 右のボタンの代わりに押せる所（〇とバーの絵）：一押し＝〇の円・長押し＝左端のバーの帯（本番の hudTouch と同じ範囲）
  rightZone(p) {
    if (this.kind === 'ippon') return Math.hypot(p.x - HUD.ring.x, p.y - HUD.ring.y) <= HUD_HIT.ringR;
    if (this.kind === 'nagaoshi') {
      const B = HUD_HIT.bar;
      return p.x >= B.l && p.x <= B.r && p.y >= B.top && p.y <= B.bottom;
    }
    return false;
  }

  figure(x) {
    const a = kamiArt(HERO_FILE);
    const key = this.textures.exists(a.key) ? a.key : this.textures.exists(heroArt(HERO_TYPE).key) ? heroArt(HERO_TYPE).key : null;
    if (!key) return null;
    const img = this.add.image(x, FEET_Y, key).setOrigin(0.5, 1);
    img.setScale(FIG_H / img.height);
    img.setFlipX(FACE < 0); // 型紙は右向き：FACE=+1 ならそのまま
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

  // 主人公が前（右）へ突く（一押し・連打）。dx は前へ進む長さ
  lunge(dx, ms) {
    if (!this.hero) return;
    this.tweens.killTweensOf(this.hero);
    this.hero.x = this.heroX;
    this.hero.angle = 0;
    this.tweens.add({ targets: this.hero, x: this.heroX + FACE * dx, angle: FACE * 4, duration: ms, yoyo: true, ease: 'Quad.Out' });
  }

  shakePillar() {
    if (!this.pillar) return;
    this.tweens.killTweensOf(this.pillar);
    this.pillar.x = PILLAR.x;
    this.tweens.add({ targets: this.pillar, x: PILLAR.x + FACE * 7, duration: 40, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
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
      if (this.phase !== 'run') return false; // 3・2・1・GO の間の押しは数えない（ボタンも沈まない）
      const prev = this.count;
      this.count += 1;
      const goal = rendaGoal(prev, this.count);
      if (goal) playBout('tassei'); // 目標（30回＝満点）に届いたたたきで1度だけ（v45 本人「稽古連打、目標達成で効果音」）
      if (this.counter) {
        this.tweens.killTweensOf(this.counter);
        this.counter.setText(String(this.count)).setScale(goal ? GOAL.pop : 1.25);
        this.tweens.add({ targets: this.counter, scale: 1, duration: goal ? GOAL.ms : 120, ease: goal ? 'Back.Out' : 'Quad.Out' });
        if (goal) this.goalGlow(); // 画面の合図（♪を消していても分かる・v45b）
      }
      this.lunge(26, 45);
      this.shakePillar();
      playBout('dosu');
      return true;
    }
    // 長押し：帯の外で待っている時だけ始まる。開いた直後（稽古の札への二度たたき）の押しは数えない（その回が「早い」で無駄にならない）
    if (this.phase !== 'wait' || openGuarded(this)) return false;
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
    whineStop();
    if (this.hiddenAt === null) this.hiddenAt = this.time.now;
    if (this.lbtn) this.lbtn.releaseAll();
    if (this.rbtn) this.rbtn.releaseAll();
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
    if (pts === 2) { this.say('drill.perfect', COLORS.gold); this.flashHit(); playBout('kan'); }
    else if (pts === 1) { this.say('drill.near', COLORS.ink); playBout('slap'); }
    else { this.say('drill.miss', COLORS.sub); playBout('bosu'); }
  }

  // 〇の中の「合」を一瞬：少し大きく出て縮み、HIT_MARK.ms で消える（○・× では呼ばない）
  flashHit() {
    const m = this.hitMark;
    if (!m) return;
    this.tweens.killTweensOf(m);
    m.setScale(1);
    fitText(m, HIT_MARK.w);
    const base = m.scaleX;
    m.setVisible(true).setAlpha(1).setScale(base * 1.15); // 膨らんでも〇の内側（110×1.15＜HIT_MARK.w）
    this.tweens.add({ targets: m, scale: base, duration: 140, ease: 'Back.Out' });
    this.tweens.add({ targets: m, alpha: 0, delay: HIT_MARK.ms - 250, duration: 250, onComplete: () => m.setVisible(false) });
  }

  scoreNagaoshi(g) {
    const p = nagaoshiPoint(g, this.nagaHalf);
    this.points.push(p);
    this.phase = 'gap';
    this.gapUntil = this.time.now + NAGAOSHI.gapMs;
    this.lastGauge = g;
    const blocked = holdBlocked(p);
    if (blocked) this.say('kami.bar.ok', p >= 0.8 ? COLORS.gold : COLORS.ink); // 緑で離した＝こらえた
    else this.say(g < NAGAOSHI.center ? 'drill.early' : 'drill.late', COLORS.sub);
    this.stomp(blocked);
    if (!blocked) this.stagger();
  }

  // 外した：主人公が後ろ（FACE と逆）へよろけて、足を踏みしめて戻る（こらえの見せ方は主人公だけ・相手は置かない）
  stagger() {
    if (this.hero) this.tweens.add({ targets: this.hero, x: this.heroX - FACE * HOLD.push, duration: 100, ease: 'Quad.Out', hold: 160, yoyo: true });
    playBout('bosu');
  }

  // 足を下ろす：型紙が下りて、四股の音と画面の揺れ
  stomp(loud) {
    if (this.hero) {
      this.tweens.killTweensOf(this.hero);
      this.hero.x = this.heroX;
      this.tweens.add({ targets: this.hero, y: FEET_Y, angle: 0, duration: 90, ease: 'Quad.In' });
    }
    if (loud) {
      playBout('zushin');
      this.cameras.main.shake(140, 0.006);
    }
  }

  update() {
    if (!this.main || this.finished) { whine(null); return; } // 終わった（結果の画面）＝「ギュイーン」は止める
    const now = this.time.now;
    const kind = this.kind;
    if (this.resumed) this.resumeClocks(now);
    this.startAt = armStart(this.startAt, now); // 開いて最初のコマで始まりを決める（裏から戻った直しの後）
    if (this.phase === 'count') this.updateCountdown(now);
    if (this.phase === 'count') { if (kind === 'ippon') this.drawTarget(); else if (kind === 'nagaoshi') this.drawGauge(0); }
    else if (kind === 'ippon') this.updateIppon(now);
    else if (kind === 'renda') this.updateRenda(now);
    else this.updateNagaoshi(now);
    if (this.feedbackUntil && now > this.feedbackUntil) {
      this.feedback.setAlpha(Math.max(0, 1 - (now - this.feedbackUntil) / 200));
      if (now > this.feedbackUntil + 200) this.feedbackUntil = 0;
    }
    if (!this.finished && this.main) { this.lbtn.update(); this.rbtn.update(); }
    whine(this.finished ? null : this.whineLevel(now));
  }

  // 「ギュイーン」の進み（v43・src/core/whine.js）：一押し＝金の輪が縮む間（出てから重なるまで 0→1）・長押し＝足を上げてゲージをためる間（ゲージの高さ）。ほかは null
  whineLevel(now) {
    if (this.kind === 'ippon' && this.phase === 'ring') return ringProgress(0, this.hitMs, now - this.roundAt);
    if (this.kind === 'nagaoshi' && this.phase === 'hold') return nagaoshiGauge(now - this.holdAt);
    return null;
  }

  updateIppon(now) {
    const g = this.ring;
    g.clear();
    if (this.phase === 'gap' && now >= this.gapUntil) {
      if (this.points.length >= IPPON.rounds) { this.finish(ipponScore(this.points)); return; }
      this.nextRing(now);
    }
    // 的の輪（白・太い）と縮む金の輪＝本番と同じ置き場所（HUD.ring）と形（hud.js の drawRing）。輪の間は的だけ
    if (this.phase === 'ring') {
      const el = now - this.roundAt;
      if (ipponMissed(el, this.hitMs)) { this.scoreIppon(0); return; }
      drawRing(g, ringShape({ from: 0, hitAt: this.hitMs / 1000 }, el / 1000));
      const near = Math.abs(el - this.hitMs) <= IPPON.perfectMs;
      this.main.setLook({ pulse: near ? 1 : Math.max(0, 1 - Math.abs(el - this.hitMs) / 500) });
    } else {
      drawRing(g, { x: HUD.ring.x, y: HUD.ring.y, target: IPPON.targetR, r: null });
      this.main.setLook({ pulse: 0 });
    }
  }

  // 3・2・1・GO の間の一押しの的（白い輪だけ）
  drawTarget() {
    this.ring.clear();
    drawRing(this.ring, { x: HUD.ring.x, y: HUD.ring.y, target: IPPON.targetR, r: null });
  }

  nextRing(now) {
    this.round = this.points.length;
    this.hitMs = ipponHitMs(this.round);
    this.roundAt = now;
    this.phase = 'ring';
    this.main.setLook({ ...LIVE_LOOK, color: MAIN_COLOR, label: t('drill.btn.ippon') }); // 輪が出たら明るく
    this.info.setText(t('drill.round', { n: this.round + 1, all: IPPON.rounds }));
  }

  updateRenda(now) {
    const left = Math.max(0, RENDA.ms - (now - this.runAt));
    this.info.setText(t('drill.time', { s: (left / 1000).toFixed(1), n: this.count }));
    this.main.setLook({ ...LIVE_LOOK, color: MAIN_COLOR, label: t('drill.btn.renda'), throb: false, fill: left / RENDA.ms, arc: true });
    if (left <= 0) this.finish(rendaScore(this.count));
  }

  // 連打の目標に届いた：回数と目標の字を金にして、回数の後ろに金の輪を一度だけ広げる（短い動き・GOAL.ms）
  goalGlow() {
    this.counter.setColor(COLORS.gold);
    if (this.goal) this.goal.setColor(COLORS.gold);
    const ring = this.add.graphics().setPosition(COUNT.x, COUNT.y).setDepth(5);
    const p = { r: GOAL.ring.from, a: 1 };
    const paint = () => { ring.clear(); ring.lineStyle(10, 0xe3b23c, p.a).strokeCircle(0, 0, p.r); };
    paint();
    this.tweens.add({ targets: p, r: GOAL.ring.to, a: 0, duration: GOAL.ms + 140, ease: 'Quad.Out', onUpdate: paint, onComplete: () => ring.destroy() });
  }

  // 稽古の前（3つとも・v47）：3・2・1 を1秒ずつ。GO で afterCountdown へ（連打＝5秒が始まる runAt・一押し＝最初の輪・長押し＝押すのを待つ）。数が変わった時だけ字と音を出す
  updateCountdown(now) {
    const n = countdownAt(now - this.startAt);
    this.info.setText(t('drill.ready'));
    this.main.setLook({ ...DIM_LOOK, label: t('drill.ready') }); // 3・2・1・GO の間は左も右も効かない（暗く「よーい」）
    if (n === this.cdN) return;
    this.cdN = n;
    this.cd.setVisible(true).setScale(1).setAlpha(1).setText(n > 0 ? String(n) : t('drill.go'));
    fitText(this.cd, this.scale.width - 80);
    const base = this.cd.scaleX;
    this.cd.setScale(base * 1.25);
    this.tweens.killTweensOf(this.cd);
    this.tweens.add({ targets: this.cd, scale: base, duration: 220, ease: 'Back.Out' });
    if (n > 0) { playBout('pon'); return; }
    playBout('kan');
    this.tweens.add({ targets: this.cd, alpha: 0, delay: CD.goMs - 250, duration: 250 });
    const kind = this.kind;
    this.phase = afterCountdown(kind);
    if (kind === 'ippon') { this.nextRing(now); return; }
    if (kind === 'nagaoshi') { this.main.setLook({ ...LIVE_LOOK, color: drillButtonColor(kind), label: t('drill.btn.nagaoshi') }); return; }
    this.runAt = now;
    this.count = 0;
    if (this.counter) this.counter.setText('0').setVisible(true);
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
        this.hero.angle = -FACE * 14 * gv; // 足を上げて後ろへ傾ける（右向きなら左回り）
      }
    }
    const gg = drillGreen(this.phase, this.holdAt, gv, this.nagaHalf); // 「ここだ」（v45 本人「長押し、緑の帯に入って効果音」）：ためていて緑の帯に入ったコマで1度だけ
    if (greenChime(this.chime, gg.key, gg.inGreen)) playBout('koko');
    const shown = Math.min(done + (this.phase === 'gap' ? 0 : 1), NAGAOSHI.rounds);
    this.info.setText(t('drill.round', { n: shown, all: NAGAOSHI.rounds }));
    this.drawGauge(gv);
    this.main.setLook({ fill: gv, arc: true, throb: this.phase === 'wait' });
  }

  // 長押しのバー＝本番と同じ左端（HUD.bar）・同じ形（hud.js の drawBar）。帯は長押し稽古の判定（NAGAOSHI）
  drawGauge(v) {
    const g = this.gauge;
    g.clear();
    drawBar(g, barShape({ center: NAGAOSHI.center, half: this.nagaHalf }, v));
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
    this.result = { score, mult, stat, from, to: after.stats[stat], voluntary, left: after.training ? after.training.left : 0, count: this.count, atCeil: atCeiling(after, stat), allCeil: allAtCeiling(after), cap: statCeiling(after.wins) };
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
    fitText(this.add.text(width / 2, 70, t('drill.result'), textStyle(56, COLORS.gold)).setOrigin(0.5), width - 60);
    fitText(this.add.text(width / 2, 135, this.headLabel(), textStyle(36, COLORS.ink)).setOrigin(0.5), width - 60);
    const pct = Math.round(r.score * 100);
    const raw = t('drill.res', { pts: pct }); // 3つとも「○点（100点満点）」＝出来の％（v47：前は 一押し＝10点満点・連打＝回数）
    fitText(this.add.text(width / 2, 230, raw, textStyle(52, COLORS.ink)).setOrigin(0.5), width - 60);
    if (r.kimete) {
      fitText(this.add.text(width / 2, 300, t('drill.score', { pct }), textStyle(36, COLORS.gold)).setOrigin(0.5), width - 60);
      this.kimeteGaugeAnim(r);
    } else {
      fitText(this.add.text(width / 2, 305, t('drill.mult', { pct, m: r.mult.toFixed(2) }), textStyle(36, COLORS.gold)).setOrigin(0.5), width - 60);
      const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1);
      fitText(this.add.text(width / 2, 375, t('drill.gain', { stat: t(`stat.${r.stat}`), from: fmt(r.from), to: fmt(r.to) }), textStyle(40, COLORS.ink)).setOrigin(0.5), width - 60);
      // 今の番付の天井（設計書 2026-10-16 §4）：天井に着いたら金・まだなら灰（伸びの行 375 と親方の吹き出し 440 の間）
      fitText(this.add.text(width / 2, 418, t('drill.ceiling', { cap: fmt(r.cap) }), textStyle(30, r.atCeil ? COLORS.gold : COLORS.sub)).setOrigin(0.5), width - 60);
    }
    // 親方：上手＝笑う・下手＝怒鳴る
    // 決め技モードは点数でなくゲージの進み（kimeteGrade）：覚えた＝great・満タンの6割以上進んだ＝good・ほか＝bad
    const grade = r.kimete ? kimeteGrade(r) : statDrillGrade(r.score, r.atCeil, r.allCeil); // 3つとも天井＝「天井だ。次は土俵で勝て！」・伸ばした物だけ天井＝「{stat}は天井だ。ほかの稽古をしろ！」（Ruling R6・v47）
    // 親方の顔と吹き出し：習得のカットインの帯の間は隠し、帯が閉じたら出す（10/15 バグ出し：帯の下で字が透けて重なった）
    this.oyakata = [...speakerFace(this, 'kotonami', 110, 540, 150, gradeMood(grade)), ...speechBubble(this, 210, 440, 480, 220, t(`drill.line.${grade}`, { stat: t(`stat.${r.stat}`) }), { size: 36, min: 28 })];
    statBars(this, 40, 700, 640, session.run.stats, { ceil: statCeiling(session.run.wins) }); // 天井の印（v47）
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
    const hide = (on) => (this.oyakata || []).forEach((o) => { if (o.active) o.setVisible(on); });
    hide(false);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this.tweens.add({ targets: c, alpha: 0, duration: 150, onComplete: () => { c.destroy(); hide(true); } }); // 帯が消えきってから親方を出す
    };
    this.time.delayedCall(KCUT.ms, close);
    this.input.once('pointerdown', close);
  }
}
