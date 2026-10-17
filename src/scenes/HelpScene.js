// src/scenes/HelpScene.js — 遊び方の3枚（20体版 Task 4・10/13／10/15 ボタン2つに書き直し）：ことねの顔と吹き出しで、紙相撲のたたき方を1枚ずつ
// 1枚目＝ボタンは2つ・左を連打で前へ押して箱から落とす・倒れたら右を長押し／2枚目＝立ち合いと決め技は中央上の〇（縮む金の輪が白い輪に重なった瞬間に右を一押し）／
// 3枚目＝相手の攻めは赤い札で予告され、左にバーが出る・右を長押しでためて緑の帯で離すと「こらえ成功！」
// v47：2枚目は、持っている決め技（無ければ最初に覚える風車投げ）の名前と出し方を先に教える（kimetepick.helpKimete・文は help.2.<出し方>・見本もその出し方）
// v49：新しい記録は風車投げを覚えて始まる＝新しい記録でも「まず覚える」は付かない
// 各枚に紙相撲の画面の小さな見本（箱・型紙・下の大きなボタン2つ・中央上の〇・左端のバー）を、本番と同じ絵（src/ui/hud.js・ボタンの色）で小さく描く。使う方だけ明るく、使わない方は暗い
// 入門の直後と、番付の「遊び方」から来る。どちらも閉じたら（はじめる・飛ばす）記録の seenHelp を true にして番付へ
import { KAMI } from '../core/kami.js?v=55';
import { BUTTON_COLOR } from '../core/kamibutton.js?v=55';
import { kamiArt, foeArt } from '../core/foeart.js?v=55';
import { foeAt } from '../data/foes.js?v=55';
import { HERO_TYPE, OKAMI } from '../data/heroes.js?v=55';
import { t, getLang } from '../i18n/i18n.js?v=55';
import { session, markHelpSeen } from '../state.js?v=55';
import { ringShape, barShape, drawRing, drawBar, hitMarkFit, drawMash, drawKimeHold, MASH_COUNT } from '../ui/hud.js?v=55';
import { helpKimete } from '../core/kimetepick.js?v=55';
import { IPPON } from '../core/drills.js?v=55';
import { menuBgKey } from '../core/bgkey.js?v=55';
import { newChime, demoChime } from '../core/chime.js?v=55';
import { playBout } from '../ui/sfx.js?v=55';
import { guardOpen, OPEN_GUARD_MS, OPEN_GUARD_LONG_MS } from '../ui/openguard.js?v=55';
import { preloadBackdrop, drawBackdrop } from '../ui/backdrop.js?v=55';
import { button, topTitle, fitText, roundBox, textStyle, speakerFace, speechBubble, preloadGuideArt, clearScene, COLORS } from '../ui/widgets.js?v=55';

const PAGES = 3;
const PANEL = { y: 470, w: 640, h: 560 }; // 見本の札（190〜750）
const MINI = { k: 0.62, ground: 556, boxH: 66 }; // 見本の紙相撲：箱の上の面の y・箱の前の面の高さ
const MINI_FIG_H = 250; // 見本の型紙の高さ
const MINI_BTN = { y: 678, r: 64, rWide: 80, dx: 115 }; // 見本の下のボタン2つ（箱の下・真ん中から左右へ dx）
const MINI_RING = { at: { x: 360, y: 250 }, k: 0.4, ms: 1000, hold: 700 }; // 見本の〇（札の中の中央上・型紙の頭 306 より上・本番の 0.4 倍）：縮む長さ・ぴったりの後に止める長さ
const MINI_BAR = { box: { x: 84, top: 226, h: 290, w: 30 }, spec: { center: 0.75, half: 0.12 }, ms: 1300, hold: 900 }; // 見本のバー（札の左端）：緑の帯で止まる
const ALERT = 0xff4a4a; // 守りのバーの間のボタンのふちの赤い光（KamiScene と同じ）
const WARN_RED = 0xb3261e; // 予告の札の赤（KamiScene と同じ）
const COACH = { faceX: 84, faceY: 940, size: 130, left: 160, top: 770, w: 540, h: 340 }; // 吹き出しは見本の札（〜750）の下から足もとのボタン（1132〜）の上まで＝字 32 で収める
const FOOT_Y = 1190;
const BAND = 156; // 見出しと何枚目かの点の帯の下の端（見本の札の上 190 より上）
const BG = menuBgKey('help'); // 背景＝土俵
const HERO_KAMI = kamiArt(`hero_${HERO_TYPE}`);
const FOE_KAMI = kamiArt(foeArt(foeAt(0)).file); // 1体目の相手（50体版：力士の楓里）

export class HelpScene extends Phaser.Scene {
  constructor() {
    super('help');
  }

  preload() {
    preloadGuideArt(this);
    preloadBackdrop(this, BG);
    [HERO_KAMI, FOE_KAMI].forEach((a) => { if (!this.textures.exists(a.key)) this.load.image(a.key, a.path); });
  }

  create() {
    if (!session.run) { this.scene.start('guide'); return; }
    this.page = 0;
    this.draw();
  }

  redraw() {
    guardOpen(this); // 押した瞬間から止める（描き直しの前の 1コマに来た2度目の押しが、まだ残っている古い「次へ」に落ちない・v45b）
    this.time.delayedCall(0, () => this.draw()); // 押しの最中に部品を消さない
  }

  draw() {
    this.tweens.killAll();
    clearScene(this);
    guardOpen(this, this.page === PAGES - 1 || this.page === 0 ? OPEN_GUARD_LONG_MS : OPEN_GUARD_MS); // 1枚目も 0.6秒（10/17 バグ出し L5：記録③の札の下を二度たたくと「飛ばす」に落ち、遊び方を見ないまま進んだ）。 描くたび（次へ）に付け直す（最後の枚＝「はじめる」が「次へ」と同じ所＝0.6秒・v45 点検 m2）：直後 0.3秒の押しは受けない＝「次へ」の2度たたきで1枚飛ばない・3枚目の「はじめる」が押されない（v45b・バグ出し2 L1）
    const { width } = this.scale;
    drawBackdrop(this, BG, { band: BAND });
    topTitle(this, 60, t('help.title'), 52, COLORS.gold);
    // 何枚目か（点3つ・今の枚は金）
    for (let i = 0; i < PAGES; i++) {
      this.add.circle(width / 2 + (i - 1) * 36, 128, 10, i === this.page ? 0xe3c27a : 0x39436a);
    }
    roundBox(this, width / 2, PANEL.y, PANEL.w, PANEL.h, COLORS.panel, { radius: 32, stroke: COLORS.frame });
    this.mini(width, this.page);

    speakerFace(this, OKAMI, COACH.faceX, COACH.faceY, COACH.size);
    speechBubble(this, COACH.left, COACH.top, COACH.w, COACH.h, this.pageText(), { size: 36, min: 28 });

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

  // 吹き出しの文：2枚目は持っている決め技（無ければ最初に覚える物）の出し方から（v47）
  pageText() {
    if (this.page !== 1) return t(`help.${this.page + 1}`);
    const hk = helpKimete(session.run);
    return t(`help.2.${hk.input}`, { tech: t(`newtech.${hk.id}`), lead: hk.owned ? '' : t('help.2.lead') });
  }

  close() {
    markHelpSeen();
    this.scene.start('ladder');
  }

  // 紙相撲の小さな見本：箱・紙の土俵・型紙2枚・下の大きなボタン2つ。page で場面を変える（①左の連打 ②中央上の〇と右の一押し ③左端のバーと右の長押し）
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

    // 型紙：1枚目はぶつかって押す・2枚目は立ち合いで向き合う・3枚目は向き合い、相手が予告の札を出している
    // 横向きの絵は幅が広い＝絵の幅の半分で並べる（ぶつかる時は手がふれ合うまで寄せる）
    const space = page === 0 ? -26 : page === 1 ? 24 : 0;
    const hero = this.fig(HERO_KAMI.key, cx, ground);
    const foe = this.fig(FOE_KAMI.key, cx, ground);
    if (hero) hero.setX(cx - hero.displayWidth / 2 - space / 2);
    if (foe) foe.setX(cx + foe.displayWidth / 2 + space / 2);
    const by = MINI_BTN.y, lx = cx - MINI_BTN.dx, rx = cx + MINI_BTN.dx;
    if (page === 0) {
      // ①連打：主人公が跳ねて押す・左のボタンは「連打！」で押すたびに沈む・右は暗い
      if (hero) this.tweens.add({ targets: hero, y: ground - 22, duration: 180, yoyo: true, repeat: -1, repeatDelay: 120 });
      const btn = this.miniButton(lx, by, 'tap', t('kami.btn.tap'));
      this.tweens.add({ targets: btn, scale: 0.9, duration: 90, yoyo: true, repeat: -1, repeatDelay: 120 });
      this.miniButton(rx, by, 'off', t('kami.btn.right'), false, true);
    } else if (page === 1) {
      // ②決め技（v47：持っている決め技の出し方の見本）。〇の技＝白い的の輪に金の輪が縮んで重なる → ◎ → くり返す（右「一押し！」・左は暗く「→右」）／
      // 連打の技＝中央上の回数が減る（左「決め技！連打」・右は暗い）／長押しの技＝円いゲージが緑の帯までたまる（右「攻め！長押し」・左は暗く「→右」）
      const input = helpKimete(session.run).input;
      if (input === 'mash') {
        this.miniMash();
        const btn = this.miniButton(lx, by, 'kimeMash', t('kami.btn.kimeMash'), false, false, MINI_BTN.rWide); // 英語の Finisher! が字 28 のまま収まる大きさ
        this.tweens.add({ targets: btn, scale: 0.9, duration: 90, yoyo: true, repeat: -1, repeatDelay: 120 });
        this.miniButton(rx, by, 'off', t('kami.btn.right'), false, true);
      } else if (input === 'hold') {
        this.miniKimeHold();
        this.miniButton(lx, by, 'off', t('kami.btn.toRight'), false, true);
        this.miniButton(rx, by, 'kimeHold', t('kami.btn.kimeHold'));
      } else {
        this.miniRing();
        this.miniButton(lx, by, 'off', t('kami.btn.toRight'), false, true);
        const btn = this.miniButton(rx, by, 'go', t('kami.btn.go'), true);
        this.tweens.add({ targets: btn, scale: 1.1, duration: 360, yoyo: true, repeat: -1 });
      }
    } else {
      // ③左端のバー：相手が赤い札（突っ張り「来るぞ！」）と赤い光 → バーが緑の帯までたまって「こらえ成功！」。ボタンは「長押し！」と赤いふち
      const warn = [];
      if (foe) {
        const bx = Math.min(foe.x, width - 130), wy = ground - MINI_FIG_H - 30;
        warn.push(this.add.rectangle(bx, wy, 270, 56, WARN_RED, 0.95).setStrokeStyle(4, 0xffe3d6, 1));
        warn.push(fitText(this.add.text(bx, wy, t('kami.warn.tsuppari'), textStyle(32, '#ffffff', { stroke: '#4a0d08', strokeThickness: 5 })).setOrigin(0.5), 256));
      }
      this.miniButton(lx, by, 'off', t('kami.btn.toRight'), false, true);
      this.miniButton(rx, by, 'bar', t('kami.btn.bar'));
      const halo = this.add.graphics().setPosition(rx, by);
      halo.lineStyle(8, ALERT, 1).strokeCircle(0, 0, MINI_BTN.r + 8);
      this.tweens.add({ targets: halo, alpha: 0.3, duration: 300, yoyo: true, repeat: -1 });
      this.miniBar(foe, warn);
    }
  }

  // 見本のボタン1つ（本番の色と字）。dark＝金の面に濃い字・dim＝使わない方（暗い面・灰の字・薄く）
  miniButton(bx, by, mode, label, dark = false, dim = false, r = MINI_BTN.r) {
    const btn = this.add.container(bx, by);
    if (getLang() !== 'ja' && !label.includes('\n')) label = label.replace(' ', '\n'); // 英語は2語なら2行に（円の中で字 28 を保つ）
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.35).fillCircle(0, 5, r);
    bg.fillStyle(BUTTON_COLOR[mode], 1).fillCircle(0, 0, r);
    bg.fillStyle(0xffffff, 0.12).fillCircle(0, -r * 0.35, r * 0.62);
    const txt = this.add.text(0, 0, label, textStyle(28, dark ? '#3b2810' : dim ? COLORS.sub : COLORS.ink, { stroke: dark ? '#fff3c4' : '#141a2e', strokeThickness: 4, align: 'center' })).setOrigin(0.5);
    fitText(txt, r * 2 - 6);
    btn.add([bg, txt]);
    if (dim) btn.setAlpha(0.6);
    return btn;
  }

  // 見本の〇（本番と同じ絵 drawRing を小さく）：金の輪が縮んで的に重なる → 〇の中に「合」を出して少し止める → くり返す（本番の◎と同じ字・v42）
  miniRing() {
    const g = this.add.graphics();
    const hit = hitMarkFit(MINI_RING.k); // 縮めた〇の中に収まる大きさ（28 以上）
    const mark = this.add.text(MINI_RING.at.x, MINI_RING.at.y, t('kami.ring.hit'), textStyle(hit.size, COLORS.gold, { stroke: '#141a2e', strokeThickness: 6 })).setOrigin(0.5).setVisible(false);
    fitText(mark, hit.w);
    const p = { v: 0 };
    const paint = () => {
      g.clear();
      drawRing(g, ringShape({ from: 0, hitAt: 1 }, p.v, MINI_RING.at, MINI_RING.k));
      mark.setVisible(p.v >= 0.999);
    };
    paint();
    this.tweens.add({ targets: p, v: 1, duration: MINI_RING.ms, repeat: -1, repeatDelay: MINI_RING.hold, onUpdate: paint, onRepeat: paint });
  }

  // 見本の連打の技（本番と同じ絵 drawMash を小さく・v47）：窓の弧が減りながら、〇の中の残りの回数が 4→0 → 少し止める → くり返す
  miniMash() {
    const g = this.add.graphics();
    const { x, y } = MINI_RING.at, k = MINI_RING.k, need = 4;
    const num = this.add.text(x, y, String(need), textStyle(Math.max(28, Math.round(MASH_COUNT.size * k)), COLORS.gold, { stroke: '#141a2e', strokeThickness: 6 })).setOrigin(0.5);
    const p = { v: 0 };
    const paint = () => {
      g.clear();
      drawMash(g, { x, y, r: IPPON.targetR * k, left: 1 - 0.6 * p.v });
      num.setText(String(Math.max(0, need - Math.floor(p.v * need + 1e-6))));
    };
    paint();
    this.tweens.add({ targets: p, v: 1, duration: MINI_RING.ms, repeat: -1, repeatDelay: MINI_RING.hold, onUpdate: paint, onRepeat: paint });
  }

  // 見本の長押しの技（本番と同じ絵 drawKimeHold を小さく・v47）：円いゲージが緑の帯の真ん中までたまる → 少し止める → くり返す
  miniKimeHold() {
    const g = this.add.graphics();
    const { x, y } = MINI_RING.at, k = MINI_RING.k;
    const c = MINI_BAR.spec.center, h = MINI_BAR.spec.half;
    const p = { v: 0 };
    const paint = () => {
      g.clear();
      drawKimeHold(g, { x, y, r: IPPON.targetR * k * 1.6, v: p.v, band: [c - h, c + h], core: [c - h / 2, c + h / 2] });
    };
    paint();
    this.tweens.add({ targets: p, v: c, duration: MINI_BAR.ms, repeat: -1, repeatDelay: MINI_BAR.hold, onUpdate: paint, onRepeat: paint });
  }

  // 見本のバー（本番と同じ絵 drawBar を小さく）：予告の札と相手の赤い光の間に、下から緑の帯の真ん中までたまる →
  // 札と赤い光が消えて（本番と同じ＝打ち消し）「こらえ成功！」 → くり返す。緑の帯に入った所で本番と同じ「ここだ」の音（v45）は最初の2回だけ（v45b・開き直すとまた2回）
  miniBar(foe, warn) {
    const g = this.add.graphics();
    const box = MINI_BAR.box;
    const say = this.add.text(box.x + box.w / 2 + 30, box.top + 22, t('kami.bar.ok'), textStyle(36, COLORS.gold, { stroke: '#141a2e', strokeThickness: 6 })).setOrigin(0, 0.5).setVisible(false);
    fitText(say, PANEL.w - (say.x - (this.scale.width - PANEL.w) / 2) - 20);
    const p = { v: 0 };
    const chime = newChime();
    let lap = 0; // 何回目のため（ゲージが下へ戻った＝くり返した＝新しい押し）
    let lastV = 0;
    const paint = () => {
      if (p.v < lastV - 1e-6) lap += 1;
      lastV = p.v;
      g.clear();
      drawBar(g, barShape(MINI_BAR.spec, p.v, box));
      if (demoChime(chime, lap, p.v >= MINI_BAR.spec.center - MINI_BAR.spec.half - 1e-9)) playBout('koko');
      const ok = p.v >= MINI_BAR.spec.center - 1e-3;
      say.setVisible(ok);
      warn.forEach((o) => o.setVisible(!ok));
      if (foe) { if (ok) foe.clearTint(); else foe.setTint(0xff7a7a); }
    };
    paint();
    this.tweens.add({ targets: p, v: MINI_BAR.spec.center, duration: MINI_BAR.ms, repeat: -1, repeatDelay: MINI_BAR.hold, onUpdate: paint, onRepeat: paint });
  }

  // 見本の型紙（足もとが箱の面）。絵が無ければ置かない
  fig(key, x, y) {
    if (!this.textures.exists(key)) return null;
    const img = this.add.image(x, y, key).setOrigin(0.5, 1);
    img.setScale(MINI_FIG_H / img.height);
    return img;
  }
}
