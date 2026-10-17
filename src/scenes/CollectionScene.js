// src/scenes/CollectionScene.js — コレクション（10/17 本人「倒した敵はコレクションとして見れるように。昔話方式」）
// 福島昔話クエストの図鑑と同じ形：3列×3段の札（1ページ9体）・倒した相手は姿と名前と朱の判子・まだの相手は黒い影と「？？？」（番号だけ）・
// 倒した札をさわると1体を大きく（姿・名前・何体目・種類・型・必殺技）。勝った直後は取組の後の画面から開き、その相手の札に判子を押す
// 開き方：this.scene.start('collection', { stamp: 相手の id（判子を押す札・無ければ null）, then: 閉じた後の画面（'ladder' | 'clear'） })
import { t, foeLabel } from '../i18n/i18n.js?v=54';
import { session } from '../state.js?v=54';
import { collectionOf, pageOf, PER_PAGE } from '../core/collection.js?v=54';
import { foeArt, foeAura, stageScale } from '../core/foeart.js?v=54';
import { foeKimeteAt } from '../core/kamiai.js?v=54';
import { menuBgKey } from '../core/bgkey.js?v=54';
import { preloadBackdrop, drawBackdrop, inkPanel } from '../ui/backdrop.js?v=54';
import { playBout } from '../ui/sfx.js?v=54';
import { guardOpen, OPEN_GUARD_LONG_MS } from '../ui/openguard.js?v=54';
import { button, bindPress, backButton, topTitle, fitText, roundBox, hitZone, textStyle, addAura, clearScene, COLORS } from '../ui/widgets.js?v=54';

const CARD = { w: 212, h: 298, top: 168, gapY: 14 }; // 札（3列×3段：168〜1094）
const FIG = { dy: 112, h: 188, w: 190 }; // 札の中の姿（札の上の端から姿の真ん中まで・高さ・幅）
const NAME_DY = 228; // 札の上の端から名前の真ん中まで
const NO_DY = 270; // 札の上の端から「○体目」の真ん中まで
const NAV_Y = 1196; // まえ・とじる・つぎ
const PAGE_Y = 1124; // 「1 / 6」
const SEAL = { r: 30, big: 64 }; // 判子（札の右上の小さな判子・押す時の大きな判子の半径）
const SEAL_RED = 0xc8302a;
const BAND = 140; // 見出しの帯の下の端（集めた数の行 120 の下）
const STAMP_GUARD_MS = 1000;

export class CollectionScene extends Phaser.Scene {
  constructor() {
    super('collection');
  }

  init(data) {
    this.stampId = data && data.stamp ? data.stamp : null;
    this.then = data && data.then === 'clear' ? 'clear' : 'ladder';
  }

  preload() {
    preloadBackdrop(this, menuBgKey('collection'));
  }

  create() {
    if (!session.run) { this.scene.start('guide'); return; }
    // 取組の後の「番付表へ」（下の大きなボタン）から開く＝その指の離しが「とじる」に落ちないよう、開いてから 0.6秒は押しを受けない
    // 判子を押す時は 1秒（判子が落ちる 0.7秒の前に、取組の後の二度たたきで「とじる」が押されない・バグ出し L3）
    guardOpen(this, this.stampId ? STAMP_GUARD_MS : OPEN_GUARD_LONG_MS);
    this.stamping = false;
    this.col = collectionOf(session.run);
    const at = this.stampId ? this.col.items.findIndex((x) => x.id === this.stampId) : -1;
    if (at < 0) this.stampId = null; // 知らない id には判子を押さない
    this.card = null; // 大きく見せている1体（箱）
    this.loading = {}; // 読んでいる途中の絵の鍵
    this.slots = {}; // 今のページの札（絵の鍵 → 札）
    this.showPage(at >= 0 ? pageOf(at) : 0);
  }

  // ページを描く。札の枠・字・ボタンはすぐ描き、まだ読んでいない姿は読めた所から札に差し込む（50体を一度に読まない）
  // バグ出し L1：前は読み終えるまで何も描かず、背景も「もどる」も無い画面が続いた／L2：読み込みの途中にページを替えると
  // 読み終わりの口が2つ重なり、2回描き直して判子の途中の物を消した ⇒ 絵1枚ごとの読み終わりで、今のページの札にだけ差し込む
  showPage(page) {
    this.page = Math.max(0, Math.min(this.col.pages - 1, page));
    this.draw();
    const need = this.pageItems().map((it) => foeArt(it)).filter((a) => !this.textures.exists(a.key) && !this.loading[a.key]);
    if (!need.length) return;
    need.forEach((a) => {
      this.loading[a.key] = true;
      this.load.image(a.key, a.path);
      this.load.once(`filecomplete-image-${a.key}`, () => {
        this.loading[a.key] = false;
        const slot = this.slots[a.key];
        if (slot && slot.name.active) this.placeFigure(slot);
      });
    });
    this.load.start();
  }

  pageItems() {
    return this.col.items.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
  }

  close() {
    if (this.stamping) return; // 判子が落ちるまでの1秒ほどは閉じない（二度たたきで判子を見逃さない）
    this.scene.start(this.then);
  }

  draw() {
    clearScene(this);
    this.card = null;
    this.slots = {};
    const { width } = this.scale;
    const col = this.col;
    drawBackdrop(this, menuBgKey('collection'), { band: BAND });
    backButton(this, () => this.close());
    topTitle(this, 52, t('col.title'), 50, COLORS.gold);
    fitText(this.add.text(width / 2, 120, t('col.count', { got: col.got, total: col.total }), textStyle(32, COLORS.ink)).setOrigin(0.5), width - 60);

    const gapX = (width - CARD.w * 3) / 4;
    this.pageItems().forEach((it, k) => {
      const left = gapX + (k % 3) * (CARD.w + gapX);
      const top = CARD.top + Math.floor(k / 3) * (CARD.h + CARD.gapY);
      this.drawCard(it, left, top);
    });

    fitText(this.add.text(width / 2, PAGE_Y, `${this.page + 1} / ${col.pages}`, textStyle(30, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), 200);
    const navW = 200;
    if (this.page > 0) button(this, 20 + navW / 2, NAV_Y, navW, 96, t('col.prev'), () => this.showPage(this.page - 1), { size: 32, color: COLORS.buttonSub });
    button(this, width / 2, NAV_Y, navW, 96, t('col.close'), () => this.close(), { size: 34 });
    if (this.page < col.pages - 1) button(this, width - 20 - navW / 2, NAV_Y, navW, 96, t('col.next'), () => this.showPage(this.page + 1), { size: 32, color: COLORS.buttonSub });
  }

  drawCard(it, left, top) {
    const cx = left + CARD.w / 2;
    const fresh = it.id === this.stampId; // いま倒した相手＝影から始めて判子で色がつく
    const shown = it.got && !fresh;
    const box = roundBox(this, cx, top + CARD.h / 2, CARD.w, CARD.h, COLORS.panel, { radius: 18, stroke: it.got ? COLORS.frame : 0x3a4466 });
    const name = fitText(this.add.text(cx, top + NAME_DY, shown ? foeLabel(it) : t('col.unknown'), textStyle(28, shown ? COLORS.ink : COLORS.sub)).setOrigin(0.5), CARD.w - 16);
    fitText(this.add.text(cx, top + NO_DY, t('opp.foeNo', { n: it.index + 1 }), textStyle(28, COLORS.gold, { fontStyle: '500' })).setOrigin(0.5), CARD.w - 16);
    const slot = { it, cx, top, name, img: null, dark: !shown };
    this.slots[foeArt(it).key] = slot;
    this.placeFigure(slot);
    if (shown) this.seal(left + CARD.w - SEAL.r - 6, top + SEAL.r + 6, SEAL.r);
    if (fresh) this.stampCard(slot, left, top);
    if (!it.got) return; // まだの相手はさわれない
    bindPress(this, hitZone(this, cx, top + CARD.h / 2, CARD.w, CARD.h), box, () => { if (!this.card) this.showCard(it); });
  }

  // 札に姿を置く（読み込み済みの時だけ・札の判子や字より奥）。まだの相手と、判子を待つ相手は黒い影
  placeFigure(slot) {
    const key = foeArt(slot.it).key;
    if (slot.img || !this.textures.exists(key)) return;
    const img = this.add.image(slot.cx, slot.top + FIG.dy, key).setDepth(1); // 札の地（0）より手前・判子（2）より奥＝後から読めて置いても重なりの順は同じ
    img.setScale(Math.min(FIG.h / img.height, FIG.w / img.width));
    if (slot.dark) img.setTintFill(0x000000).setAlpha(0.75);
    slot.img = img;
  }

  // 朱の丸に白い「勝」（en: WIN）
  seal(x, y, r) {
    const c = this.add.container(x, y).setDepth(2);
    const g = this.add.graphics();
    g.fillStyle(SEAL_RED, 0.95).fillCircle(0, 0, r);
    g.lineStyle(Math.max(3, r * 0.1), 0xffffff, 0.9).strokeCircle(0, 0, r * 0.82);
    const label = this.add.text(0, 0, t('col.seal'), textStyle(28, '#ffffff')).setOrigin(0.5);
    // 字は判子の大きさに合わせる（押す時の大きな判子も、縮んだ後に小さな判子と同じ字の大きさになる）
    label.setScale(Math.min((r * 1.1) / label.width, (r * 1.0) / label.height));
    c.add([g, label]);
    return c;
  }

  // いま倒した相手の札に判子を押す：0.7秒待って大きな判子が落ち、色と名前がつき、判子は右上の角へ小さくなる
  // 途中でページを替えたり閉じたりしたら何もしない（描き直しで消えた物に触らない＝昔話の図鑑の「止まった」の学び）
  stampCard(slot, left, top) {
    const { it, name } = slot;
    this.stampId = null; // 判子は1度だけ（ページを行き来しても押し直さない）
    this.stamping = true;
    const cx = left + CARD.w / 2, cy = top + FIG.dy;
    const st = this.seal(cx, cy, SEAL.big).setScale(2.4).setAlpha(0);
    const alive = () => st.active && name.active;
    this.time.delayedCall(700, () => {
      if (!alive()) { this.stamping = false; return; }
      this.tweens.add({
        targets: st, scale: 1, alpha: 1, duration: 170, ease: 'Quad.easeIn',
        onComplete: () => {
          this.stamping = false;
          if (!alive()) return;
          playBout('dosu');
          this.cameras.main.shake(120, 0.006);
          slot.dark = false; // まだ姿が読めていなければ、読めた時に色つきで置く
          if (slot.img && slot.img.active) slot.img.clearTint().setAlpha(1);
          name.setText(foeLabel(it)).setColor(COLORS.ink);
          fitText(name.setScale(1), CARD.w - 16);
          this.tweens.add({ targets: st, x: left + CARD.w - SEAL.r - 6, y: top + SEAL.r + 6, scale: SEAL.r / SEAL.big, delay: 650, duration: 350, ease: 'Quad.easeInOut' });
        },
      });
    });
  }

  // 1体を大きく：姿（段の光）・名前・何体目と種類・型・必殺技。さわると一覧へ
  showCard(it) {
    const { width, height } = this.scale;
    const box = this.add.container(0, 0).setDepth(100);
    this.card = box;
    const shade = this.add.rectangle(0, 0, width, height, 0x0b0f1d, 0.96).setOrigin(0).setInteractive(); // すぐ当たりを持たせて下の札とボタンを押させない
    box.add(shade);
    const art = foeArt(it);
    if (this.textures.exists(art.key)) {
      const img = this.add.image(width / 2, 380, art.key);
      img.setScale(Math.min((480 * stageScale(it.stage)) / img.height, 560 / img.width));
      box.add(img);
      const tw = addAura(this, img, foeAura(it));
      if (tw) box.once('destroy', () => tw.remove());
    }
    const line = (y, str, size, color) => {
      const tx = fitText(this.add.text(width / 2, y, str, textStyle(size, color)).setOrigin(0.5), width - 80);
      box.add(tx);
    };
    line(720, foeLabel(it), 56, COLORS.gold);
    line(800, t('career.who', { name: t('opp.foeNo', { n: it.index + 1 }), rank: t(`col.kind.${it.kind}`) }), 34, COLORS.ink);
    line(860, t(`type.${it.type}.name`), 34, COLORS.ink);
    line(940, t('opp.foeKime', { name: t(`foekime.${foeKimeteAt(it.index).id}`) }), 34, COLORS.gold);
    line(1210, t('col.tapBack'), 30, COLORS.sub);
    playBout('pon');
    // 開いた指の離しで閉じない＝0.25秒たってからの押しだけ
    this.time.delayedCall(250, () => {
      if (box.active) shade.once('pointerup', () => { box.destroy(); this.card = null; });
    });
  }
}
