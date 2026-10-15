// src/scenes/KenshoScene.js — 懸賞旗（20体版 Task 5・10/13）：取組の前に、懸賞旗2本が土俵の前を左から右へ渡る（約3秒）→ 取組（kami）
// 土俵は取組と同じ箱と土俵（src/ui/arena.js）。型紙2枚は立ち合いの位置に立たせておく。たたくと飛ばせる
// 旗の字は i18n の架空の名前だけ（ひまなぶた・琴浪部屋）。日本語は縦書き（1字ずつ改行）・英語は90度回して読む
import { foeArt, kamiArt, heroArt, foeAura, stageScale } from '../core/foeart.js?v=44';
import { currentFoe } from '../core/run.js?v=44';
import { HERO_TYPE } from '../data/heroes.js?v=44';
import { t, getLang, foeLabel } from '../i18n/i18n.js?v=44';
import { session, prepareOpponent } from '../state.js?v=44';
import { playBout } from '../ui/sfx.js?v=44';
import { GROUND, BOX_H, preloadArena, drawArena } from '../ui/arena.js?v=44';
import { drawWaUnder } from '../ui/backdrop.js?v=44';
import { preloadHeroFigures, addAura, textStyle, fitText, COLORS } from '../ui/widgets.js?v=44';

const PARADE_MS = 3000; // 旗が渡りきる長さ
const FLAG = { w: 96, h: 330, pole: 470, gap: 260 }; // 布の幅と高さ・竿の長さ（地面から）・2本の間
const FIG_H = 330; // 取組と同じ型紙の高さ
const START_X = { east: 234, west: 486 }; // 立ち合いの見た目の位置（取組の始め＝計算の 290・430 を横向きの絵の幅だけ 56 ずつ外へ）
const CLOTH = [0x2f6b4f, 0x8a2f3a]; // 布の色（緑・えんじ）
const TXT_SHADOW = [0, 3, '#0a0f20', 6, false, true];

export class KenshoScene extends Phaser.Scene {
  constructor() {
    super('kensho');
  }

  preload() {
    preloadArena(this);
    preloadHeroFigures(this);
    const load = (a) => { if (!this.textures.exists(a.key)) this.load.image(a.key, a.path); };
    load(kamiArt(`hero_${HERO_TYPE}`));
    const foe = session.run ? currentFoe(session.run) : null;
    if (foe) {
      load(kamiArt(foeArt(foe).file));
      load(foeArt(foe));
    }
  }

  create() {
    const foe = session.run ? prepareOpponent() : null;
    if (!foe) { this.scene.start(session.run ? 'ladder' : 'guide'); return; }
    const { width } = this.scale;
    this.leaving = false;
    drawArena(this); // 背景＝土俵（bgkey.menuBgKey('kensho')）
    drawWaUnder(this, GROUND + BOX_H); // 箱の下の藍に青海波・ふちに和紙の色の枠
    fitText(this.add.text(width / 2, 132, foeLabel(foe), textStyle(34, COLORS.ink)).setOrigin(0.5).setShadow(...TXT_SHADOW), width - 80);

    // 型紙2枚（取組の始めと同じ向き・位置）
    this.figure(kamiArt(`hero_${HERO_TYPE}`).key, heroArt(HERO_TYPE).key, START_X.east, FIG_H);
    const w = this.figure(kamiArt(foeArt(foe).file).key, foeArt(foe).key, START_X.west, FIG_H * stageScale(foe.stage));
    if (w) addAura(this, w, foeAura(foe));

    // 懸賞旗2本：画面の左の外から右の外へ。少し上下に揺れながら
    const flags = ['kensho.flag1', 'kensho.flag2'].map((k, i) => this.flag(t(k), CLOTH[i]));
    const span = width + FLAG.w * 2 + FLAG.gap;
    const o = { p: 0 };
    this.tweens.add({
      targets: o, p: 1, duration: PARADE_MS, ease: 'Linear',
      onUpdate: () => flags.forEach((f, i) => {
        const x = -FLAG.w + o.p * span - i * FLAG.gap;
        f.setPosition(x, Math.sin((o.p * 6 + i) * Math.PI) * 6);
        f.setRotation(Math.sin((o.p * 4 + i * 0.5) * Math.PI) * 0.03);
      }),
      onComplete: () => this.go(),
    });

    // 上に「懸賞がかかりました」と、下に小さく「たたくと飛ばせます」
    const title = this.add.text(width / 2, 260, t('kensho.title'), textStyle(64, COLORS.gold, { stroke: '#141a2e', strokeThickness: 8 })).setOrigin(0.5).setDepth(10);
    fitText(title, width - 60);
    title.setScale(title.scaleX * 0.6).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, scaleX: title.scaleX / 0.6, scaleY: title.scaleY / 0.6, duration: 260, ease: 'Back.easeOut' });
    fitText(this.add.text(width / 2, GROUND + 200, t('kensho.skip'), textStyle(30, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), width - 60);

    // 旗がはためく音：渡る3秒の間に、小さくなりながら3回
    [[0, 1], [1000, 0.7], [2000, 0.5]].forEach(([ms, vol]) => this.time.delayedCall(ms, () => { if (!this.leaving) playBout('flags', vol); }));

    this.input.once('pointerdown', () => this.go());
  }

  figure(key, fallback, x, h) {
    const k = this.textures.exists(key) ? key : this.textures.exists(fallback) ? fallback : null;
    if (!k) return null;
    const img = this.add.image(x, GROUND, k).setOrigin(0.5, 1);
    img.setScale(h / img.height);
    return img;
  }

  // 旗1本：竿（下は地面の少し下まで）・上の横木・縦長の布・縦書きの字。足もと（竿の下）が container の原点
  flag(str, cloth) {
    const c = this.add.container(0, 0).setDepth(5);
    const top = GROUND + 40 - FLAG.pole;
    const g = this.add.graphics();
    g.fillStyle(0x6d4a1f, 1).fillRect(-4, top, 8, FLAG.pole); // 竿
    g.fillStyle(0x3b2810, 1).fillRect(-FLAG.w / 2 - 8, top + 6, FLAG.w + 16, 8); // 横木
    g.fillStyle(0x000000, 0.25).fillRect(-FLAG.w / 2 + 5, top + 19, FLAG.w, FLAG.h); // 布の影
    g.fillStyle(cloth, 1).fillRect(-FLAG.w / 2, top + 14, FLAG.w, FLAG.h); // 布
    g.fillStyle(0xfff3e0, 1).fillRect(-FLAG.w / 2 + 10, top + 26, FLAG.w - 20, FLAG.h - 24); // 白い字の地
    // 布の下のぎざぎざ（房）
    g.fillStyle(cloth, 1);
    for (let x = -FLAG.w / 2; x < FLAG.w / 2; x += 16) g.fillTriangle(x, top + 14 + FLAG.h, x + 16, top + 14 + FLAG.h, x + 8, top + 28 + FLAG.h);
    c.add(g);
    const ja = getLang() === 'ja';
    const cy = top + 26 + (FLAG.h - 24) / 2;
    const txt = ja
      ? this.add.text(0, cy, Array.from(str).join('\n'), textStyle(46, '#141a2e', { align: 'center', lineSpacing: -6 })).setOrigin(0.5)
      : this.add.text(0, cy, str, textStyle(40, '#141a2e')).setOrigin(0.5).setRotation(Math.PI / 2);
    // 白い地の中に収める（縦書きは高さ・回した英語は長さを地の高さに）
    const room = FLAG.h - 40;
    const along = ja ? txt.height : txt.width;
    const across = ja ? txt.width : txt.height;
    const k = Math.min(1, room / along, (FLAG.w - 28) / across);
    txt.setScale(k);
    c.add(txt);
    return c;
  }

  go() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('kami');
  }
}

