// src/scenes/HelpScene.js — 遊び方の3枚（20体版 Task 4・10/13／10/14 2つのボタンに書き直し）：ことねの顔と吹き出しで、紙相撲のたたき方を1枚ずつ
// 1枚目＝左が光ったら一押し（立ち合い）・そのあと連打で前へ・拍に合うと強い／2枚目＝決め技のゲージがたまると右が光る・右で決め技（左の連打では出ない）／
// 3枚目＝相手の攻めは赤い札で予告される・札を見て返す・倒れたら左を長押しで起きる（絵は立っている主人公と予告の札・左に答え「こらえ！」と赤いふち）
// 各枚に紙相撲の画面の小さな見本（箱・型紙・下の2つの大きなボタン）を、KamiScene と同じ描き方で小さく描く
// 入門の直後と、番付の「遊び方」から来る。どちらも閉じたら（はじめる・飛ばす）記録の seenHelp を true にして番付へ
import { KAMI } from '../core/kami.js?v=37';
import { kamiArt } from '../core/foeart.js?v=37';
import { HERO_TYPE, OKAMI } from '../data/heroes.js?v=37';
import { t } from '../i18n/i18n.js?v=37';
import { session, markHelpSeen } from '../state.js?v=37';
import { button, topTitle, fitText, roundBox, textStyle, speakerFace, speechBubble, preloadGuideArt, clearScene, COLORS } from '../ui/widgets.js?v=37';

const PAGES = 3;
const PANEL = { y: 470, w: 640, h: 560 }; // 見本の札（190〜750）
const MINI = { k: 0.62, ground: 556, boxH: 66 }; // 見本の紙相撲：箱の上の面の y・箱の前の面の高さ
const MINI_FIG_H = 250; // 見本の型紙の高さ
const MINI_BTN = { y: 684 }; // 見本の下のボタン2つ（箱の下）の高さ
const MINI_LEFT = { dx: -125, r: 54 }; // 左「押し」（真ん中から左へ）
const MINI_RIGHT = { dx: 118, r: 46 }; // 右「決め技」（左より小さい）
const BTN_COLOR = { go: 0xe3c27a, tap: 0xc8553d, hold: 0x3d6fc8, off: 0x3a3f4c, lit: 0xe3c27a, braceNow: 0xc8553d }; // kamibutton.js と同じ色（braceNow＝突っ張りの予告の間の左＝tap の色）
const LEFT_ALERT = 0xff4a4a; // 突っ張りの予告の間の左のふちの赤い光（KamiScene と同じ）
const WARN_RED = 0xb3261e; // 予告の札の赤（KamiScene と同じ）
const COACH = { faceX: 100, faceY: 880, size: 150, left: 190, top: 785, w: 500, h: 190 };
const FOOT_Y = 1190;
const HERO_KAMI = kamiArt(`hero_${HERO_TYPE}`);
const FOE_KAMI = kamiArt('foe_robot_normal'); // 1体目の相手（ロボット）

export class HelpScene extends Phaser.Scene {
  constructor() {
    super('help');
  }

  preload() {
    preloadGuideArt(this);
    [HERO_KAMI, FOE_KAMI].forEach((a) => { if (!this.textures.exists(a.key)) this.load.image(a.key, a.path); });
  }

  create() {
    if (!session.run) { this.scene.start('guide'); return; }
    this.page = 0;
    this.draw();
  }

  redraw() {
    this.time.delayedCall(0, () => this.draw()); // 押しの最中に部品を消さない
  }

  draw() {
    this.tweens.killAll();
    clearScene(this);
    const { width } = this.scale;
    topTitle(this, 60, t('help.title'), 52, COLORS.gold);
    // 何枚目か（点3つ・今の枚は金）
    for (let i = 0; i < PAGES; i++) {
      this.add.circle(width / 2 + (i - 1) * 36, 128, 10, i === this.page ? 0xe3c27a : 0x39436a);
    }
    roundBox(this, width / 2, PANEL.y, PANEL.w, PANEL.h, COLORS.panel, { radius: 32, stroke: COLORS.frame });
    this.mini(width, this.page);

    speakerFace(this, OKAMI, COACH.faceX, COACH.faceY, COACH.size);
    speechBubble(this, COACH.left, COACH.top, COACH.w, COACH.h, t(`help.${this.page + 1}`), { size: 32, min: 18 });

    const last = this.page === PAGES - 1;
    if (last) {
      button(this, width / 2, FOOT_Y, 520, 116, t('help.start'), () => this.close(), { size: 44 });
      return;
    }
    button(this, 165, FOOT_Y, 250, 100, t('help.skip'), () => this.close(), { size: 32, color: COLORS.buttonSub });
    button(this, 490, FOOT_Y, 380, 116, t('help.next'), () => {
      this.page += 1;
      this.redraw();
    }, { size: 44 });
  }

  close() {
    markHelpSeen();
    this.scene.start('ladder');
  }

  // 紙相撲の小さな見本：箱・紙の土俵・型紙2枚・下の大きなボタン。page で場面を変える
  mini(width, page) {
    const { ground, boxH, k } = MINI;
    const cx = width / 2;
    const boxW = (KAMI.BOX.r - KAMI.BOX.l) * k;
    const ringW = (KAMI.RING.r - KAMI.RING.l) * k;
    const g = this.add.graphics();
    g.fillStyle(0x8a6a3c, 1).fillRect(cx - boxW / 2, ground, boxW, boxH);
    g.fillStyle(0xb08a52, 1).fillRect(cx - boxW / 2 - 6, ground - 5, boxW + 12, 10);
    g.fillStyle(0xe8d6a6, 1).fillRect(cx - ringW / 2 - 18, ground - 4, ringW + 36, 6);
    g.fillStyle(0x6d4a1f, 1).fillRect(cx - ringW / 2 - 5, ground - 10, 10, 8).fillRect(cx + ringW / 2 - 5, ground - 10, 10, 8);
    fitText(this.add.text(cx, ground + boxH / 2, t('kami.box'), textStyle(34, '#3b2810')).setOrigin(0.5).setAlpha(0.6), boxW - 40);

    // 型紙：1枚目は離れて構える・2枚目はぶつかって押す・3枚目は立って向き合い、相手が予告の札を出している
    // 横向きの絵は幅が広い＝絵の幅の半分で並べる（1枚目は間をあけ、2枚目は手がふれ合うまで寄せる）
    const space = page === 0 ? 24 : page === 1 ? -26 : 0;
    const hero = this.fig(HERO_KAMI.key, cx, ground);
    const foe = this.fig(FOE_KAMI.key, cx, ground);
    if (hero) hero.setX(cx - hero.displayWidth / 2 - space / 2);
    if (foe) foe.setX(cx + foe.displayWidth / 2 + space / 2);
    if (page === 0) {
      // はっけよい（合図）
      fitText(this.add.text(cx, 270, t('kami.hakkeyoi'), textStyle(52, COLORS.gold, { stroke: '#141a2e', strokeThickness: 6 })).setOrigin(0.5), PANEL.w - 60);
    } else if (page === 1) {
      // 主人公が跳ねて押し合う・頭の上に決め技の金の帯（右のボタンが光っている時の画面）
      if (hero) {
        this.tweens.add({ targets: hero, y: ground - 22, duration: 180, yoyo: true, repeat: -1, repeatDelay: 120 });
        const bx = hero.x, by = ground - MINI_FIG_H - 30;
        this.add.rectangle(bx, by, 190, 46, 0xe3c27a, 0.92).setStrokeStyle(4, 0xfff3c4, 1);
        fitText(this.add.text(bx, by, t('kami.finish'), textStyle(30, '#3b2810')).setOrigin(0.5), 176);
      }
    } else {
      // 立っている主人公と、頭の上に赤い予告の札（突っ張り「来るぞ！」）と赤い光の相手。左のボタンに答え（「こらえ！」と赤いふち）
      if (foe) {
        foe.setTint(0xff7a7a);
        const bx = Math.min(foe.x, width - 130), by = ground - MINI_FIG_H - 30;
        this.add.rectangle(bx, by, 220, 52, WARN_RED, 0.95).setStrokeStyle(4, 0xffe3d6, 1);
        fitText(this.add.text(bx, by, t('kami.warn.tsuppari'), textStyle(32, '#ffffff', { stroke: '#4a0d08', strokeThickness: 5 })).setOrigin(0.5), 200);
      }
    }

    // 下の2つの大きなボタン（左「押し」・右「決め技」）：1枚目＝左が光る・右は暗い／2枚目＝右が光る／3枚目＝左に答え「こらえ！」・右は暗い
    const by = MINI_BTN.y;
    const left = ['go', 'tap', 'braceNow'][page];
    this.miniLeft(cx + MINI_LEFT.dx, by, MINI_LEFT.r, left);
    this.miniRight(cx + MINI_RIGHT.dx, by, MINI_RIGHT.r, page === 1);
  }

  // 左「押し」ボタンの見本（mode＝go・tap・hold・braceNow）。字と色は KamiScene の左と同じ
  miniLeft(bx, by, r, mode) {
    const btn = this.add.container(bx, by);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.35).fillCircle(0, 5, r);
    bg.fillStyle(BTN_COLOR[mode], 1).fillCircle(0, 0, r);
    bg.fillStyle(0xffffff, 0.12).fillCircle(0, -r * 0.35, r * 0.62);
    const dark = mode === 'go';
    const label = this.add.text(0, 0, t(`kami.btn.${mode}`), textStyle(24, dark ? '#3b2810' : COLORS.ink, { stroke: dark ? '#fff3c4' : '#141a2e', strokeThickness: 4 })).setOrigin(0.5);
    fitText(label, r * 2 - 16);
    btn.add([bg, label]);
    if (mode === 'go') {
      // 光って脈打つ
      this.tweens.add({ targets: btn, scale: 1.1, duration: 360, yoyo: true, repeat: -1 });
    } else if (mode === 'tap') {
      // ふちの輪が拍で光る・押すたびに沈む
      const ring = this.add.graphics().setPosition(bx, by);
      ring.lineStyle(10, 0xfff0c0, 1).strokeCircle(0, 0, r - 2);
      this.tweens.add({ targets: ring, alpha: 0.15, duration: KAMI.BEAT * 500, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: btn, scale: 0.9, duration: 90, yoyo: true, repeat: -1, repeatDelay: 120 });
    } else if (mode === 'braceNow') {
      // 突っ張りの予告の間：ふちの外に赤い光（脈打つ）
      const ring = this.add.graphics().setPosition(bx, by);
      ring.lineStyle(8, LEFT_ALERT, 1).strokeCircle(0, 0, r + 8);
      this.tweens.add({ targets: ring, alpha: 0.3, duration: 300, yoyo: true, repeat: -1 });
    } else {
      // 起き上がりの弧：上から時計回りに満ちていく
      const arc = this.add.graphics().setPosition(bx, by);
      const p = { v: 0 };
      const paint = () => {
        arc.clear();
        arc.lineStyle(10, 0x000000, 0.4).strokeCircle(0, 0, r + 9);
        if (p.v > 0) arc.lineStyle(10, 0x9cf0b4, 1).beginPath().arc(0, 0, r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.v, false).strokePath();
      };
      paint();
      this.tweens.add({ targets: p, v: 1, duration: 1400, repeat: -1, repeatDelay: 400, onUpdate: paint });
    }
  }

  // 右「決め技」ボタンの見本：lit＝光って脈打つ（金・外に金の光の輪）／暗い＝光っていない時（灰色・平ら）
  miniRight(bx, by, r, lit) {
    const btn = this.add.container(bx, by);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.35).fillCircle(0, lit ? 5 : 2, r);
    bg.fillStyle(lit ? BTN_COLOR.lit : BTN_COLOR.off, 1).fillCircle(0, 0, r);
    if (lit) bg.fillStyle(0xffffff, 0.12).fillCircle(0, -r * 0.35, r * 0.62);
    const label = this.add.text(0, 0, t('kami.btn.finish'), textStyle(22, lit ? '#3b2810' : '#a3a8b4', { stroke: lit ? '#fff3c4' : '#141a2e', strokeThickness: 4 })).setOrigin(0.5);
    fitText(label, r * 2 - 14);
    btn.add([bg, label]);
    if (!lit) return;
    const halo = this.add.graphics().setPosition(bx, by);
    halo.lineStyle(8, 0xffe08a, 1).strokeCircle(0, 0, r + 8);
    this.tweens.add({ targets: halo, alpha: 0.3, duration: 360, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: btn, scale: 1.1, duration: 360, yoyo: true, repeat: -1 });
  }

  // 見本の型紙（足もとが箱の面）。絵が無ければ置かない
  fig(key, x, y) {
    if (!this.textures.exists(key)) return null;
    const img = this.add.image(x, y, key).setOrigin(0.5, 1);
    img.setScale(MINI_FIG_H / img.height);
    return img;
  }
}
