// src/scenes/ClearScene.js — クリアの画面（20体版 Task 5・10/13）：横綱の土俵入り風。箱の土俵の真ん中に主人公の型紙を大きく立て、少しずつ揺らす
// 上に「横綱 誠ノ里 誕生！」とここまでの成績（倒した数・負け・稽古の回数）・続きは近日・はじめの画面へ（v43 本人「全勝後のLINEで送るは無しで」＝LINEの共有は消した）
// 型紙＝正面の立ち絵に白い縁（紙の切り抜き）と小さな台。露払い・太刀持ちは置かない
import { HERO_TYPE } from '../data/heroes.js?v=51';
import { heroArt } from '../core/foeart.js?v=51';
import { t, heroName } from '../i18n/i18n.js?v=51';
import { session } from '../state.js?v=51';
import { GROUND, BOX_H, preloadArena, drawArena } from '../ui/arena.js?v=51';
import { drawWaUnder } from '../ui/backdrop.js?v=51';
import { button, addAura, preloadHeroFigures, textStyle, fitText, roundBox, COLORS } from '../ui/widgets.js?v=51';

const FIG_H = 500; // 型紙の高さ（取組の 330 より大きく）
const EDGE = 8; // 紙の白い縁の太さ
const SWAY = 0.045; // 揺れの角度（ラジアン）
const CONFETTI = [0xe3c27a, 0xfff3c4, 0xc8553d, 0x9cf0b4, 0x8fc4ff];

export class ClearScene extends Phaser.Scene {
  constructor() {
    super('clear');
  }

  preload() {
    preloadArena(this);
    preloadHeroFigures(this);
  }

  create() {
    const r = session.run;
    if (!r) { this.scene.start('guide'); return; }
    const { width } = this.scale;
    drawArena(this); // 背景＝土俵（bgkey.menuBgKey('clear')）
    drawWaUnder(this, GROUND + BOX_H); // 箱の下の藍に青海波・ふちに和紙の色の枠
    this.confetti(width);
    this.cutout(width / 2);

    // 上：見出しと成績
    const title = this.add.text(width / 2, 120, t('clear.title', { name: heroName(r.type || HERO_TYPE) }), textStyle(58, COLORS.gold, { stroke: '#141a2e', strokeThickness: 8 })).setOrigin(0.5).setDepth(10);
    fitText(title, width - 50);
    const base = title.scaleX;
    title.setScale(base * 0.5);
    this.tweens.add({ targets: title, scaleX: base, scaleY: base, duration: 420, ease: 'Back.easeOut' });
    roundBox(this, width / 2, 205, 640, 64, COLORS.panel, { radius: 32, stroke: COLORS.frame }).setAlpha(0.92).setDepth(10); // 紙吹雪より前
    fitText(this.add.text(width / 2, 205, t('clear.stats', { wins: r.wins, losses: r.losses, trainings: r.trainings || 0 }), textStyle(30, COLORS.ink)).setOrigin(0.5).setDepth(10), 600);

    // 下：続きは近日・はじめの画面へ
    fitText(this.add.text(width / 2, 1010, t('clear.next'), textStyle(36, COLORS.gold)).setOrigin(0.5), width - 60);
    button(this, width / 2, 1130, 460, 100, t('clear.top'), () => this.scene.start('guide'), { size: 36, color: COLORS.buttonSub });
  }

  // 型紙1枚：白い縁（同じ絵を白で塗って一回り大きく後ろに）・足もとの台・虹の光。足もとを軸に左右へゆっくり揺らす
  cutout(x) {
    const key = heroArt(HERO_TYPE).key;
    const c = this.add.container(x, GROUND).setDepth(2);
    this.add.ellipse(x, GROUND + 2, 260, 26, 0x000000, 0.3);
    if (this.textures.exists(key)) {
      const img = this.add.image(0, -14, key).setOrigin(0.5, 1);
      const k = FIG_H / img.height;
      img.setScale(k);
      const paper = this.add.image(0, -14 + EDGE, key).setOrigin(0.5, 1).setTintFill(0xfffdf6);
      paper.setScale((img.displayWidth + EDGE * 2) / paper.width, (img.displayHeight + EDGE * 2) / paper.height);
      c.add(paper);
      c.add(img);
      addAura(this, paper, 'rainbow');
    }
    const stand = this.add.graphics();
    stand.fillStyle(0xe8dcc0, 1).fillRect(-70, -16, 140, 16);
    stand.fillStyle(0xc9b994, 1).fillRect(-70, -4, 140, 4);
    c.add(stand);
    c.setRotation(-SWAY);
    this.tweens.add({ targets: c, rotation: SWAY, duration: 1400, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    this.tweens.add({ targets: c, scaleX: 1.03, scaleY: 1.03, duration: 700, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
  }

  // 紙吹雪：小さな色紙が上から舞い落ちる（くり返す）
  confetti(width) {
    for (let i = 0; i < 36; i++) {
      const p = this.add.rectangle(Math.random() * width, -20 - Math.random() * 400, 10 + Math.random() * 8, 6 + Math.random() * 6, CONFETTI[i % CONFETTI.length]).setDepth(1);
      const fall = () => {
        p.setPosition(Math.random() * width, -20);
        this.tweens.add({
          targets: p, y: GROUND - 10, x: p.x + (Math.random() - 0.5) * 160, angle: 360 * (Math.random() < 0.5 ? -1 : 1),
          duration: 2600 + Math.random() * 2200, onComplete: fall,
        });
      };
      this.tweens.add({ targets: p, y: GROUND - 10, angle: 270, duration: 1800 + Math.random() * 2600, onComplete: fall });
    }
  }
}
