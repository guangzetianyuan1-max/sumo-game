// src/scenes/GuideScene.js — 最初の画面：題・言葉の切り替え・記録①〜③の札（10/11 本人「昔話と同じように最大3つの四股名ですすめられるように」）。
// 中身のある札を押す＝その記録のつづきへ（その時の画面へ）。空きの札を押す＝その記録でそのまま入門（10/13〜主人公はバランス型・案内役は若女将に固定＝選ぶ画面なし → 遊び方の3枚 → 番付表）。
// 中身のある札の「はじめから」は2度押し（1度目は知らせるだけ・指1本の二重発火は数えない）で、その記録を消して入門へ
import { HERO_TYPE, OKAMI } from '../data/heroes.js?v=39';
import { t, getLang, setLang, heroName } from '../i18n/i18n.js?v=39';
import { session, startRun, SLOT_COUNT, slotState, useRun, resumeScene, rememberSlot, lastSlot, clearSlot, slotSummary } from '../state.js?v=39';
import { button, fitText, roundBox, hitZone, textStyle, preloadTypeArt, preloadHeroFigures, heroKey, COLORS, storage, clearScene } from '../ui/widgets.js?v=39';
import { secondPress } from '../ui/press.js?v=39';
import { playBout } from '../ui/sfx.js?v=39';

const CARD = { w: 640, h: 300, top: 210, gap: 40 }; // 札3枚：210〜1190（下に知らせの1行）
const NEW = { w: 200, h: 64 }; // 札の右下の「はじめから」
const PAD = 28;
const ART_H = 190;

export class GuideScene extends Phaser.Scene {
  constructor() {
    super('guide');
  }

  preload() {
    preloadTypeArt(this);
    preloadHeroFigures(this);
  }

  create() {
    this.armed = null; // 「はじめから」の1度目 { n, at }
    this.draw();
  }

  redraw() {
    this.time.delayedCall(0, () => this.draw()); // 押しの最中に札を消さない
  }

  draw() {
    clearScene(this);
    const { width } = this.scale;
    fitText(this.add.text(40, 55, t('title'), textStyle(56, COLORS.gold)).setOrigin(0, 0.5), width - 280);
    button(this, width - 105, 55, 170, 70, t('lang.toggle'), () => {
      setLang(getLang() === 'ja' ? 'en' : 'ja', storage());
      document.documentElement.lang = getLang();
      this.scene.restart();
    }, { size: 28, color: COLORS.buttonSub });
    fitText(this.add.text(width / 2, 150, t('slot.pick'), textStyle(36, COLORS.ink)).setOrigin(0.5), width - 80);
    const last = lastSlot();
    for (let n = 1; n <= SLOT_COUNT; n++) {
      const cy = CARD.top + CARD.h / 2 + (n - 1) * (CARD.h + CARD.gap);
      this.card(n, width / 2, cy, slotState(n), n === last);
    }
    if (this.armed) {
      // 「はじめから」の1度目：押しても消さない理由（もう一度押すと消える）を一番下に出す
      fitText(this.add.text(width / 2, 1236, t('slot.confirm'), textStyle(28, COLORS.gold, { align: 'center' })).setOrigin(0.5), width - 60);
    }
  }

  // 記録の札。saved＝{ run } | { old: true } | null（空き）
  card(n, x, y, saved, isLast) {
    const run = saved && saved.run ? saved.run : null;
    const sum = slotSummary(run);
    const left = x - CARD.w / 2;
    const right = x + CARD.w / 2;
    const top = y - CARD.h / 2;
    const gfx = roundBox(this, x, y, CARD.w, CARD.h, sum ? COLORS.panel : COLORS.empty, { radius: 32, stroke: COLORS.frame });
    this.add.text(left + PAD, top + 38, t(`slot.${n}`), textStyle(30, COLORS.gold)).setOrigin(0, 0.5);
    const zone = hitZone(this, x, y, CARD.w, CARD.h);
    let down = false; // 押しはこの札の上で始まったものだけ数える（widgets.button と同じ・外で押して滑り込んだ離しは無視）
    zone.on('pointerdown', () => { down = true; gfx.setAlpha(0.8); });
    zone.on('pointerout', () => { down = false; gfx.setAlpha(1); });

    if (!sum) {
      const old = !!(saved && saved.old);
      fitText(this.add.text(x, y - 6, t(old ? 'slot.old' : 'slot.empty'), textStyle(56, COLORS.sub)).setOrigin(0.5), CARD.w - 60);
      fitText(this.add.text(x, y + 60, t(old ? 'slot.oldSub' : 'slot.emptySub'), textStyle(28, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), CARD.w - 60);
      zone.on('pointerup', () => {
        gfx.setAlpha(1);
        if (!down) return;
        down = false;
        playBout('pon');
        if (old) clearSlot(n); // 古い版の記録は読めない＝消して新しく入門
        session.slot = n; // 入門を終えた時にこの記録へ書き、前回として覚える
        this.startNew();
      });
      return;
    }

    if (isLast) {
      this.add.text(right - PAD, top + 38, t('slot.last'), textStyle(28, COLORS.gold, { fontStyle: '500' })).setOrigin(1, 0.5);
    }
    // 左に自分のタイプの絵、右にしこ名（大）・番付・タイプ
    const key = heroKey(this, sum.type);
    let tx = left + PAD;
    if (this.textures.exists(key)) {
      const img = this.add.image(0, y + 22, key);
      img.setScale(ART_H / img.height);
      img.setX(left + PAD + img.displayWidth / 2);
      tx = left + PAD + img.displayWidth + 24;
    }
    const room = right - PAD - tx;
    fitText(this.add.text(tx, top + 112, heroName(sum.type), textStyle(60, COLORS.ink)).setOrigin(0, 0.5), room);
    fitText(this.add.text(tx, top + 172, t(`div.${sum.rank}`), textStyle(30, COLORS.ink)).setOrigin(0, 0.5), room);
    fitText(this.add.text(tx, top + 222, sum.cleared ? t('slot.clear') : t('slot.count', { n: sum.wins }), textStyle(28, COLORS.sub, { fontStyle: '500' })).setOrigin(0, 0.5), right - PAD - NEW.w - 16 - tx);

    zone.on('pointerup', () => {
      gfx.setAlpha(1);
      if (!down) return;
      down = false;
      playBout('pon');
      // つづきから：記録の案内役・主人公のまま、その時の画面へ
      rememberSlot(n);
      useRun(run);
      this.scene.start(resumeScene(run));
    });

    // はじめから（札の押し当たりより後に置く＝上にある方だけが押しを受ける）
    const armedHere = this.armed && this.armed.n === n;
    button(this, right - PAD - NEW.w / 2, top + CARD.h - PAD - NEW.h / 2, NEW.w, NEW.h, t('slot.new'), () => this.pressNew(n), {
      size: 28, color: armedHere ? COLORS.button : COLORS.buttonSub,
    });
  }

  pressNew(n) {
    const now = Date.now();
    if (this.armed && this.armed.n === n) {
      if (!secondPress(this.armed.at, now)) return; // 同じ押しの二重発火は数えない（1度目のまま）
      clearSlot(n);
      session.slot = n;
      this.startNew();
      return;
    }
    this.armed = { n, at: now };
    this.redraw();
  }

  // 新しい一代記の流れへ（記録は入門を終えた時に session.slot へ書く）
  startNew() {
    session.run = null;
    session.guide = null;
    session.lastBout = null;
    session.oppKey = null;
    startRun({ guide: OKAMI, type: HERO_TYPE, seed: Date.now() % 1000000 });
    this.scene.start('help'); // 遊び方の3枚を通って番付へ（閉じる時に記録の seenHelp を true に）
  }
}
