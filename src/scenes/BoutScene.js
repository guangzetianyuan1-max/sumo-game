// src/scenes/BoutScene.js — 取組を仮の四角で見せる（ドットの絵は第4段）。一代記：自分（東）＝career の値・相手（西）＝今日の相手の値
// 取組を計算したらすぐ recordBout → 保存（動きは結果を見せるだけ）。ボタンは「取組の順へ」だけ
// 結果が出たら右下に一言（10/11 本人）：勝ち＝娘が祝う・負け＝親方が心技体の不足と技の選びを言う（boutComment）。動きの記録はその時に最後の1行だけにする
// 場所の自動（session.autoBasho）の時：速さは結果だけ（本人の速さの設定は変えない）・速さのボタンは出さない・結果を0.8秒見せて取組の順へ戻る。どこかを押すと自動を止めて取組の順へ
import { runBout } from '../core/bout.js?v=24';
import { makeWrestler } from '../core/wrestler.js?v=24';
import { currentOpponent } from '../core/basho.js?v=24';
import { boutStats } from '../core/career.js?v=24';
import { TYPES } from '../data/types.js?v=24';
import { t, techLabel, shikonaLabel } from '../i18n/i18n.js?v=24';
import { session, recordNow, boutSeed } from '../state.js?v=24';
import { boutComment } from '../core/advice.js?v=24';
import {
  button, backButton, fitText, roundBox, textStyle, statBars, speakerFace, speechBubble, preloadGuideArt, preloadOyakataArt, COLORS,
} from '../ui/widgets.js?v=24';

const STEP_MS = { normal: 1200, fast: 500 };
const SPEEDS = ['normal', 'fast', 'result'];
const EAST_BAND = 0x3f6aa8;
const WEST_BAND = 0xc8553d;
const FEET_Y = 640; // 土俵の上の縁（力士の足もと）
const READY_MS = 1000; // 立ち合いの前の1行（塩をまいて、時間いっぱい）を見せる長さ
const AUTO_SHOW_MS = 800; // 自動の時、結果を見せる長さ
// 結果の後の一言：動きの記録（y852〜・最後の1行だけ＝折れても2行で y940 まで）の下・「取組の順へ」（上の端 y1145）の上
const COMMENT = { left: 30, right: 700, top: 952, h: 180, face: 110 };

export class BoutScene extends Phaser.Scene {
  constructor() {
    super('bout');
  }

  preload() {
    preloadGuideArt(this); // 勝った時の娘の顔
    preloadOyakataArt(this); // 負けた時の親方の顔
  }

  create() {
    this.done = false;
    this.auto = session.autoBasho === true; // この1番は自動で取る
    this.lastPos = 0;
    this.history = [];
    this.i = 0;
    const career = session.career;
    const foe = career ? currentOpponent(career) : null;
    if (!foe || !session.strategy || !session.oppStrategy) {
      this.scene.start(career ? 'schedule' : 'guide');
      return;
    }
    const you = makeWrestler(career.type, boutStats(career)); // 自分は疲れの調子を掛けた値（相手に疲れは無い）
    const opp = makeWrestler(foe.type, foe.stats);
    // 種は一代記・場所・日から（読み直して取り直しても同じ取組）
    this.result = runBout({ wrestler: you, strategy: session.strategy }, { wrestler: opp, strategy: session.oppStrategy }, boutSeed(career));
    this.names = { east: shikonaLabel(career.name), west: shikonaLabel(foe.name) };
    // 結果の後の一言の材料（自分の値は調子を掛けた取組の値）
    this.commentIn = {
      my: { shin: you.shin, gi: you.gi, tai: you.tai }, opp: { shin: opp.shin, gi: opp.gi, tai: opp.tai },
      known: you.known, myType: career.type, oppType: foe.type, guide: career.guide,
    };
    // 結果はここで記録して保存する（日が1つ進む）。見せている途中で読み直しても取り直せない＝動きは結果を見せるだけ
    recordNow(this.result.winner === 'east', this.result.kimarite);
    // 作戦は使い終わり＝この画面にもう一度入っても次の日を勝手に取らず、取組の順へ戻る
    session.strategy = session.oppStrategy = null;

    const { width } = this.scale;
    this.cx = width / 2;
    this.drawStage();
    const half = width / 2 - 40;
    // 東西の札は一段上げ、その下に心・技・体の小さな棒（屋根は y170 から）
    // 東西の名前はしこ名（自分は東）
    fitText(this.add.text(30, 88, t('bout.sideType', { side: t('bout.east'), type: this.names.east }), textStyle(30, COLORS.ink)), half);
    fitText(this.add.text(width - 30, 88, t('bout.sideType', { side: t('bout.west'), type: this.names.west }), textStyle(30, COLORS.ink)).setOrigin(1, 0), half);
    statBars(this, 30, 128, width / 2 - 50, { shin: you.shin, gi: you.gi, tai: you.tai }, { compact: true });
    statBars(this, width / 2 + 20, 128, width / 2 - 50, { shin: opp.shin, gi: opp.gi, tai: opp.tai }, { compact: true });
    this.east = this.body(career.type, EAST_BAND, 1);
    this.west = this.body(foe.type, WEST_BAND, -1);
    this.east.setPosition(this.cx - 80, FEET_Y);
    this.west.setPosition(this.cx + 80, FEET_Y);
    this.sceneLabel = this.add.text(30, 808, '', textStyle(28, COLORS.gold));
    this.lines = this.add.text(30, 852, '', textStyle(30, COLORS.ink, { lineSpacing: 12, wordWrap: { width: width - 60, useAdvancedWrap: true } }));
    // 結果はもう記録してある＝取組の順へ戻っても取り直しにはならない
    backButton(this, () => this.scene.start('schedule'));
    if (this.auto) {
      // 自動：画面のどこを押しても自動を止めて取組の順へ（結果は記録済み）
      const onDown = () => this.stopAuto();
      this.input.on('pointerdown', onDown);
      this.events.once('shutdown', () => this.input.off('pointerdown', onDown));
      this.play();
      return;
    }
    this.speedBtn = button(this, width - 160, 50, 270, 72, this.speedLabel(), () => this.cycleSpeed(), { color: COLORS.buttonSub, size: 26 });
    // 立ち合いの前に1行だけ（時間いっぱいの長さは段ごとに違うが、分は出さない）。速さを「結果だけ」に替えたらすぐ始まる
    this.lines.setText(t('bout.ready'));
    this.time.delayedCall(READY_MS, () => this.play());
  }

  // 自動の最中に押された：自動を止めて取組の順へ（1度だけ）
  stopAuto() {
    if (!this.auto) return;
    this.auto = false;
    session.autoBasho = false;
    this.time.removeAllEvents();
    this.scene.start('schedule');
  }

  // この1番の速さ（自動の時は結果だけ・本人の設定 session.speed はそのまま）
  speed() {
    return this.auto ? 'result' : session.speed;
  }

  speedLabel() {
    return t('bout.speed', { speed: t(`speed.${session.speed}`) });
  }

  // 横から見た土俵（広間の奥・屋根・観客・土俵・床）。ドットの絵は第4段
  drawStage() {
    const { width } = this.scale;
    this.add.rectangle(width / 2, 460, width, 600, 0x1b2238);
    for (const y of [330, 370, 410]) {
      for (let x = 18; x < width; x += 36) this.add.circle(x, y, 12, 0x39436a, 0.25);
    }
    // 屋根のにおわせ（飾りだけ）
    const roof = this.add.graphics();
    roof.fillStyle(0x3a2a20, 1);
    roof.fillPoints([{ x: 60, y: 170 }, { x: 660, y: 170 }, { x: 720, y: 230 }, { x: 0, y: 230 }], true);
    [[40, 0x3f6aa8], [253, 0xc8553d], [467, 0xf3e6c8], [680, 0x222222]].forEach(([x, c]) => this.add.rectangle(x, 245, 14, 30, c));
    // 土俵（横から見た台形）
    const dohyo = this.add.graphics();
    dohyo.fillStyle(0xc9a46b, 1);
    dohyo.fillPoints([{ x: 90, y: 640 }, { x: 630, y: 640 }, { x: 680, y: 760 }, { x: 40, y: 760 }], true);
    dohyo.fillStyle(0xb08a52, 1);
    dohyo.fillPoints([{ x: 90, y: 640 }, { x: 630, y: 640 }, { x: 638, y: 660 }, { x: 82, y: 660 }], true);
    roundBox(this, width / 2, 637, 560, 10, 0xe8d6a8, { radius: 5, shadow: false }); // 俵
    this.add.rectangle(width / 2, 780, width, 40, 0x2a2238);
  }

  // 原点は足もと。dir は向き（東は右向き1・西は左向き-1）
  body(type, color, dir) {
    const T = TYPES[type];
    const w = 70 + T.girth * 22;
    const h = T.tall ? 210 : 180;
    const c = this.add.container(0, 0);
    c.add(roundBox(this, 0, -h / 2, w, h, 0xe8b48a, { radius: 24, stroke: 0x3a2a20, shadow: false }));
    c.add(roundBox(this, 0, -h / 2 + h * 0.18, w, h * 0.16, color, { radius: 8, shadow: false }));
    c.add(this.add.circle(0, -h - 26, 26, 0xe8b48a).setStrokeStyle(3, 0x3a2a20));
    c.add(this.add.circle(dir * 12, -h - 30, 4, 0x3a2a20));
    return c;
  }

  place(pos, grip) {
    const gap = grip === 'grip' ? 40 : 80;
    const p = Math.max(-80, Math.min(80, pos)); // 倒れる側が輪の外へ出ないように
    this.lastPos = pos;
    const x = this.cx + (p / 100) * 270;
    this.tweens.add({ targets: this.east, x: x - gap, duration: 300 });
    this.tweens.add({ targets: this.west, x: x + gap, duration: 300 });
  }

  showEntry(e) {
    this.place(e.pos, e.grip);
    this.sceneLabel.setText(t(`scene.${e.east.scene}`));
    this.history = [...this.history, t('bout.line', { east: techLabel(e.east.id), west: techLabel(e.west.id) })].slice(-4);
    this.lines.setText(this.history.join('\n'));
  }

  play() {
    if (this.done) return;
    const log = this.result.log;
    if (this.speed() === 'result') {
      this.showEntry(log[log.length - 1]);
      this.finish();
      return;
    }
    if (this.i >= log.length) {
      this.finish();
      return;
    }
    this.showEntry(log[this.i++]);
    this.time.delayedCall(STEP_MS[this.speed()], () => this.play());
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const { winner, kimarite } = this.result;
    const loser = winner === 'east' ? this.west : this.east;
    this.tweens.add({ targets: loser, angle: winner === 'east' ? -80 : 80, duration: 400 });
    // 倒れる向きは土俵の中央側（Phaser の角度は時計回り）。足もとは x 64 以上なので 0..720 に収まる
    // 縁の外まで押し出された（|pos| が100以上）なら、土俵の縁から落ちる
    if (Math.abs(this.lastPos ?? 0) >= 100) this.tweens.add({ targets: loser, y: FEET_Y + 120, duration: 400 });
    const side = this.names[winner];
    const { width } = this.scale;
    // 屋根や飾りの上でも読めるよう、字の下に濃い丸い台を敷く
    const back = this.add.graphics();
    back.fillStyle(COLORS.panel, 0.85);
    back.fillRoundedRect(this.cx - 330, 231, 660, 150, 24);
    fitText(this.add.text(this.cx, 280, t('bout.win', { side }), textStyle(72, COLORS.gold)).setOrigin(0.5), width - 60);
    fitText(this.add.text(this.cx, 345, t('bout.kimarite', { tech: techLabel(kimarite) }), textStyle(46, COLORS.ink)).setOrigin(0.5), width - 60);
    this.comment();
    if (this.auto) {
      this.time.delayedCall(AUTO_SHOW_MS, () => this.scene.start('schedule')); // 自動：結果を見せて取組の順へ（そこで0.6秒おいて次の1番）
      return;
    }
    button(this, this.cx, 1200, 460, 110, t('bout.toSchedule'), () => this.scene.start('schedule'), { size: 38 });
  }

  // 結果の後の右下の一言：左に話す人の顔（娘か親方・親方は「親方」の札付き）、右に吹き出し。右から滑って出る
  comment() {
    const { winner, kimarite, log } = this.result;
    const c = boutComment({ ...this.commentIn, won: winner === 'east', log, kimarite, n: session.career.basho ? session.career.basho.day : 1 });
    if (!c) return;
    // 動きの記録は決めの一合（最後の1行）だけにして、吹き出しの場所を空ける
    if (this.history.length > 1) {
      this.history = this.history.slice(-1);
      this.lines.setText(this.history[0]);
    }
    const name = (p) => ({
      stat: p.stat ? t(`stat.${p.stat}`) : undefined,
      scene: p.scene ? t(`scene.${p.scene}`) : undefined,
      mine: p.mine ? techLabel(p.mine) : undefined,
      theirs: p.theirs ? techLabel(p.theirs) : undefined,
      good: p.good ? techLabel(p.good) : undefined,
    });
    const str = c.keys.map((k) => t(k.key, name(k.params))).join('\n');
    const cy = COMMENT.top + COMMENT.h / 2;
    const bubbleLeft = COMMENT.left + COMMENT.face + 18;
    const objs = [
      ...speakerFace(this, c.who, COMMENT.left + COMMENT.face / 2, cy, COMMENT.face, 'normal'),
      ...speechBubble(this, bubbleLeft, COMMENT.top, COMMENT.right - bubbleLeft, COMMENT.h, str, { size: 24, min: 14 }),
    ];
    objs.forEach((o) => {
      const x = o.x;
      o.setAlpha(0).setX(x + 40);
      this.tweens.add({ targets: o, x, alpha: 1, duration: 260, ease: 'Cubic.Out' });
    });
  }

  cycleSpeed() {
    session.speed = SPEEDS[(SPEEDS.indexOf(session.speed) + 1) % SPEEDS.length];
    this.speedBtn.text.setText(this.speedLabel());
    this.speedBtn.text.setScale(1);
    fitText(this.speedBtn.text, 270 - 48);
    if (session.speed === 'result' && !this.done) {
      this.time.removeAllEvents();
      this.play();
    }
  }
}
