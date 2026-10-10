// src/scenes/GuideScene.js — 最初の画面：題・言葉の切り替え・記録①〜③の札（10/11 本人「昔話と同じように最大3つの四股名ですすめられるように」）。
// 中身のある札を押す＝その記録のつづきへ（その時の画面へ）。空きの札を押す＝その記録で新しく入門（相撲部屋 → タイプ → しこ名 → 稽古）。
// 中身のある札の「はじめから」は2度押し（1度目は知らせるだけ・指1本の二重発火は数えない）で、その記録を消して入門へ
import { t, getLang, setLang, rankLabel, shikonaLabel } from '../i18n/i18n.js?v=20';
import { session, SLOT_COUNT, loadSaved, useCareer, resumeScene, rememberSlot, lastSlot, clearSlot, slotSummary } from '../state.js?v=20';
import { heyaOfGuide } from '../data/heya.js?v=20';
import { button, fitText, roundBox, hitZone, textStyle, preloadTypeArt, COLORS, storage, clearScene } from '../ui/widgets.js?v=20';
import { secondPress } from '../ui/press.js?v=20';

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
      this.card(n, width / 2, cy, loadSaved(undefined, n), n === last);
    }
    if (this.armed) {
      // 「はじめから」の1度目：押しても消さない理由（もう一度押すと消える）を一番下に出す
      fitText(this.add.text(width / 2, 1236, t('slot.confirm'), textStyle(28, COLORS.gold, { align: 'center' })).setOrigin(0.5), width - 60);
    }
  }

  // 記録の札。saved＝読めた一代記（空き・読めない記録は null）
  card(n, x, y, saved, isLast) {
    const sum = slotSummary(saved);
    const left = x - CARD.w / 2;
    const right = x + CARD.w / 2;
    const top = y - CARD.h / 2;
    const gfx = roundBox(this, x, y, CARD.w, CARD.h, sum ? COLORS.panel : COLORS.empty, { radius: 32, stroke: COLORS.frame });
    this.add.text(left + PAD, top + 38, t(`slot.${n}`), textStyle(30, COLORS.gold)).setOrigin(0, 0.5);
    const zone = hitZone(this, x, y, CARD.w, CARD.h);
    zone.on('pointerdown', () => gfx.setAlpha(0.8));
    zone.on('pointerout', () => gfx.setAlpha(1));

    if (!sum) {
      fitText(this.add.text(x, y - 6, t('slot.empty'), textStyle(56, COLORS.sub)).setOrigin(0.5), CARD.w - 60);
      fitText(this.add.text(x, y + 60, t('slot.emptySub'), textStyle(28, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), CARD.w - 60);
      zone.on('pointerup', () => {
        gfx.setAlpha(1);
        session.slot = n; // 入門を終えた時にこの記録へ書き、前回として覚える
        this.startNew();
      });
      return;
    }

    if (isLast) {
      this.add.text(right - PAD, top + 38, t('slot.last'), textStyle(24, COLORS.gold, { fontStyle: '500' })).setOrigin(1, 0.5);
    }
    // 左に自分のタイプの絵、右にしこ名（大）・番付・タイプ
    const key = `type-${sum.type}`;
    let tx = left + PAD;
    if (this.textures.exists(key)) {
      const img = this.add.image(0, y + 22, key);
      img.setScale(ART_H / img.height);
      img.setX(left + PAD + img.displayWidth / 2);
      tx = left + PAD + img.displayWidth + 24;
    }
    const room = right - PAD - tx;
    // しこ名（大）の右に部屋の名（小）。部屋の名は札の幅の45%まで・しこ名はその残り
    const heya = heyaOfGuide(saved.guide);
    const shikona = this.add.text(tx, top + 112, shikonaLabel(sum.name), textStyle(60, COLORS.ink)).setOrigin(0, 0.5);
    if (heya) {
      const stable = fitText(this.add.text(0, top + 122, t(`heya.${heya}.name`), textStyle(26, COLORS.sub, { fontStyle: '500' })).setOrigin(0, 0.5), room * 0.45);
      fitText(shikona, room - stable.displayWidth - 16);
      stable.setX(tx + shikona.displayWidth + 16);
    } else {
      fitText(shikona, room);
    }
    fitText(this.add.text(tx, top + 172, rankLabel(sum.rankPos), textStyle(30, COLORS.ink)).setOrigin(0, 0.5), room);
    // タイプの行は右下の「はじめから」の左の手前まで
    fitText(this.add.text(tx, top + 222, t(`type.${sum.type}.name`), textStyle(26, COLORS.sub, { fontStyle: '500' })).setOrigin(0, 0.5), right - PAD - NEW.w - 16 - tx);

    zone.on('pointerup', () => {
      gfx.setAlpha(1);
      // つづきから：記録の案内役・タイプのまま、その時の画面へ（場所の途中なら取組の順・始め直さない）
      rememberSlot(n);
      useCareer(saved);
      this.scene.start(resumeScene(saved));
    });

    // はじめから（札の押し当たりより後に置く＝上にある方だけが押しを受ける）
    const armedHere = this.armed && this.armed.n === n;
    button(this, right - PAD - NEW.w / 2, top + CARD.h - PAD - NEW.h / 2, NEW.w, NEW.h, t('slot.new'), () => this.pressNew(n), {
      size: 26, color: armedHere ? COLORS.button : COLORS.buttonSub,
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
    session.career = null;
    session.guide = null;
    session.lastResult = null;
    session.oppKey = null;
    this.scene.start('guidePick');
  }
}
