// src/scenes/KamiScene.js — 紙相撲の取組（10/13 本人「紙相撲に切り替える」・設計書 2026-10-13-sumo-kamizumo-design.md）
// 箱の上の紙の土俵に型紙2枚。下の真ん中の大きなボタンをたたくと主人公（東・左）が跳ねて前へ。敵（西・右）は機械がたたく。箱から落ちた方の負け
// 動きの計算は src/core/kami.js（画面から切り離してある）。この画面は描くのと、指を計算へ渡すだけ
// 指：下の真ん中のボタン1つ（10/14 ボタン1つ 設計書 2026-10-14-sumo-one-button-ring-bar-design.md）。出ている〇とバーそのものをさわっても同じ押し（hud.js の hudTouch・最終点検の直し 1）。
//     ほかの所は何も起きない（カットインを閉じるだけ）。触れた瞬間を1回のたたき（押したままでは連打にならない）・
//     中央上の〇（立ち合い・決め技）が出ている間の押しは〇の判定（跳ねない）・相手の攻めの予告の間は左端のバーをためる長押し（緑の帯で離す）・倒れている時は長押しで起き上がる
// 〇とバーの置き場所と絵は src/ui/hud.js（稽古と同じ）。〇は判定の ◎○× を一瞬出す・バーは「こらえ成功！」
// 相手の攻め：予告（warn）の間、敵の頭の上に赤い札（敵の必殺技は「必殺技！〇〇」）と型紙の赤い光。実行（act）に入った時にその攻めの音。踏ん張り・はたきの実行の間は落ち着いた暗い赤の札（危ない間）・
//   踏ん張りが解けたら「ふっ」と金の札「今だ！押せ！」。敵の必殺技が決まった時（届いた時だけ）は、その技の名前のカットイン
// 終わったら 0.8秒そのまま見せ、勝ち負け（喜び・悔しいのカットイン）を出して recordNow を1回だけ・1.8秒後に取組の後（after）へ
// 演出（20体版 Task 5）：カットイン（気合・決め・喜び・悔しい・敵の必殺技）は上に重ねるだけ・たたくと閉じる・新しい〇や予告が出たらすぐ閉じる／決め技の〇が出た時は段の音（金の帯は〇に替えた）
import { KAMI, ON_BEAT, newBout, step, press, hold, beatOffset, barGauge } from '../core/kami.js?v=38';
import { isTactic, FOE_KIME_ID } from '../core/tactics.js?v=38';
import { buttonLook, hintKey, coachKey, gaugeTierOf, tacticPlate, ringFlash, barSayKey } from '../core/kamibutton.js?v=38';
import { cutinArt } from '../core/cutin.js?v=38';
import { boutParams, cpuParams, driver, ringRngFor, barRngFor } from '../core/kamiai.js?v=38';
import { chosenKimete } from '../core/kimetepick.js?v=38';
import { kimariteOf } from '../core/kamiresult.js?v=38';
import { foeArt, kamiArt, heroArt, foeAura, stageScale } from '../core/foeart.js?v=38';
import { currentFoe } from '../core/run.js?v=38';
import { makeRng } from '../core/rng.js?v=38';
import { HERO_TYPE, OKAMI } from '../data/heroes.js?v=38';
import { t, foeLabel, kimariteLabel } from '../i18n/i18n.js?v=38';
import { GROUND, BOX_H, preloadArena, drawArena } from '../ui/arena.js?v=38';
import { session, prepareOpponent, boutSeed, recordNow, noteTacticSeen } from '../state.js?v=38';
import { playBout } from '../ui/sfx.js?v=38';
import { isMuted } from '../ui/music.js?v=38';
import { GYOJI, tachiaiVoiceAt, nokottaDue } from '../core/gyoji.js?v=38';
import { createBigButton } from '../ui/bigbutton.js?v=38';
import { drawCutinBand } from '../ui/cutinband.js?v=38';
import { HUD, ringShape, barShape, drawRing, drawBar, hudTouch } from '../ui/hud.js?v=38';
import { preloadHeroFigures, preloadGuideArt, addAura, textStyle, fitText, speakerFace, speechBubble, COLORS } from '../ui/widgets.js?v=38';

const FIG_H = 330; // 型紙の高さ（敵は段階の倍率を掛ける）
const VIS = FIG_H / 230; // 見た目の大きさの倍率（計算の座標は変えない・縦方向の跳ね・落ちは同じ比で描く）
const HINT_Y = GROUND + BOX_H + 25; // 案内の1行（箱の下の端 900 とボタンの弧の上端 947 の間）
const CALL_FADE = 0.3; // はっけよいが消えていく長さ（秒）
const HOP_DRAW = 3; // 跳ねの高さは計算の3倍で描く（計算の跳ねは低い・Ruling 6）
// 下の真ん中の立体のボタン1つ（v34 と同じ・稽古とも同じ：押していない時の面の中心・面の直径）。y は面＋側面18＋弧で画面の下の端 1280 に収まる高さ
const BTN = { x: 360, y: 1104, d: 300 };
const WARN_DEPTH = 21; // 予告の札はカットインの帯（depth 20）より上
const HUD_DEPTH = 22; // 〇とバーと ◎○×：カットインの帯（20）と予告の札（21）より上＝気合・必殺技のカットインと同じコマでも判定が読める
const CALL_Y = 440; // はっけよい：中央上の〇（的の輪 180〜340）の下・型紙の頭（470）の上
const RING_INK = { 2: COLORS.gold, 1: COLORS.ink, 0: COLORS.sub }; // ◎○× の色
const BAR_SAY = { x: HUD.bar.x + HUD.bar.w / 2 + 34, y: HUD.bar.top + HUD.bar.h * 0.25, ms: 900 }; // 「こらえ成功！」：バーの緑の帯の高さ・バーの右
const BAR_CLEAR = HUD.bar.x + HUD.bar.w / 2 + 34; // 予告の札はバー（右の矢印まで）にかからない所に置く
const PLATE_W = { max: 330, name: 560 }; // 予告の札の幅の上限（敵の必殺技は名前が長い＝広く・字は 28 以上を保つ）
const BAR_FILL = 0xe3b23c; // ボタンの弧のたまり（バーのたまりと同じ金）
const WARN_TINT = [0xff9a9a, 0xff4a4a]; // 予告の間の敵の型紙の赤い光（この2つの間を脈打つ）
// 攻めの札の見た目（kind＝tacticPlate の warn・act・now）：予告＝赤・構え／踏ん張りの間＝落ち着いた暗い赤（危ない間）・踏ん張りが解けた＝金「今だ！押せ！」
const PLATE = {
  warn: { fill: 0xb3261e, stroke: 0xffe3d6, size: 36, ink: '#ffffff', inkStroke: '#4a0d08' },
  act: { fill: 0x5a1a16, stroke: 0xb36a5e, size: 32, ink: '#ffd9d0', inkStroke: '#2a0805' },
  now: { fill: 0xe3c27a, stroke: 0xfff3c4, size: 36, ink: '#3b2810', inkStroke: '#fff3c4' },
};
const ALERT = 0xff4a4a; // 守りのバーが出ている間のボタンのふちの赤い光（字は「長押し！」）
const WARN_Y = GROUND - FIG_H - 134; // 攻めの予告の赤い札（敵の頭の上・今までと同じ高さ 336）
const OPEN_GUARD_MS = 300; // 画面が出てからボタンを受け付けない間（懸賞旗の画面を二度たたきで抜けた指が、立ち合いを誤って始めない）
const DOUBLE_MS = 60; // 同じ指の二度押しは数えない
const SHOW_FALL = 0.8; // 落ちていく型紙をそのまま見せる長さ（秒）
const TO_AFTER_MS = 1800; // 勝ち負けを出してから取組の後へ（カットインの帯 1秒＋勝ち負けの字を見る間）
const GYOJI_VOLUME = 0.9; // 行司の声：音楽の上で聞こえる大きさ（稽古の声と同じ・書き出し側でピーク −1 dBFS 以下にそろえてある）
const GYOJI_FILES = { hakkeyoi: 'assets/voice/gyoji/hakkeyoi.mp3', nokotta: 'assets/voice/gyoji/nokotta.mp3' };
const HERO_FILE = `hero_${HERO_TYPE}`;
const SIDES = ['east', 'west'];
const SIDE_SHIFT = 56; // 横向きの絵は幅が広いので、始めの立ち位置では描く x を主人公は左・敵は右へずらす（ぶつかる距離 FACE_GAP まで縮むと 0）
const START_GAP = 140; // 立ち合いの足もとの間（計算の x の差）
const FACE_GAP = 90; // ぶつかった時の足もとの間
const SHIFT_EASE = 0.1; // 描く位置のずらしが動く長さ（秒・倒れた時に飛ばない）
const TXT_SHADOW = [0, 3, '#0a0f20', 6, false, true]; // 背景の上の字の薄い影
// 練習の一番（1体目）のことねの顔と吹き出し：画面のいちばん上（30〜138・見出しと相手の名前の上に重ねる）。中央上の〇（的の輪 180〜340）と左端のバー（300〜）を隠さない
const COACH_BOX = { x: 78, y: 84, size: 100, left: 150, top: 30, w: 545, h: 108 };
// はじめて見る攻め・敵の必殺技の吹き出し（ことねが返し方を1行・同じ場所。予告の札 y≈336 や下のボタンとは重ならない）：予告が出てからこの秒数だけ
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
    const foe = session.run ? currentFoe(session.run) : null;
    preloadArena(this, foe ? foe.index : undefined); // 本番の背景は5体ごと（無ければ土俵の背景）
    const load = (a) => { if (!this.textures.exists(a.key)) this.load.image(a.key, a.path); };
    Object.entries(GYOJI_FILES).forEach(([k, path]) => { if (!this.cache.audio.exists(`gyoji-${k}`)) this.load.audio(`gyoji-${k}`, path); }); // 行司の声（読めなくても遊びは続く）
    load(kamiArt(HERO_FILE));
    CUT_USED.forEach((c) => load(cutinArt(c)));
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
    // 敵＝20体それぞれの必殺技（foeKimeteAt・攻めの順番で予告とバーで来る・1〜4体目は弱い）
    this.heroKimete = chosenKimete(run, session.kimete);
    const { east, west } = boutParams({ heroStats: run.stats, foeIndex: foe.index, heroKimete: this.heroKimete });
    this.st = newBout({ east, west, seed });
    this.cpu = driver(cpuParams(foe.index), makeRng(seed ^ 0x9e3779b9), undefined, ringRngFor(seed, 'west'), barRngFor(seed, 'west'));
    this.lastDown = -Infinity; // 前に指がボタンに触れた時（ms）
    this.prev = { east: newPrev(), west: newPrev(), gap: Infinity, finisherAt: -Infinity, tac: null, slapAt: -Infinity, lastBar: null, lastFoeKime: null, ring: null };
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
    drawArena(this, foe.index);

    // 上：見出しと相手の名前
    // ことねの吹き出し（いちばん上）が出ている間は隠す（吹き出しの下から字がはみ出さない）
    this.heads = [
      fitText(this.add.text(width / 2, 70, t('kami.title'), textStyle(52, COLORS.gold)).setOrigin(0.5).setShadow(...TXT_SHADOW), width - 80),
      fitText(this.add.text(width / 2, 132, foeLabel(foe), textStyle(34, COLORS.ink)).setOrigin(0.5).setShadow(...TXT_SHADOW), width - 80),
    ];

    // 型紙2枚（足もとが計算の x・箱の面からの高さ）と足もとの影
    this.shadows = {};
    this.figs = {};
    this.off = { east: 0, west: 0 }; // 描く x のずらし（なめらかに動く）
    this.drawX = { east: 0, west: 0 }; // 描いている x（影・予告の札もこれに合わせる）
    this.lastDraw = this.time.now;
    SIDES.forEach((side) => {
      this.shadows[side] = this.add.ellipse(0, GROUND + 2, 120 * VIS, 16 * VIS, 0x000000, 0.3);
    });
    this.figs.east = this.figure(kamiArt(HERO_FILE).key, heroArt(HERO_TYPE).key, FIG_H);
    this.figs.west = this.figure(kamiArt(foeArt(foe).file).key, foeArt(foe).key, FIG_H * stageScale(foe.stage));
    if (this.figs.west) addAura(this, this.figs.west, foeAura(foe));

    // 下の真ん中の立体のボタン1つ（src/ui/bigbutton.js・押すと沈む／離すとばねで戻る・音と振動つき）。指の受け付けもこの部品
    // 出ている〇とバーの上の指も、この部品が同じ指として受ける（zone＝hudTouch・同じ onDown/onUp・2本目の指も同じ数え方＝二重に押さない）
    // カットインの帯の間にたたいた時は、帯を閉じるだけ（ただ倒れている時・相手の攻めの最中・〇の間は、そのまま押しにする）。false＝押したことにしない（沈まない・鳴らない）
    this.btn = createBigButton(this, {
      ...BTN,
      zone: (p) => hudTouch(this.st, p) !== null,
      onDown: () => {
        if (Date.now() < this.guardUntil) return false; // 前の画面（懸賞旗）への二度たたきが、そのまま立ち合いの「つっぱり」にならない
        if (this.cutin) {
          this.closeCutin();
          // ただ倒れている時（長押しの起き上がり）と、相手の攻めの最中（予告のバー・構え・組み＝返す長押しを飲み込まない）と、〇の間（判定を飲み込まない）は、そのまま押しにする
          if (!(this.st && (this.st.f.east.down || this.st.tactic || this.st.f.east.ring))) return false;
        }
        return this.press();
      },
      onUp: () => { if (!this.btn.pressed) this.release(); }, // 2本の指で押した時は、両方離すまで押したまま
    });
    this.events.once('shutdown', () => this.btn.destroy());
    this.pushAt = null; // 押し合いに入った時（計算の秒）
    // 行司の声：立ち合い＝合図の少し前から「はっけよーい、のこった！」・押し合い＝約3.5秒ごとに「のこった、のこった！」（src/core/gyoji.js が間合いを決める）
    this.gyoji = { startAt: tachiaiVoiceAt(this.st.signalAt), started: false, lastAt: -Infinity, landAt: -Infinity, sounds: [] };
    this.events.once('shutdown', () => this.stopGyoji());
    // 相手の攻めの予告の赤い札（予告の間だけ・敵の頭の上）
    this.warnBox = this.add.rectangle(0, WARN_Y, 240, 60, 0xb3261e, 0.95).setStrokeStyle(4, 0xffe3d6, 1).setDepth(WARN_DEPTH).setVisible(false);
    this.warnText = this.add.text(0, WARN_Y, '', textStyle(36, '#ffffff', { stroke: '#4a0d08', strokeThickness: 5 })).setOrigin(0.5).setDepth(WARN_DEPTH + 0.1).setVisible(false);
    this.warnId = null; // 吹き出しを出した予告（同じ予告で二度出さない）
    // 中央上の〇・左端のバー（src/ui/hud.js の場所と絵）と、〇の判定の ◎○×・バーの「こらえ成功！」
    this.hud = this.add.graphics().setDepth(HUD_DEPTH);
    this.ringMark = this.add.text(HUD.ring.x, HUD.ring.y, '', textStyle(130, COLORS.gold, { stroke: '#141a2e', strokeThickness: 10 })).setOrigin(0.5).setDepth(HUD_DEPTH + 0.1).setVisible(false);
    this.barSay = this.add.text(BAR_SAY.x, BAR_SAY.y, '', textStyle(52, COLORS.gold, { stroke: '#141a2e', strokeThickness: 8 })).setOrigin(0, 0.5).setDepth(HUD_DEPTH + 0.1).setVisible(false);
    this.barSayUntil = 0;
    this.plateKey = null; // 今の札の字の鍵
    this.tinted = false;

    // はっけよい・勝ち負け（大きく）・下の案内の1行
    this.call = this.add.text(width / 2, CALL_Y, t('kami.hakkeyoi'), textStyle(72, COLORS.gold, { stroke: '#141a2e', strokeThickness: 8 })).setOrigin(0.5).setVisible(false);
    fitText(this.call, width - 60);
    this.banner = this.add.text(width / 2, 300, '', textStyle(110, COLORS.gold, { stroke: '#141a2e', strokeThickness: 10 })).setOrigin(0.5).setDepth(10);
    this.kimarite = this.add.text(width / 2, 395, '', textStyle(46, COLORS.ink, { stroke: '#141a2e', strokeThickness: 6 })).setOrigin(0.5).setDepth(10);
    this.hint = this.add.text(width / 2, HINT_Y, '', textStyle(36, COLORS.ink)).setOrigin(0.5);
    this.hintKey = null;
    // 1体目は練習の一番：場面ごとに、ことねの吹き出しを上に出す
    this.coach = foe.index === 0 ? { key: null, objs: [] } : null;
    this.tip = { key: null, until: -1, objs: [] }; // はじめて見る攻めの返し方（取組のどの体でも・記録の seenTactics に無い攻めの予告が出た時）

    // 指：触れた瞬間に1回だけ（押したままでは連打しない）。倒れている時は押している間を長押し（ボタンの部品が受ける）。ボタンと〇・バーの外は何も起きない
    // ただカットインの帯が出ている間は、その外をたたいても帯が閉じる
    this.input.on('pointerdown', (p) => {
      if (this.cutin && !this.btn.contains(p)) this.closeCutin();
    });
    // 画面が裏へ回ったら長押しを離す（戻った時に勝手に起き上がらない・バーをため続けない）
    const onHidden = () => { this.release(); this.btn.releaseAll(); };
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

  // ボタンを押した：取組のたたき（または長押しの始まり）にしたら true・何も起きなかったら false（ボタンも沈まない）
  // 押しは kami.js の press＝〇（立ち合い・決め技）が出ていればその判定（跳ねない）・無ければたたき。
  // 押し合いの間は、押した指をそのまま hold へ渡す（相手の攻めの予告＝守りのバーの間は、それでため始め・離して判定。ほかの時は何も起きない）。倒れている時は長押しで起き上がり
  press() {
    const st = this.st;
    if (!st || st.phase === 'done') return false;
    const now = this.time.now;
    if (now - this.lastDown < DOUBLE_MS) return false; // 同じ指の二度押し
    this.lastDown = now;
    if (st.f.east.down) { hold(st, 'east', true); return true; }
    const ring = st.f.east.ring;
    const wasPush = st.phase === 'push'; // 立ち合いの一押しで押し合いに入っても、その指は こらえにしない
    const judge = press(st, 'east');
    if (wasPush && judge === null && !ring) hold(st, 'east', true); // バーの間なら ため始め（kami.js の hold）。〇の押しは渡さない
    if (ring && ring.kind === 'tachiai' && judge === 2) this.showCutin('kiai', t('cutin.kiai')); // 立ち合いの〇がぴったり＝気合のカットイン
    return true;
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
      // 起き上がった後も指を離さなければ押したまま（立って押したままの指は何もしない＝バーをためるのは新しい押しだけ）
      this.sounds();
      this.tacticSounds();
      this.gyojiVoice();
    } else {
      this.stopGyoji();
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

  // 行司の声：鳴らせない所（音が出ない端末・♪を消した時・声が読めていない時）は何もしない。重ならない（間合いが声より長い）・終わったら止める
  gyojiVoice() {
    const st = this.st;
    const g = this.gyoji;
    if (!g.started && st.t >= g.startAt) {
      g.started = true;
      if (this.playGyoji('hakkeyoi')) { g.lastAt = st.t; g.landAt = st.t + GYOJI.lead; }
      return;
    }
    if (g.started && nokottaDue(st, g.lastAt, g.landAt)) { // 重ならない：次まで gap(3.5秒) ＞ 声の長さ（2.9秒・1.95秒）なので、鳴り終わったかを見なくてよい
      if (this.playGyoji('nokotta')) g.lastAt = st.t;
    }
  }

  playGyoji(kind) {
    try {
      if (isMuted()) return false;
      const key = `gyoji-${kind}`;
      if (!this.cache.audio.exists(key)) return false;
      const s = this.sound.add(key, { volume: GYOJI_VOLUME });
      s.play();
      this.gyoji.sounds.push(s);
      while (this.gyoji.sounds.length > 2) { const old = this.gyoji.sounds.shift(); try { old.destroy(); } catch { /* 片付けられなくても遊びは続ける */ } } // 溜めない（古い声は鳴り終わっている）
      return true;
    } catch {
      return false;
    }
  }

  stopGyoji() {
    const g = this.gyoji;
    if (!g) return;
    g.started = true; // 終わった後に立ち合いの声を始めない
    g.sounds.forEach((s) => { try { s.stop(); s.destroy(); } catch { /* 止められなくても遊びは続ける */ } });
    g.sounds = [];
  }

  // 相手の攻めの音（st.tactic は計算が中身を書き換える＝id・phase・from を前のコマと比べる）：予告に入った＝「ピッ」／
  // 実行に入った＝その攻めの音（踏ん張り ずん・突っ張り ドッ・組み がしっ）。守りのバーの こらえ成功＝「ぐっ」と「こらえ成功！」（st.lastBar）・
  // 失敗は barSayKey の「早い…」「押すのが遅い…」「長すぎ…」（押さなかった時は字を出さない＝攻めそのものが答え）。
  // 敵の必殺技が決まった（st.lastFoeKime の landed＝届いた時だけ・空振りやバーの失敗だけでは出さない）＝その技の名前のカットイン
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
    if (st.lastBar !== this.prev.lastBar) { // 守りのバーの結果
      this.prev.lastBar = st.lastBar;
      const key = barSayKey(st); // こらえ成功・早い（帯の下で離した）・押すのが遅い（押したまま予告が終わった）・長すぎ（帯の上・満タン）
      if (key === 'kami.bar.ok') { playBout('brace'); this.sayBar(key, COLORS.gold); }
      else if (key) this.sayBar(key, COLORS.sub);
    }
    const ring = st.f.east.ring;
    if (ring && ring !== this.prev.ring) this.closeCutin(true); // 新しい〇が出た＝出ているカットインの帯はすぐ閉じる（〇が先）
    this.prev.ring = ring;
    if (st.lastFoeKime !== this.prev.lastFoeKime) { // 敵の必殺技が予告の終わりまで来た：届いて決まった時だけカットイン
      this.prev.lastFoeKime = st.lastFoeKime;
      const k = st.lastFoeKime;
      if (k && k.landed) this.showCutin('kuyashii', t(`foekime.${k.kime}`), t('kami.foeKime.by', { foe: foeLabel(this.foe) }));
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

  // バーの結果の字（バーの右・緑の帯の高さ）：少し大きく出て BAR_SAY.ms で消える
  sayBar(key, color) {
    this.tweens.killTweensOf(this.barSay);
    this.barSay.setScale(1).setText(t(key)).setColor(color).setAlpha(1).setVisible(true);
    fitText(this.barSay, this.scale.width - BAR_SAY.x - 20);
    const base = this.barSay.scaleX;
    this.barSay.setScale(base * 1.25);
    this.tweens.add({ targets: this.barSay, scale: base, duration: 140, ease: 'Back.Out' });
    this.barSayUntil = this.time.now + BAR_SAY.ms;
  }

  // 下のボタン1つ：場面で字と色が変わる（見た目は buttonLook・描くのは立体のボタンの部品）
  // 押し合い＝拍で輪が太く明るく／〇＝ぴったりに近いほど輪が太く・脈打つ／バー＝ためた分の弧と赤いふち（「はなして、もう一度」も赤いふち）／踏ん張り中＝薄く「待て」／倒れ＝ふちに起き上がりの弧
  drawButtons() {
    const l = buttonLook(this.st);
    const ring = l.mode === 'go' || l.mode === 'ring';
    this.btn.setLook({
      color: l.color,
      label: t(l.label),
      pulse: l.pulse,
      fill: l.fill,
      arc: l.mode === 'hold' || l.mode === 'bar',
      band: l.band, // バーの間：弧の上に緑の帯（左端のバーと同じ割合）・たまりは金
      fillColor: l.mode === 'bar' ? BAR_FILL : null,
      dim: l.mode === 'wait' || l.mode === 'stay' || l.mode === 'done', // 待つ時は薄く（踏ん張り中は押すと跳ね返される）
      throb: ring,
      ink: ring ? { color: DARK_TXT, stroke: '#fff3c4' } : { color: COLORS.ink, stroke: '#141a2e' },
      halo: l.alert ? ALERT : null,
    });
    this.btn.update();
  }

  // 中央上の〇と左端のバー（src/ui/hud.js）・〇の判定の ◎○×（一瞬）・バーの結果の字の消え方
  drawHud() {
    const st = this.st;
    const g = this.hud;
    g.clear();
    if (st.phase !== 'done') {
      drawRing(g, ringShape(st.f.east.ring, st.t));
      const b = st.bar && st.bar.side === 'east' ? st.bar : null;
      drawBar(g, barShape(b, b ? barGauge(st) : 0));
    }
    const fl = ringFlash(st);
    if (fl) {
      const age = st.t - st.lastRing.at;
      this.ringMark.setText(t(fl.key)).setColor(RING_INK[fl.judge]).setAlpha(Math.max(0, 1 - age / 0.7)).setVisible(true);
    } else this.ringMark.setVisible(false);
    if (this.barSay.visible && this.time.now > this.barSayUntil) {
      this.barSay.setAlpha(Math.max(0, 1 - (this.time.now - this.barSayUntil) / 200));
      if (this.time.now > this.barSayUntil + 200) this.barSay.setVisible(false);
    }
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
    const key = plate ? plate.key + (plate.name ? `:${plate.name}` : '') : null;
    if (plate && key !== this.plateKey) {
      const look = PLATE[plate.kind];
      this.warnText.setScale(1).setFontSize(look.size).setColor(look.ink).setStroke(look.inkStroke, 5).setText(t(plate.key, plate.name ? { name: t(plate.name) } : {}));
      const maxW = plate.name ? PLATE_W.name : PLATE_W.max;
      fitText(this.warnText, maxW - 28);
      this.warnBox.setFillStyle(look.fill, 0.95).setStrokeStyle(4, look.stroke, 1);
      this.warnBox.setSize(Math.max(200, Math.min(maxW, this.warnText.displayWidth + 44)), 60);
    }
    this.plateKey = key;
    const half = this.warnBox.width / 2;
    const x = Math.max(BAR_CLEAR + half, Math.min(this.scale.width - 10 - half, this.drawX.west)); // 左端のバーにかからない
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

  // はじめて見る攻め・敵の必殺技：予告が出た時、まだ見ていなければ 返し方（ボタン（またはバー）を長押し・緑で離す）を ことねの吹き出しで出し、見たと記録する（その場で保存＝次の取組では出ない）
  startTip(id) {
    const seen = session.run && Array.isArray(session.run.seenTactics) ? session.run.seenTactics : [];
    if (!session.run || !(isTactic(id) || id === FOE_KIME_ID) || seen.includes(id)) return;
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
    this.drawHud();
    this.drawWarn();

    // 下の案内（場面ごと＝hintKey・変わった時だけ書き直す）。〇と「はなして、もう一度」は金
    const key = hintKey(st);
    this.drawCoach();
    this.drawTip();
    if (this.coach) this.coach.objs.forEach((o) => o.setVisible(!this.cutin && !this.tip.objs.length)); // カットインの帯（220〜440）と重ねない：帯の間は吹き出しを隠す・攻めの吹き出しが出ている間も隠す
    const bubble = (this.coach && this.coach.objs.length && this.coach.objs[0].visible) || (this.tip.objs.length && this.tip.objs[0].visible);
    this.heads.forEach((o) => o.setVisible(!bubble));
    if (key !== this.hintKey) {
      this.hintKey = key;
      this.hint.setScale(1).setText(key ? t(key) : '').setColor(key === 'kami.hint.ring' || key === 'kami.hint.again' ? COLORS.gold : COLORS.ink);
      fitText(this.hint, this.scale.width - 60);
    }
  }
}
