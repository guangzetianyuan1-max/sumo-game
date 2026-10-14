// src/scenes/KamiScene.js — 紙相撲の取組（10/13 本人「紙相撲に切り替える」・設計書 2026-10-13-sumo-kamizumo-design.md）
// 箱の上の紙の土俵に型紙2枚。下の真ん中の大きなボタンをたたくと主人公（東・左）が跳ねて前へ。敵（西・右）は機械がたたく。箱から落ちた方の負け
// 動きの計算は src/core/kami.js（画面から切り離してある）。この画面は描くのと、指を計算へ渡すだけ
// 指：下の2つのボタンだけ（外は何も起きない）。左「押し」＝触れた瞬間を1回のたたき（押したままでは連打にならない）・立っていて押し続ける＝こらえる・倒れている時＝押している間を長押しで起き上がる／
//     右「決め技」＝ゲージが光っている時だけ決め技（光っていない時は「ぼすっ」と小さく揺れるだけ・損はしない）。10/14 設計書 2026-10-14-sumo-two-buttons-and-foe-tactics-design.md
// 相手の攻め：予告（warn）の間、敵の頭の上に赤い札と型紙の赤い光。実行（act）に入った時にその攻めの音。踏ん張り・はたきの実行の間は落ち着いた暗い赤の札（危ない間）・
//   踏ん張りが解けたら「ふっ」と金の札「今だ！押せ！」。突っ張りの予告の間は左のボタンに答え（「こらえ！」と赤いふち）
// 終わったら 0.8秒そのまま見せ、勝ち負け（喜び・悔しいのカットイン）を出して recordNow を1回だけ・1.8秒後に取組の後（after）へ
// 演出（20体版 Task 5）：カットイン（気合・決め・喜び・悔しい）は上に重ねるだけ・たたくと閉じる／決め技のゲージはボタンと帯を段の色（青・赤・金・虹）で塗り、段が上がると音
import { KAMI, ON_BEAT, newBout, step, tap, fire, hold, bracing, gaugeLit, beatOffset } from '../core/kami.js?v=37';
import { leftLook, rightLook, coachKey, gaugeTierOf, tacticPlate } from '../core/kamibutton.js?v=37';
import { TIER_COLOR } from '../core/gaugetier.js?v=37';
import { cutinArt, KIAI_WINDOW } from '../core/cutin.js?v=37';
import { boutParams, cpuParams, driver } from '../core/kamiai.js?v=37';
import { chosenKimete } from '../core/kimetepick.js?v=37';
import { kimariteOf } from '../core/kamiresult.js?v=37';
import { foeArt, kamiArt, heroArt, foeAura, stageScale } from '../core/foeart.js?v=37';
import { currentFoe } from '../core/run.js?v=37';
import { makeRng } from '../core/rng.js?v=37';
import { HERO_TYPE, OKAMI } from '../data/heroes.js?v=37';
import { t, foeLabel, kimariteLabel } from '../i18n/i18n.js?v=37';
import { GROUND, BOX_H, preloadArena, drawArena } from '../ui/arena.js?v=37';
import { session, prepareOpponent, boutSeed, recordNow, noteTacticSeen } from '../state.js?v=37';
import { playBout } from '../ui/sfx.js?v=37';
import { createBigButton } from '../ui/bigbutton.js?v=37';
import { drawCutinBand } from '../ui/cutinband.js?v=37';
import { preloadHeroFigures, preloadGuideArt, addAura, textStyle, fitText, speakerFace, speechBubble, COLORS } from '../ui/widgets.js?v=37';

const FIG_H = 330; // 型紙の高さ（敵は段階の倍率を掛ける）
const VIS = FIG_H / 230; // 見た目の大きさの倍率（計算の座標は変えない・縦方向の跳ね・落ちは同じ比で描く）
const HINT_Y = GROUND + BOX_H + 25; // 案内の1行（箱の下の端 900 と左のボタンの弧の上端 957 の間）
const CALL_FADE = 0.3; // はっけよいが消えていく長さ（秒）
const HOP_DRAW = 3; // 跳ねの高さは計算の3倍で描く（計算の跳ねは低い・Ruling 6）
// 下の2つの立体のボタン（押していない時の面の中心・面の直径）。y は面＋側面18＋弧で画面の下の端 1280 に収まる高さ
// たたける範囲は面より 15 大きい（左 75〜385・右 415〜665＝間 30 で重ならない）
const LEFT_BTN = { x: 230, y: 1104, d: 280 }; // 左「押し」：立ち合い・連打・長押し
const RIGHT_BTN = { x: 540, y: 1104, d: 220 }; // 右「決め技」：光っている時だけ
const RIGHT_TEXT = Math.round(RIGHT_BTN.d * 0.13); // 右の字（決め技の名前）は小さく
const RIGHT_OFF_INK = { color: '#a3a8b4', stroke: '#141a2e' }; // 光っていない右の字
const RIGHT_OFF_RAISE = 0.3; // 光っていない右は平らに沈んだ見た目（側面の厚みの割合）・光ると 1 に浮き上がる
const RIGHT_THROB = 6; // 光った右の脈の速さ（立体のボタンの既定 14 よりゆっくり）
const WARN_DEPTH = 21; // 予告の札はカットインの帯（depth 20）より上
const RIGHT_HALO = 0xffe08a; // 光った右だけの目印：面の外の金の光の輪（赤の段でも左の朱と見分けられる）
const WARN_TINT = [0xff9a9a, 0xff4a4a]; // 予告の間の敵の型紙の赤い光（この2つの間を脈打つ）
// 攻めの札の見た目（kind＝tacticPlate の warn・act・now）：予告＝赤・構え／踏ん張りの間＝落ち着いた暗い赤（危ない間）・踏ん張りが解けた＝金「今だ！押せ！」
const PLATE = {
  warn: { fill: 0xb3261e, stroke: 0xffe3d6, size: 36, ink: '#ffffff', inkStroke: '#4a0d08' },
  act: { fill: 0x5a1a16, stroke: 0xb36a5e, size: 32, ink: '#ffd9d0', inkStroke: '#2a0805' },
  now: { fill: 0xe3c27a, stroke: 0xfff3c4, size: 36, ink: '#3b2810', inkStroke: '#fff3c4' },
};
const LEFT_ALERT = 0xff4a4a; // 突っ張りの予告の間の左のふちの赤い光（答え＝こらえ！）
const GAUGE_Y = GROUND - FIG_H - 70; // 決め技の金の帯（主人公の頭の上）
const WARN_Y = GAUGE_Y - 64; // 攻めの予告の赤い札（敵の頭の上・札の高さ 60 と帯の高さ 56 の半分ずつ＋4 上＝帯と重ならない）
const OPEN_GUARD_MS = 300; // 画面が出てからボタンを受け付けない間（懸賞旗の画面を二度たたきで抜けた指が、立ち合いを誤って始めない）
const DOUBLE_MS = 60; // 同じ指の二度押しは数えない
const SHOW_FALL = 0.8; // 落ちていく型紙をそのまま見せる長さ（秒）
const TO_AFTER_MS = 1800; // 勝ち負けを出してから取組の後へ（カットインの帯 1秒＋勝ち負けの字を見る間）
const HERO_FILE = `hero_${HERO_TYPE}`;
const SIDES = ['east', 'west'];
const SIDE_SHIFT = 56; // 横向きの絵は幅が広いので、始めの立ち位置では描く x を主人公は左・敵は右へずらす（ぶつかる距離 FACE_GAP まで縮むと 0）
const START_GAP = 140; // 立ち合いの足もとの間（計算の x の差）
const FACE_GAP = 90; // ぶつかった時の足もとの間
const SHIFT_EASE = 0.1; // 描く位置のずらしが動く長さ（秒・倒れた時に飛ばない）
const TXT_SHADOW = [0, 3, '#0a0f20', 6, false, true]; // 背景の上の字の薄い影
// 練習の一番（1体目）のことねの顔と吹き出し：相手の名前（132）の下・はっけよい（300 前後）の上
const COACH_BOX = { x: 78, y: 208, size: 100, left: 150, top: 160, w: 545, h: 96 };
// はじめて見る攻めの吹き出し（ことねが返し方を1行・同じ場所＝上の方 160〜256。予告の札 y≈336 や下の2つのボタンとは重ならない）：予告が出てからこの秒数だけ
const TIP_SECS = 3.2;
// カットインの帯（20体版 Task 5）：画面の上の方に横長・約1秒・たたくと閉じる（取組の計算は止めない）
const CUT = { y: 330, h: 220, ms: 1000, faceX: 125, faceH: 260, textX: 460, textW: 470 };
const CUT_USED = ['kiai', 'kime', 'yorokobi', 'kuyashii']; // 取組で出す表情
const DARK_TXT = '#3b2810';
const LAND_GAP = 0.12; // 同じ型紙の着地の音は、この秒より詰めて鳴らさない
const newPrev = () => ({ y: 0, down: false, fell: false, tap: -Infinity, landAt: -Infinity });

export class KamiScene extends Phaser.Scene {
  constructor() {
    super('kami');
  }

  preload() {
    preloadHeroFigures(this); // 型紙が無い時の主人公の代わり
    preloadGuideArt(this); // 1体目（練習の一番）のことねの顔
    preloadArena(this);
    const load = (a) => { if (!this.textures.exists(a.key)) this.load.image(a.key, a.path); };
    load(kamiArt(HERO_FILE));
    CUT_USED.forEach((c) => load(cutinArt(c)));
    const foe = session.run ? currentFoe(session.run) : null;
    if (foe) {
      const a = foeArt(foe);
      load(kamiArt(a.file));
      load(a); // 型紙が無い時の敵の代わり（今の立ち絵）
    }
  }

  create() {
    const run = session.run;
    if (!run) { this.scene.start('guide'); return; }
    const foe = prepareOpponent();
    if (!foe) { this.scene.start('ladder'); return; }
    this.foe = foe;
    const seed = boutSeed();
    // 型紙2枚は自動の取組（autoBout）と同じ boutParams：主人公＝相手の情報で選んだ決め技（覚えた物だけ・無い＝光らない）と相性・
    // 敵＝11体目から決め技（foeKimeteAt・持ち始めは弱め）
    this.heroKimete = chosenKimete(run, session.kimete);
    const { east, west } = boutParams({ heroStats: run.stats, foeIndex: foe.index, heroKimete: this.heroKimete });
    this.st = newBout({ east, west, seed });
    this.cpu = driver(cpuParams(foe.index), makeRng(seed ^ 0x9e3779b9));
    this.lastDown = -Infinity; // 前に指が左に触れた時（ms）
    this.lastFire = -Infinity; // 前に指が右に触れた時（ms）
    this.prev = { east: newPrev(), west: newPrev(), gap: Infinity, finisherAt: -Infinity, tac: null, slapAt: -Infinity };
    this.lastThud = -Infinity;
    this.contacted = false; // 立ち合いのぶつかりを鳴らしたか（2度目からは「ばしっ」）
    this.doneT = -1; // 終わってからの秒（終わる前は −1）
    this.recorded = false;
    this.leaving = false;
    this.fall = null; // 終わった後の、落ちていく型紙の見た目だけの動き
    this.cutin = null; // 今出ているカットインの帯
    this.guardUntil = Date.now() + OPEN_GUARD_MS; // 画面が出てからこの間は、ボタンを押しても受け付けない（沈まない・鳴らない）
    this.prevTier = 0; // 1コマ前のゲージの色の段（0＝光っていない）

    const { width } = this.scale;
    this.cx = width / 2;
    drawArena(this);

    // 上：見出しと相手の名前
    fitText(this.add.text(width / 2, 70, t('kami.title'), textStyle(52, COLORS.gold)).setOrigin(0.5).setShadow(...TXT_SHADOW), width - 80);
    fitText(this.add.text(width / 2, 132, foeLabel(foe), textStyle(34, COLORS.ink)).setOrigin(0.5).setShadow(...TXT_SHADOW), width - 80);

    // 型紙2枚（足もとが計算の x・箱の面からの高さ）と足もとの影
    this.shadows = {};
    this.figs = {};
    this.off = { east: 0, west: 0 }; // 描く x のずらし（なめらかに動く）
    this.drawX = { east: 0, west: 0 }; // 描いている x（影・決め技の帯もこれに合わせる）
    this.lastDraw = this.time.now;
    SIDES.forEach((side) => {
      this.shadows[side] = this.add.ellipse(0, GROUND + 2, 120 * VIS, 16 * VIS, 0x000000, 0.3);
    });
    this.figs.east = this.figure(kamiArt(HERO_FILE).key, heroArt(HERO_TYPE).key, FIG_H);
    this.figs.west = this.figure(kamiArt(foeArt(foe).file).key, foeArt(foe).key, FIG_H * stageScale(foe.stage));
    if (this.figs.west) addAura(this, this.figs.west, foeAura(foe));

    // 下の2つの立体のボタン（src/ui/bigbutton.js・押すと沈む／離すとばねで戻る・音と振動つき）。指の受け付けもこの部品
    // 左：カットインの帯の間にたたいた時は、帯を閉じるだけ（ただ倒れている時は、そのまま長押しの起き上がりへ）。false＝押したことにしない（沈まない・鳴らない）
    this.btn = createBigButton(this, {
      ...LEFT_BTN,
      onDown: () => {
        if (Date.now() < this.guardUntil) return false; // 前の画面（懸賞旗）への二度たたきが、そのまま立ち合いの「つっぱり」にならない
        if (this.cutin) {
          this.closeCutin();
          // ただ倒れている時（長押しの起き上がり）と、相手の攻めの最中（予告・構え・組み＝返す一押しを飲み込まない）は、そのまま押しにする
          if (!(this.st && (this.st.f.east.down || this.st.tactic))) return false;
        }
        return this.press();
      },
      onUp: () => { if (!this.btn.pressed) this.release(); }, // 2本の指で押した時は、両方離すまで押したまま
    });
    // 右：光っている時だけ決め技。カットインの帯の間に押した時は、帯を閉じてから決め技を試す（光っていなければ黙って何もしない）
    this.rbtn = createBigButton(this, {
      ...RIGHT_BTN,
      textSize: RIGHT_TEXT,
      onDown: () => {
        if (Date.now() < this.guardUntil) return false;
        const hadCut = !!this.cutin;
        if (hadCut) this.closeCutin();
        return this.pressFire(hadCut);
      },
    });
    this.events.once('shutdown', () => { this.btn.destroy(); this.rbtn.destroy(); });
    this.pushAt = null; // 押し合いに入った時（計算の秒）
    // 決め技の金の帯（光っている間）
    this.finishBand = this.add.rectangle(0, GAUGE_Y, 240, 56, 0xe3c27a, 0.9).setStrokeStyle(4, 0xfff3c4, 1).setVisible(false);
    this.finishText = fitText(this.add.text(0, GAUGE_Y, t('kami.finish'), textStyle(34, DARK_TXT)).setOrigin(0.5), 228).setVisible(false);
    // 相手の攻めの予告の赤い札（予告の間だけ・敵の頭の上）
    this.warnBox = this.add.rectangle(0, WARN_Y, 240, 60, 0xb3261e, 0.95).setStrokeStyle(4, 0xffe3d6, 1).setDepth(WARN_DEPTH).setVisible(false);
    this.warnText = this.add.text(0, WARN_Y, '', textStyle(36, '#ffffff', { stroke: '#4a0d08', strokeThickness: 5 })).setOrigin(0.5).setDepth(WARN_DEPTH + 0.1).setVisible(false);
    this.warnId = null; // 吹き出しを出した予告（同じ予告で二度出さない）
    this.plateKey = null; // 今の札の字の鍵
    this.tinted = false;

    // はっけよい・勝ち負け（大きく）・下の案内の1行
    this.call = this.add.text(width / 2, 300, t('kami.hakkeyoi'), textStyle(72, COLORS.gold, { stroke: '#141a2e', strokeThickness: 8 })).setOrigin(0.5).setVisible(false);
    fitText(this.call, width - 60);
    this.banner = this.add.text(width / 2, 300, '', textStyle(110, COLORS.gold, { stroke: '#141a2e', strokeThickness: 10 })).setOrigin(0.5).setDepth(10);
    this.kimarite = this.add.text(width / 2, 395, '', textStyle(46, COLORS.ink, { stroke: '#141a2e', strokeThickness: 6 })).setOrigin(0.5).setDepth(10);
    this.hint = this.add.text(width / 2, HINT_Y, '', textStyle(36, COLORS.ink)).setOrigin(0.5);
    this.hintKey = null;
    // 1体目は練習の一番：場面ごとに、ことねの吹き出しを上に出す
    this.coach = foe.index === 0 ? { key: null, objs: [] } : null;
    this.tip = { key: null, until: -1, objs: [] }; // はじめて見る攻めの返し方（取組のどの体でも・記録の seenTactics に無い攻めの予告が出た時）

    // 指：触れた瞬間に1回だけ（押したままでは連打しない）。倒れている時は押している間を長押し（ボタンの部品が受ける）。ボタンの外は何も起きない
    // ただカットインの帯が出ている間は、ボタンの外をたたいても帯が閉じる
    this.input.on('pointerdown', (p) => {
      if (this.cutin && !this.btn.contains(p) && !this.rbtn.contains(p)) this.closeCutin();
    });
    // 画面が裏へ回ったら長押しを離す（戻った時に勝手に起き上がらない・こらえ続けない）
    const onHidden = () => { this.release(); this.btn.releaseAll(); this.rbtn.releaseAll(); };
    this.game.events.on('hidden', onHidden);
    this.events.once('shutdown', () => this.game.events.off('hidden', onHidden));

    this.draw();
  }

  // 型紙が無ければ今の立ち絵、それも無ければ置かない
  figure(key, fallback, h) {
    const k = this.textures.exists(key) ? key : this.textures.exists(fallback) ? fallback : null;
    if (!k) return null;
    const img = this.add.image(0, GROUND, k).setOrigin(0.5, 1);
    img.setScale(h / img.height);
    return img;
  }

  // 左のボタンを押した：取組のたたき（または長押しの始まり）にしたら true・何も起きなかったら false（ボタンも沈まない）
  // 押し合いの間は、たたいた後そのまま押し続けると こらえる（0.15秒から・計算は kami.js の bracing）。倒れている時は長押しで起き上がり
  // ゲージが光っていても決め技は出ない（右のボタンだけ）
  press() {
    const st = this.st;
    if (!st || st.phase === 'done') return false;
    const now = this.time.now;
    if (now - this.lastDown < DOUBLE_MS) return false; // 同じ指の二度押し
    this.lastDown = now;
    if (st.f.east.down) { hold(st, 'east', true); return true; }
    // 立ち合いで光ってからすぐ（0.15秒以内）にたたいた＝気合のカットイン
    const kiai = st.phase === 'ready' && !st.f.east.charged && st.t >= st.signalAt && st.t - st.signalAt <= KIAI_WINDOW;
    const wasPush = st.phase === 'push'; // 立ち合いの一押しで押し合いに入っても、その指は こらえにしない
    tap(st, 'east');
    if (wasPush) hold(st, 'east', true); // 押し続けたら こらえる（着地から 0.15秒・kami.js の bracing）
    if (kiai) this.showCutin('kiai', t('cutin.kiai'));
    return true;
  }

  // 右のボタンを押した：決め技が出たら true（沈んで鳴る）・出なかったら false。quiet でなければ「ぼすっ」と小さく横に揺れる（押しても損はしない）
  pressFire(quiet) {
    const st = this.st;
    if (!st || st.phase === 'done') return false;
    const now = this.time.now;
    if (now - this.lastFire < DOUBLE_MS) return false;
    this.lastFire = now;
    if (fire(st, 'east')) return true;
    if (!quiet) {
      playBout('dud');
      this.rbtn.shake();
    }
    return false;
  }

  // カットインの帯：左に主人公の顔・右に大きな字（と小さな2行目）。約1秒で消える・たたくと閉じる。取組は止めない（上に重ねるだけ）
  showCutin(name, line1, line2 = '', onClose = null) {
    this.closeCutin(true);
    const c = drawCutinBand(this, CUT, name, line1, line2);
    this.cutin = { c, onClose, timer: this.time.delayedCall(CUT.ms, () => this.closeCutin()) };
  }

  closeCutin(now = false) {
    const cut = this.cutin;
    if (!cut) return;
    this.cutin = null;
    cut.timer.remove(false);
    if (cut.onClose) cut.onClose();
    if (now) { cut.c.destroy(); return; }
    this.tweens.add({ targets: cut.c, alpha: 0, duration: 150, onComplete: () => cut.c.destroy() });
  }

  release() {
    if (this.st) hold(this.st, 'east', false);
  }

  update(time, delta) {
    const st = this.st;
    if (!st) return;
    const dt = Math.min(delta / 1000, KAMI.MAX_DT);
    if (st.phase !== 'done') {
      this.cpu.tick(st, 'west', dt);
      step(st, dt);
      // 起き上がった後も指を離さなければ押したまま（計算は起きた時から こらえるまでを数え直す＝kami.js の heldAt）
      this.sounds();
      this.tacticSounds();
    } else {
      this.afterDone(dt);
    }
    this.draw();
  }

  // 取組の音（20体版 Task 6b）：跳ねる＝トン（拍ぴったり＝カン）・着地＝ぱた・ぶつかり＝ドン（立ち合い）／ばしっ・倒れる＝ぱたん・
  // 起き上がる＝しゅっ・箱から落ちる＝ひゅー、ことん・決め技＝シャキーン。計算（core）は音を知らない＝毎コマ前のコマとの差で見つける
  // 敵の音は主人公より小さく。着地は同じ型紙で 0.12秒に1回まで・ぶつかりは 0.15秒に1回まで
  sounds() {
    const st = this.st;
    SIDES.forEach((side) => {
      const f = st.f[side];
      const pv = this.prev[side];
      const vol = side === 'east' ? 1 : 0.6;
      const last = f.taps.length ? f.taps[f.taps.length - 1] : -Infinity;
      if (last !== pv.tap) { // 跳ねた（跳ねられる時だけ taps に入る）
        pv.tap = last;
        playBout(beatOffset({ t: last }) < ON_BEAT ? 'hopBeat' : 'hop', vol);
      }
      const toppled = f.down && !pv.down && !f.fell;
      if (toppled) playBout('topple', vol);
      if (!f.down && pv.down && !f.fell) playBout('rise', vol);
      if (f.fell && !pv.fell) playBout('drop', vol);
      if (pv.y > 0 && f.y === 0 && !f.fell && !toppled && st.t - pv.landAt >= LAND_GAP) { playBout('land', vol); pv.landAt = st.t; }
      pv.y = f.y;
      pv.down = f.down;
      pv.fell = f.fell;
    });
    const e = st.f.east, w = st.f.west;
    const gap = w.x - e.x - (e.w + w.w) / 2;
    if (gap <= 0.5 && this.prev.gap > 0.5 && st.t - this.lastThud > 0.15) {
      playBout(this.contacted ? 'clash' : 'tachiai', 0.8);
      this.contacted = true;
      this.lastThud = st.t;
    }
    this.prev.gap = gap;
    if (st.finisherAt !== this.prev.finisherAt) {
      playBout('kime');
      this.prev.finisherAt = st.finisherAt;
      // 主人公の決め技が出た＝決めのカットイン（技の名前を大きく）
      if (st.finisherBy === 'east' && this.heroKimete) this.showCutin('kime', t(`newtech.${this.heroKimete}`), t('kami.finish'));
    }
    // ゲージの色の段が上がった時（光った時）：段の音。虹は太鼓の連打と確定音を続けて
    const tier = gaugeTierOf(st, 'east');
    if (tier > this.prevTier) {
      playBout(`gauge${tier}`);
      if (tier === 4) playBout('gaugeMax');
    }
    this.prevTier = tier;
  }

  // 相手の攻めの音（st.tactic は計算が中身を書き換える＝id・phase・from を前のコマと比べる）：予告に入った＝「ピッ」／
  // 実行に入った＝その攻めの音（踏ん張り ずん・突っ張り ドッ・組み がしっ）。突っ張りをこらえた（予告の間から押し続けていた）＝「ぐっ」を重ね、ドッは小さく
  // はたきの実行は構え（まだ当たっていない）＝構えでは鳴らさず、はたかれて倒れた時（st.tacticRun.slapAt が変わった）に「ぱしっ」。届かず突き損ね・組み損ねは同じコマで後始末へ進む＝鳴らない
  // 予告に入ったら、出ているカットインの帯は すぐ閉じる（予告が先）
  tacticSounds() {
    const st = this.st;
    const tac = st.tactic;
    const pv = this.prev.tac;
    if (st.tacticRun.slapAt !== this.prev.slapAt) { // はたかれて倒れた（計算が倒した時刻を残す）＝「ぱしっ」
      this.prev.slapAt = st.tacticRun.slapAt;
      playBout('hataki');
    }
    const cur = tac ? { id: tac.id, phase: tac.phase, from: tac.from } : null;
    const same = (!pv && !cur) || (pv && cur && pv.id === cur.id && pv.phase === cur.phase && pv.from === cur.from);
    this.prev.tac = cur;
    if (same || !cur) return;
    if (cur.phase === 'warn') {
      this.closeCutin(true); // 予告は演出より先：カットインの帯が札を隠さない・最初の左の一押しが帯を閉じるだけにならない
      playBout('warn', 0.9);
      return;
    }
    if (cur.phase === 'after') {
      if (cur.id === 'fumbari' && pv && pv.id === 'fumbari' && pv.phase === 'act') playBout('release'); // 踏ん張りが解けた「ふっ」（押しどき・小さく）
      return;
    }
    if (cur.phase === 'act') {
      if (cur.id === 'hataki') return;
      if (cur.id === 'tsuppari') {
        const e = st.f.east;
        const braced = e.held && !e.down && !e.fell && (bracing(st, 'east') || (pv && pv.phase === 'warn' && e.heldAt >= pv.from)); // kami.js の startAct と同じ見方
        playBout('tsuppari', braced ? 0.5 : 1);
        if (braced) playBout('brace');
        return;
      }
      playBout(cur.id);
      return;
    }
  }

  // 終わった後：落ちた型紙は見た目だけ落ち続ける（計算はもう動かさない）→ 0.8秒で勝ち負け → 1.2秒後に取組の後へ
  afterDone(dt) {
    const st = this.st;
    if (this.doneT < 0) {
      this.doneT = 0;
      this.fall = {};
      SIDES.forEach((side) => {
        const f = st.f[side];
        if (f.fell) this.fall[side] = { x: f.x, y: f.y, vx: f.vx, vy: f.vy, a: f.a, va: (f.a >= 0 ? 1 : -1) * 2.5 };
        else this.fall[side] = { x: f.x, y: f.y, vx: 0, vy: Math.min(f.vy, 0), a: f.a, va: 0, settle: true }; // 勝った側は宙に浮いたままにせず、箱の面へ降りる（見た目だけ）
      });
    }
    this.doneT += dt;
    Object.keys(this.fall).forEach((side) => {
      const v = this.fall[side];
      v.vy -= KAMI.G * dt;
      v.x += v.vx * dt;
      v.y += v.vy * dt;
      v.a += v.va * dt;
      if (v.settle && v.y <= 0) { v.y = 0; v.vy = 0; }
    });
    if (this.doneT >= SHOW_FALL && !this.recorded) {
      this.recorded = true;
      const won = st.winner === 'east';
      const kimarite = kimariteOf(st);
      const word = t(won ? 'kami.win' : 'kami.lose');
      const how = t('bout.kimarite', { tech: kimariteLabel(kimarite) }); // 決め技で決まった＝その決め技の名前
      this.banner.setText(word).setColor(won ? COLORS.gold : COLORS.ink).setVisible(false);
      fitText(this.kimarite.setText(how), this.scale.width - 60).setVisible(false);
      // 勝ち＝喜び・負け＝悔しいのカットイン。帯が閉じたら、いつもの勝ち負けの字を出す
      playBout(won ? 'win' : 'lose');
      this.showCutin(won ? 'yorokobi' : 'kuyashii', word, how, () => { this.banner.setVisible(true); this.kimarite.setVisible(true); });
      recordNow(won, kimarite);
      this.time.delayedCall(TO_AFTER_MS, () => {
        if (this.leaving) return;
        this.leaving = true;
        this.scene.start('after');
      });
    }
  }

  // ゲージの色の段の色（1 青・2 赤・3 金・4 虹＝色が回る）と、その上の字の色
  tierColor(tier) {
    if (tier === 4) return Phaser.Display.Color.HSVToRGB((this.time.now / 900) % 1, 0.6, 1).color;
    return TIER_COLOR[tier] || TIER_COLOR[3];
  }

  tierInk(tier) {
    return tier === 1 || tier === 2 ? { color: '#ffffff', stroke: '#141a2e' } : { color: DARK_TXT, stroke: '#fff3c4' };
  }

  // 下の2つのボタン：場面で字と色が変わる（見た目は leftLook・rightLook・描くのは立体のボタンの部品）
  // 左＝押し合いは拍で輪が太く明るく／倒れはふちに起き上がりの弧／こらえは緑。右＝光っていない時は暗い灰色で平ら・字は決め技の名前を小さく／
  // 光ったら段の色（青・赤・金・虹）で浮き上がり、ゆっくり脈打つ／決め技なしは「決め技なし」で暗いまま
  drawButtons() {
    const l = leftLook(this.st);
    this.btn.setLook({
      color: l.color,
      label: t(l.label),
      pulse: l.pulse,
      fill: l.fill,
      arc: l.mode === 'hold',
      dim: l.mode === 'wait' || l.mode === 'done',
      ink: l.mode === 'go' ? { color: DARK_TXT, stroke: '#fff3c4' } : { color: COLORS.ink, stroke: '#141a2e' },
      halo: l.alert ? LEFT_ALERT : null, // 突っ張りの予告の間＝赤いふち（字は「こらえ！」）
    });
    this.btn.update();
    const r = rightLook(this.st, 'east', this.heroKimete);
    const lit = r.mode === 'lit';
    this.rbtn.setLook({
      color: lit ? this.tierColor(r.tier) : r.color,
      label: t(r.label),
      caption: r.mode === 'none' ? '' : t('kami.btn.caption'), // 技の名前の上に小さく「決め技」（遊び方の見本と同じ呼び名）
      pulse: lit ? 1 : 0, // 光った右はふちの輪を太く明るく
      halo: lit ? RIGHT_HALO : null, // 光った右だけ、面の外に金の光の輪（虹の段は虹の輪）
      dim: !lit,
      throb: lit,
      throbRate: RIGHT_THROB,
      rainbow: lit && r.tier === 4, // 虹（ゲージの段 4）：ふちの外に7色の輪を回す
      raise: lit ? 1 : RIGHT_OFF_RAISE,
      ink: lit ? this.tierInk(r.tier) : RIGHT_OFF_INK,
    });
    this.rbtn.update();
  }

  // 相手の攻めの札（敵の頭の上・tacticPlate）：予告＝赤い札（攻めの字）と、敵の型紙の赤い光（脈打つ）／
  // 踏ん張り・はたきの実行＝落ち着いた暗い赤の札（「踏ん張り中」「構え中」＝この間は危ない）／踏ん張りが解けた後始末＝金の札「今だ！押せ！」
  drawWarn() {
    const st = this.st;
    const tac = st.tactic;
    const plate = tacticPlate(st);
    const warn = !!plate && plate.kind === 'warn';
    if (warn && tac.id !== this.warnId) { this.warnId = tac.id; this.startTip(tac.id); }
    if (!warn) this.warnId = null;
    const key = plate ? plate.key : null;
    if (plate && key !== this.plateKey) {
      const look = PLATE[plate.kind];
      this.warnText.setScale(1).setFontSize(look.size).setColor(look.ink).setStroke(look.inkStroke, 5).setText(t(key));
      fitText(this.warnText, 300);
      this.warnBox.setFillStyle(look.fill, 0.95).setStrokeStyle(4, look.stroke, 1);
      this.warnBox.setSize(Math.max(200, Math.min(330, this.warnText.displayWidth + 44)), 60);
    }
    this.plateKey = key;
    const x = Math.max(175, Math.min(this.scale.width - 175, this.drawX.west));
    this.warnBox.setVisible(!!plate).setPosition(x, WARN_Y);
    this.warnText.setVisible(!!plate).setPosition(x, WARN_Y);
    const fig = this.figs.west;
    if (warn && fig) {
      const k = 0.5 + 0.5 * Math.sin((this.time.now / 1000) * 18);
      const o = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(WARN_TINT[0]), Phaser.Display.Color.ValueToColor(WARN_TINT[1]), 100, Math.round(k * 100));
      fig.setTint(Phaser.Display.Color.GetColor(o.r, o.g, o.b));
      this.tinted = true;
    } else if (this.tinted && fig) {
      fig.clearTint();
      this.tinted = false;
    }
  }

  // はじめて見る攻め：予告が出た時、まだ見ていない攻めなら 返し方を ことねの吹き出しで出し、見たと記録する（その場で保存＝次の取組では出ない）
  startTip(id) {
    const seen = session.run && Array.isArray(session.run.seenTactics) ? session.run.seenTactics : [];
    if (!session.run || seen.includes(id)) return;
    noteTacticSeen(id);
    const tip = this.tip;
    tip.objs.forEach((o) => o.destroy());
    const { x, y, size, left, top, w, h } = COACH_BOX;
    tip.key = `tactic.tip.${id}`;
    tip.until = this.st.t + TIP_SECS;
    tip.objs = [...speakerFace(this, OKAMI, x, y, size), ...speechBubble(this, left, top, w, h, t(tip.key), { size: 28, min: 18 })];
    tip.objs.forEach((o) => o.setDepth(9)); // 練習の吹き出し（8）より上
  }

  // 吹き出しは 一定の秒数・取組が終わるまで。カットインの帯（220〜440）の間は隠す。出ている間は練習の一番の吹き出しを隠す
  drawTip() {
    const tip = this.tip;
    if (!tip.objs.length) return;
    if (this.st.t >= tip.until || this.st.phase === 'done') {
      tip.objs.forEach((o) => o.destroy());
      tip.objs = [];
      tip.key = null;
      return;
    }
    tip.objs.forEach((o) => o.setVisible(!this.cutin));
  }

  // 練習の一番のことねの吹き出し（場面が変わった時だけ描き直す・終わったら消す）
  drawCoach() {
    const c = this.coach;
    if (!c) return;
    const key = coachKey(this.st);
    if (key === c.key) return;
    c.key = key;
    c.objs.forEach((o) => o.destroy());
    c.objs = [];
    if (!key) return;
    const { x, y, size, left, top, w, h } = COACH_BOX;
    c.objs = [...speakerFace(this, OKAMI, x, y, size), ...speechBubble(this, left, top, w, h, t(key), { size: 28, min: 18 })];
    c.objs.forEach((o) => o.setDepth(8));
  }

  draw() {
    const st = this.st;
    const e = st.f.east;
    const nowMs = this.time.now;
    const dtD = Math.max(0, (nowMs - this.lastDraw) / 1000);
    this.lastDraw = nowMs;
    const k = Math.min(1, dtD / SHIFT_EASE); // 0.1秒で目標へ
    const vOf = (side) => (this.fall && this.fall[side] ? this.fall[side] : st.f[side]);
    const gap = Math.max(0, Math.min(1, (vOf('west').x - vOf('east').x - FACE_GAP) / (START_GAP - FACE_GAP)));
    SIDES.forEach((side) => {
      const f = st.f[side];
      const v = vOf(side);
      const lift = (v.y > 0 ? v.y * HOP_DRAW : v.y) * VIS; // 跳ねは3倍で見せる・箱から落ちる所はそのまま・どちらも型紙の大きさの比で描く
      const img = this.figs[side];
      const base = (side === 'east' ? -1 : 1) * SIDE_SHIFT * gap; // 横向きの絵は幅が広い＝始めは離して描き、近づくほど戻す
      let target = base;
      if (img && f.down && !f.fell) {
        // 倒れて寝た型紙は後ろへ長く伸びる＝頭が画面の外へ出ないよう、見た目だけ少し前へ寄せる（計算の x は変えない）
        // 絵の四隅を傾き分だけ回して、画面の端（10px内側）から出ない所まで寄せる（足もとの真ん中が回る軸）
        const th = -f.dir * v.a;
        const hw = img.displayWidth / 2, hh = img.displayHeight;
        const xs = [-hw, hw].flatMap((x) => [0, -hh].map((y) => x * Math.cos(th) - y * Math.sin(th)));
        const dx = f.dir > 0 ? Math.max(v.x + base, 10 - Math.min(...xs)) : Math.min(v.x + base, this.scale.width - 10 - Math.max(...xs));
        target = dx - v.x;
      } else if (f.fell) target = this.off[side]; // 落ちていく間はずらしを動かさない
      this.off[side] += (target - this.off[side]) * k; // なめらかに（倒れた時・起きた時に飛ばない）
      const dx = v.x + this.off[side];
      this.drawX[side] = dx;
      if (img) {
        img.setPosition(dx, GROUND - lift);
        img.setRotation(-f.dir * v.a); // 反る向き（＋）が自分の後ろになるように
      }
      // 影：箱の上にいる間だけ・高く跳ねるほど小さく薄く（型紙と同じだけずらす）
      const sh = this.shadows[side];
      const onBox = v.x >= KAMI.BOX.l && v.x <= KAMI.BOX.r && v.y > KAMI.FALL_Y;
      const sk = Math.max(0.4, 1 - Math.max(0, lift) / (200 * VIS));
      sh.setPosition(dx, GROUND + 2).setScale(sk, 1).setAlpha(onBox ? 0.3 * sk + 0.05 : 0);
    });

    // はっけよい：合図から、2人ともたたき終えて押し合いに入るまで。入ったら 0.3秒で消える
    if (st.phase === 'push' && this.pushAt === null) this.pushAt = st.t;
    const callA = st.phase === 'ready' ? 1 : st.phase === 'push' ? 1 - (st.t - this.pushAt) / CALL_FADE : 0;
    this.call.setVisible(st.t >= st.signalAt && callA > 0).setAlpha(Math.max(0, Math.min(1, callA)));

    this.drawButtons();
    this.drawWarn();
    // 決め技の帯（ゲージの段の色・ボタンと同じ）
    const lit = gaugeLit(st, 'east');
    this.finishBand.setVisible(lit).setPosition(this.drawX.east, GAUGE_Y);
    this.finishText.setVisible(lit).setPosition(this.drawX.east, GAUGE_Y);
    if (lit) {
      const tier = gaugeTierOf(st, 'east');
      const ink = this.tierInk(tier);
      this.finishBand.setFillStyle(this.tierColor(tier), 0.92);
      this.finishBand.setStrokeStyle(tier === 4 ? 6 : 4, tier === 4 ? Phaser.Display.Color.HSVToRGB((nowMs / 900 + 0.5) % 1, 0.75, 1).color : 0xfff3c4, 1);
      this.finishText.setColor(ink.color).setStroke(ink.stroke, 4);
    }

    // 下の案内（変わった時だけ書き直す）
    let key = null;
    if (st.phase === 'ready') key = 'kami.hint.ready';
    else if (st.phase === 'push') key = e.down ? 'kami.hint.down' : lit && this.heroKimete ? 'kami.hint.finish' : 'kami.hint.push';
    this.drawCoach();
    this.drawTip();
    if (this.coach) this.coach.objs.forEach((o) => o.setVisible(!this.cutin && !this.tip.objs.length)); // カットインの帯（220〜440）と重ねない：帯の間は吹き出しを隠す・攻めの吹き出しが出ている間も隠す
    if (key !== this.hintKey) {
      this.hintKey = key;
      this.hint.setScale(1).setText(key ? t(key) : '').setColor(key === 'kami.hint.finish' ? COLORS.gold : COLORS.ink);
      fitText(this.hint, this.scale.width - 60);
    }
  }
}
