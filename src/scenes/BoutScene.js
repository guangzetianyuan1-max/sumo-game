// src/scenes/BoutScene.js — 取組を仮の四角で見せる（ドットの絵は第4段）
import { runBout } from '../core/bout.js?v=2';
import { makeWrestler } from '../core/wrestler.js?v=2';
import { TYPES } from '../data/types.js?v=2';
import { t, techLabel } from '../i18n/i18n.js?v=2';
import { session, nextOpponent } from '../state.js?v=2';
import { button, fitText, roundBox, FONT, COLORS } from '../ui/widgets.js?v=2';

const STEP_MS = { normal: 1200, fast: 500 };
const SPEEDS = ['normal', 'fast', 'result'];
const EAST_BAND = 0x3f6aa8;
const WEST_BAND = 0xc8553d;
const FEET_Y = 640; // 土俵の上の縁（力士の足もと）

export class BoutScene extends Phaser.Scene {
  constructor() {
    super('bout');
  }

  create() {
    this.done = false;
    this.lastPos = 0;
    this.history = [];
    this.i = 0;
    session.seed += 1;
    const you = makeWrestler(session.you);
    const opp = makeWrestler(session.opp);
    this.result = runBout({ wrestler: you, strategy: session.strategy }, { wrestler: opp, strategy: session.oppStrategy }, session.seed);

    const { width } = this.scale;
    this.cx = width / 2;
    this.drawStage();
    const half = width / 2 - 40;
    fitText(this.add.text(30, 120, t('bout.sideType', { side: t('bout.east'), type: t(`type.${session.you}.name`) }), { fontFamily: FONT, fontSize: 32, color: COLORS.ink }), half);
    fitText(this.add.text(width - 30, 120, t('bout.sideType', { side: t('bout.west'), type: t(`type.${session.opp}.name`) }), { fontFamily: FONT, fontSize: 32, color: COLORS.ink }).setOrigin(1, 0), half);
    this.east = this.body(session.you, EAST_BAND, 1);
    this.west = this.body(session.opp, WEST_BAND, -1);
    this.east.setPosition(this.cx - 80, FEET_Y);
    this.west.setPosition(this.cx + 80, FEET_Y);
    this.sceneLabel = this.add.text(30, 808, '', { fontFamily: FONT, fontSize: 28, color: COLORS.gold });
    this.lines = this.add.text(30, 852, '', { fontFamily: FONT, fontSize: 30, color: COLORS.ink, lineSpacing: 12, wordWrap: { width: width - 60, useAdvancedWrap: true } });
    this.speedBtn = button(this, width - 160, 50, 270, 72, this.speedLabel(), () => this.cycleSpeed(), { color: COLORS.buttonSub, size: 26 });
    this.play();
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
    if (session.speed === 'result') {
      this.showEntry(log.at(-1));
      this.finish();
      return;
    }
    if (this.i >= log.length) {
      this.finish();
      return;
    }
    this.showEntry(log[this.i++]);
    this.time.delayedCall(STEP_MS[session.speed], () => this.play());
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
    const side = t(winner === 'east' ? 'bout.east' : 'bout.west');
    const { width } = this.scale;
    // 屋根や飾りの上でも読めるよう、字の下に濃い丸い台を敷く
    const back = this.add.graphics();
    back.fillStyle(COLORS.panel, 0.85);
    back.fillRoundedRect(this.cx - 330, 231, 660, 150, 24);
    fitText(this.add.text(this.cx, 280, t('bout.win', { side }), { fontFamily: FONT, fontSize: 72, color: COLORS.gold }).setStroke(COLORS.bg, 8).setOrigin(0.5), width - 60);
    fitText(this.add.text(this.cx, 345, t('bout.kimarite', { tech: techLabel(kimarite) }), { fontFamily: FONT, fontSize: 46, color: COLORS.ink }).setStroke(COLORS.bg, 6).setOrigin(0.5), width - 60);
    // 作戦を直す（同じ相手のまま作戦表へ）は小さく上に。次の相手を引くと相手の作戦表は見本から組み直す
    button(this, this.cx, 1105, 320, 64, t('bout.edit'), () => this.scene.start('strategy'), { color: COLORS.buttonSub, size: 26 });
    button(this, this.cx - 175, 1220, 320, 100, t('bout.next'), () => {
      nextOpponent();
      this.scene.start('strategy');
    }, { size: 36 });
    button(this, this.cx + 175, 1220, 320, 100, t('bout.rematch'), () => this.scene.restart(), { color: COLORS.buttonSub, size: 36 });
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
