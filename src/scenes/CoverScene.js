// src/scenes/CoverScene.js — 表紙（10/14 本人「表紙を…冒頭に」）：土俵の絵の上に題名・主人公と50体目の大ボスの型紙が向き合う・「画面をたたいて はじめる」
// 新しい絵は無し（今ある土俵の背景と型紙だけ）。たたくと音を起こし（最初の手ざわり＝main.js の unlockOnGesture が音楽を起こす）、ぽんを鳴らして記録を選ぶ画面（guide）へ
import { t } from '../i18n/i18n.js?v=60';
import { signalGameReady } from '../platform.js?v=60';
import { kamiArt, foeArt, foeAura } from '../core/foeart.js?v=60';
import { PLAY_COUNT } from '../core/ladder.js?v=60';
import { foeAt } from '../data/foes.js?v=60';
import { HERO_TYPE } from '../data/heroes.js?v=60';
import { preloadArena } from '../ui/arena.js?v=60';
import { edgeFade } from '../ui/backdrop.js?v=60';
import { addAura, fitText, textStyle, COLORS, clearScene } from '../ui/widgets.js?v=60';
import { playBout } from '../ui/sfx.js?v=60';

const BOSS = foeAt(PLAY_COUNT - 1); // 50体目の大ボス（鬼の大横綱・foeArt・foeAura は index と段階と id で絵と光を決める）
const GROUND_Y = 905; // 型紙の足もと（土俵の絵の楕円の下のあたり）
const HERO_H = 400;
const BOSS_H = 450;
const OPEN_GUARD_MS = 500; // 表紙が出てからこの間は、前の画面からの二度たたきでは進まない
const SHADOW = [0, 4, '#0a0f20', 8, false, true];

export class CoverScene extends Phaser.Scene {
  constructor() {
    super('cover');
  }

  preload() {
    preloadArena(this); // 土俵の背景（KamiScene と同じ読み方）
    const load = (a) => { if (!this.textures.exists(a.key)) this.load.image(a.key, a.path); };
    load(kamiArt(`hero_${HERO_TYPE}`));
    load(kamiArt(foeArt(BOSS).file));
  }

  create() {
    this.leaving = false;
    signalGameReady(); // Playables 版：表紙＝たたいて始められる＝ YouTube へ gameReady（注意書きの札の間は送らない）
    this.guardUntil = Date.now() + OPEN_GUARD_MS;
    clearScene(this);
    const { width, height } = this.scale;
    if (this.textures.exists('dohyo-bg')) {
      const bg = this.add.image(0, 0, 'dohyo-bg').setOrigin(0, 0);
      bg.setScale(width / bg.width).setCrop(0, 0, bg.width, height / (width / bg.width));
    }
    this.add.rectangle(0, 0, width, height, 0x141a2e, 0.38).setOrigin(0, 0);
    edgeFade(this, { depth: 0 }); // 絵の上下左右の端を藍へ溶かす＝ページの余白（藍）と段差が出ない（v42 第2段）
    // 題名と副題
    fitText(this.add.text(width / 2, 170, t('title'), textStyle(104, COLORS.gold, { stroke: '#141a2e', strokeThickness: 10 })).setOrigin(0.5).setShadow(...SHADOW), width - 60);
    fitText(this.add.text(width / 2, 285, t('cover.sub'), textStyle(40, COLORS.ink)).setOrigin(0.5).setShadow(...SHADOW), width - 60);
    // 型紙2枚（主人公は右向き・大ボスは左向き＝KamiScene の東・西と同じ絵の向き）がゆっくり上下にゆれる
    this.figure(kamiArt(`hero_${HERO_TYPE}`), 195, HERO_H, 0);
    const boss = this.figure(kamiArt(foeArt(BOSS).file), 525, BOSS_H, 600);
    if (boss) addAura(this, boss, foeAura(BOSS));
    // たたいて はじめる（点滅）・一番下に小さく © と版
    const tap = fitText(this.add.text(width / 2, 1085, t('cover.tap'), textStyle(46, COLORS.gold)).setOrigin(0.5).setShadow(...SHADOW), width - 60);
    this.tweens.add({ targets: tap, alpha: 0.25, duration: 750, yoyo: true, repeat: -1 });
    this.credit = this.add.text(width / 2, 1235, t('cover.credit'), textStyle(28, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5);
    this.loadVersion();
    this.input.on('pointerdown', () => this.start());
  }

  // 型紙1枚（足もとが x, GROUND_Y）＋足もとの影。無ければ何も出さない
  figure(art, x, h, delay) {
    if (!this.textures.exists(art.key)) return null;
    this.add.ellipse(x, GROUND_Y + 6, h * 0.62, 26, 0x000000, 0.35);
    const img = this.add.image(x, GROUND_Y, art.key).setOrigin(0.5, 1);
    img.setScale(h / img.height);
    this.tweens.add({ targets: img, y: GROUND_Y - 14, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay });
    return img;
  }

  // 版（version.json の v）。読めなければ出さない
  loadVersion() {
    if (typeof fetch !== 'function') return;
    fetch('version.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && j.v != null && this.credit && this.credit.active) this.credit.setText(`${t('cover.credit')}  v${j.v}`);
      })
      .catch(() => {});
  }

  start() {
    if (this.leaving || Date.now() < this.guardUntil) return;
    this.leaving = true;
    playBout('pon');
    this.scene.start('guide');
  }
}
