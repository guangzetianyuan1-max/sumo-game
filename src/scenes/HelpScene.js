// src/scenes/HelpScene.js — 遊び方の3枚（20体版 Task 4・10/13）：ことねの顔と吹き出しで、紙相撲のたたき方を1枚ずつ
// 1枚目＝光ったら一押し（立ち合い）・2枚目＝連打で前へ・拍に合うと強い（押し合い）・3枚目＝倒れたら長押しで起きる
// 各枚に紙相撲の画面の小さな見本（箱・型紙・下の大きなボタン）を、KamiScene と同じ描き方で小さく描く
// 入門の直後と、番付の「遊び方」から来る。どちらも閉じたら（はじめる・飛ばす）記録の seenHelp を true にして番付へ
import { KAMI } from '../core/kami.js?v=33';
import { kamiArt } from '../core/foeart.js?v=33';
import { HERO_TYPE, OKAMI } from '../data/heroes.js?v=33';
import { t } from '../i18n/i18n.js?v=33';
import { session, markHelpSeen } from '../state.js?v=33';
import { button, topTitle, fitText, roundBox, textStyle, speakerFace, speechBubble, preloadGuideArt, clearScene, COLORS } from '../ui/widgets.js?v=33';

const PAGES = 3;
const PANEL = { y: 470, w: 640, h: 560 }; // 見本の札（190〜750）
const MINI = { k: 0.62, ground: 556, boxH: 66 }; // 見本の紙相撲：箱の上の面の y・箱の前の面の高さ
const MINI_FIG_H = 250; // 見本の型紙の高さ
const MINI_BTN = { y: 684, r: 56 }; // 見本の下のボタン（箱の下）
const BTN_COLOR = { go: 0xe3c27a, tap: 0xc8553d, hold: 0x3d6fc8 }; // kamibutton.js と同じ色
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

    // 型紙：1枚目は離れて構える・2枚目はぶつかって押す・3枚目は主人公が倒れている
    // 横向きの絵は幅が広い＝絵の幅の半分で並べる（1枚目は間をあけ、2枚目は手がふれ合うまで寄せる）
    const space = page === 0 ? 24 : -26;
    const hero = this.fig(HERO_KAMI.key, cx, ground);
    const foe = this.fig(FOE_KAMI.key, cx, ground);
    if (hero) hero.setX(cx - hero.displayWidth / 2 - space / 2);
    if (foe) foe.setX(cx + foe.displayWidth / 2 + space / 2);
    if (page === 0) {
      // はっけよい（合図）
      fitText(this.add.text(cx, 270, t('kami.hakkeyoi'), textStyle(52, COLORS.gold, { stroke: '#141a2e', strokeThickness: 6 })).setOrigin(0.5), PANEL.w - 60);
    } else if (page === 1) {
      // 主人公が跳ねて前へ（連打の見本）＋前への矢印
      if (hero) this.tweens.add({ targets: hero, y: ground - 22, duration: 180, yoyo: true, repeat: -1, repeatDelay: 120 });
      const a = this.add.graphics();
      a.fillStyle(0xfff0c0, 0.9).fillTriangle(cx + 30, 252, cx + 30, 292, cx + 72, 272).fillRect(cx - 50, 264, 80, 16);
    } else {
      // 倒れた主人公（後ろへ寝る・箱の上に収まるよう足もとを真ん中へ）。相手は少し離れて立つ
      if (hero) hero.setRotation(-1.45).setX(cx + 20);
      if (foe) foe.setX(cx + foe.displayWidth / 2 + 50);
    }

    // 下の大きなボタン（場面の字と色）
    const mode = ['go', 'tap', 'hold'][page];
    const bx = cx, by = MINI_BTN.y, r = MINI_BTN.r;
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

  // 見本の型紙（足もとが箱の面）。絵が無ければ置かない
  fig(key, x, y) {
    if (!this.textures.exists(key)) return null;
    const img = this.add.image(x, y, key).setOrigin(0.5, 1);
    img.setScale(MINI_FIG_H / img.height);
    return img;
  }
}
