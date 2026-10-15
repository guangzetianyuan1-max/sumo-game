// src/scenes/KamiScene.js — 紙相撲の取組（10/13 本人「紙相撲に切り替える」・設計書 2026-10-13-sumo-kamizumo-design.md）
// 箱の上の紙の土俵に型紙2枚。下の左の大きなボタンを連打すると主人公（東・左）が跳ねて前へ。敵（西・右）は機械がたたく。箱から落ちた方の負け
// 動きの計算は src/core/kami.js（画面から切り離してある）。この画面は描くのと、指を計算へ渡すだけ
// 指：下のボタン2つ（10/15 ボタン2つに戻す・設計書 2026-10-14-sumo-one-button-ring-bar-design.md §11）。左＝連打だけ（kami.js の mash：触れた瞬間を1回のたたき・
//     〇・バー・倒れている時と立ち合いは効かない＝暗い）／右＝一押しと長押し（kami.js の strike：中央上の〇（立ち合い・決め技）の判定・相手の攻めの予告の間は
//     左端のバーをためる長押し（緑の帯で離す）・倒れている時は長押しで起き上がる。どれも無い時は何も起きない＝暗い）。
//     出ている〇とバーそのものをさわっても右と同じ押し（hud.js の hudTouch・右のボタンの zone）。ほかの所は何も起きない（カットインを閉じるだけ）。
//     2本の指（左で連打しながら右を押す）は、それぞれのボタンが自分の指だけを数える（左の押しは〇の判定・バーのためにならない）
// 〇とバーの置き場所と絵は src/ui/hud.js（稽古と同じ）。〇は判定を一瞬出す（◎＝〇の中に大きく「合」・○×）・バーは「こらえ成功！」
// 相手の攻め：予告（warn）の間、敵の頭の上に赤い札（敵の必殺技は「必殺技！〇〇」）と型紙の赤い光。実行（act）に入った時にその攻めの音。踏ん張り・はたきの実行の間は落ち着いた暗い赤の札（危ない間）・
//   踏ん張りが解けたら「ふっ」と金の札「今だ！押せ！」。敵の必殺技が決まった時（届いた時だけ）は、その技の名前のカットイン
// 終わったら 0.8秒そのまま見せ、勝ち負け（喜び・悔しいのカットイン）を出して recordNow を1回だけ・1.8秒後に取組の後（after）へ
// 演出（20体版 Task 5）：カットイン（気合・決め・喜び・悔しい・敵の必殺技）は上に重ねるだけ・たたくと閉じる・新しい〇や予告が出たらすぐ閉じる／決め技の〇が出た時は段の音（金の帯は〇に替えた）
// 手ごたえ（10/15 本人「勝っても気持ちよくない」・設計書 §12）：◎○の一押し・敵の必殺技が決まった瞬間＝ヒットストップ・白い光・揺れ・「バシッ」（強さは src/core/feel.js の feelFor）／
//   箱の端を越えたらスロー（勝ち＝0.3倍で約1秒・少し寄る／負け＝短く暗く）・型紙はひらひら舞って「ことん」と着地・紙の土ぼこり／座布団とどよめき（cheerLevel）／連打で箱ごと沈んで戻る。
//   止める・遅くするのは画面の時計（clockTick）だけ：実の秒を倍率に通した秒を、機械のたたき手と step の両方に渡す＝両方の型紙・〇・バー・攻めが一緒に止まる・遅くなる（勝ち負けの計算は同じ）。
//   ヒットストップの間の左の連打は1回だけ預かり、時間が動き出した時に渡す（止まった時刻に何度も跳ねない）。スローの間にたたくと残りは元の速さ。足す遅れは1番で2秒まで（FEEL.budget）
// 必殺技のカットイン（v42 第2段・本人 ③⑥⑦⑧「目の帯で」）：主人公の決め技が出た＝主人公の目の帯と技の名前（0.5秒）→ その技の漫画の絵（0.9秒）・
//   相手の必殺技の予告が始まった＝相手の目の帯と技の名前（0.9秒）。この間は画面の時計を止める（clockHold・予告の時間は削らない・たたけば早送りで閉じる）。
//   相手の帯の間に右を押したら、帯を閉じてそのまま長押しの守り（予告から BAR.react 秒の「まだ」の間は押したまま待ち、その時にため始める＝早い人が損をしない）。
//   帯が時間切れ・たたいて閉じた後の「まだ」の間の右も同じ（eyeBar・v42 最終点検 M1）。
//   守り成功＝守りの漫画の絵（0.7秒・時計は止めない・ボタンに重ねない・入力を取らない・4秒以内の2回目は出さない）。絵が読めない時は今の字だけの帯（止めない）。
//   止めるのは画面の時計だけ（kami.js の物理と careersim の数は変えない）
import { KAMI, ON_BEAT, newBout, step, mash, strike, hold, beatOffset, barGauge } from '../core/kami.js?v=43';
import { isTactic, FOE_KIME_ID, BAR } from '../core/tactics.js?v=43';
import { leftLook, rightLook, hintKey, coachKey, gaugeTierOf, tacticPlate, ringFlash, barSayKey, attackScene, bossAlert, tipStep, eyeDeferDue } from '../core/kamibutton.js?v=43';
import { cutinArt, eyeArt, mangaArt, EYE_HERO, MANGA_KORAE, MANGA_MS, koraeDue } from '../core/cutin.js?v=43';
import { boutParams, cpuParams, driver, ringRngFor, barRngFor } from '../core/kamiai.js?v=43';
import { chosenKimete } from '../core/kimetepick.js?v=43';
import { kimariteOf, foeKimeOf } from '../core/kamiresult.js?v=43';
import { foeArt, kamiArt, heroArt, foeAura, stageScale } from '../core/foeart.js?v=43';
import { currentFoe } from '../core/run.js?v=43';
import { PLAY_COUNT } from '../core/ladder.js?v=43';
import { makeRng } from '../core/rng.js?v=43';
import { HERO_TYPE, OKAMI } from '../data/heroes.js?v=43';
import { t, foeLabel, kimariteLabel, getLang } from '../i18n/i18n.js?v=43';
import { GROUND, BOX_H, preloadArena, drawArena } from '../ui/arena.js?v=43';
import { session, prepareOpponent, boutSeed, recordNow, noteTacticSeen } from '../state.js?v=43';
import { playBout, whine, whineStop } from '../ui/sfx.js?v=43';
import { boutWhine } from '../core/whine.js?v=43';
import { isMuted, musicBeat, musicEnd } from '../ui/music.js?v=43';
import { GYOJI, tachiaiVoiceAt, tachiaiPreRoll, nokottaDue, hushVoices } from '../core/gyoji.js?v=43';
import { ringEvent } from '../core/voice.js?v=43';
import { preloadVoices, boutVoiceIds, sayVoice, claimVoiceSlot, releaseVoiceSlot, hushGameVoices } from '../ui/voice.js?v=43';
import { createBigButton } from '../ui/bigbutton.js?v=43';
import { feelFor, slowFor, mashFeel, cheerLevel, pastEdge, musicLevel, newClock, clockHit, clockSlow, clockSkip, clockTick, clockStopped, clockSlowing, clockHold } from '../core/feel.js?v=43';
import { createFx } from '../ui/fx.js?v=43';
import { drawCutinBand, drawEyeBand, drawManga } from '../ui/cutinband.js?v=43';
import { HUD, HIT_MARK, ringShape, barShape, drawRing, drawBar, hudTouch } from '../ui/hud.js?v=43';
import { preloadHeroFigures, preloadGuideArt, addAura, textStyle, fitText, speakerFace, speechBubble, COLORS } from '../ui/widgets.js?v=43';

const FIG_H = 330; // 型紙の高さ（敵は段階の倍率を掛ける）
const VIS = FIG_H / 230; // 見た目の大きさの倍率（計算の座標は変えない・縦方向の跳ね・落ちは同じ比で描く）
const HINT_Y = GROUND + BOX_H + 25; // 案内の1行（箱の下の端 900 とボタンの弧の上端 947 の間）
const CALL_FADE = 0.3; // はっけよいが消えていく長さ（秒）
const HOP_DRAW = 3; // 跳ねの高さは計算の3倍で描く（計算の跳ねは低い・Ruling 6）
// 下の立体のボタン2つ（押していない時の面の中心・面の直径）：画面の下を左右に分ける。どちらも直径 280（片方の親指で届く・本人「片指でどちらか押せるように」）。
// 面の間 60・たたける範囲（半径＋15）の間 30＝隣を誤って押さない。y は面＋側面18＋弧で画面の下の端 1280 に収まる高さ（弧の上端 948 は箱の下の案内の下）
const LEFT_BTN = { x: 190, y: 1104, d: 280 }; // 左＝連打
const RIGHT_BTN = { x: 530, y: 1104, d: 280 }; // 右＝一押しと長押し
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
// 大ボスの守りの合図（v42 第2段・kamibutton.bossAlert）：右のボタンの上（箱の下の案内の高さ）に大きく「守り！長押し」・ボタンは速く脈打って光る
const BOSS_SAY = { x: RIGHT_BTN.x, y: HINT_Y - 4, size: 46, w: 330, throbRate: 11 };
const WARN_Y = GROUND - FIG_H - 134; // 攻めの予告の赤い札（敵の頭の上・今までと同じ高さ 336）
const OPEN_GUARD_MS = 300; // 画面が出てからボタンを受け付けない間（懸賞旗の画面を二度たたきで抜けた指が、立ち合いを誤って始めない）
const DOUBLE_MS = 60; // 同じ指の二度押しは数えない
const SHOW_FALL = 0.8; // 落ちていく型紙をそのまま見せる長さ（秒）
const TO_AFTER_MS = 1800; // 勝ち負けを出してから取組の後へ（カットインの帯 1秒＋勝ち負けの字を見る間）
const ZABUTON_EXTRA_MS = 800; // 座布団が舞う勝ちは、座布団が降りきるまでその分だけ長く見せる
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
const COACH_BOX = { x: 78, y: 92, size: 100, left: 150, top: 22, w: 545, h: 140 };
// はじめて見る攻め・敵の必殺技の吹き出し（ことねが返し方を1行・同じ場所。予告の札 y≈336 や下のボタンとは重ならない）：予告が出てからこの秒数だけ
const TIP_SECS = 3.2;
// カットインの帯（20体版 Task 5）：画面の上の方に横長・約1秒・たたくと閉じる（取組の計算は止めない）
const CUT = { y: 330, h: 220, ms: 1000, faceX: 125, faceH: 260, textX: 460, textW: 470 };
const CUT_USED = ['kiai', 'kime', 'yorokobi', 'kuyashii']; // 取組で出す表情
// 必殺技の目の帯（上の線 170・目の帯 200・名前の帯 110＝170〜492）と漫画の絵の置き場所（v42 第2段）
// 主人公の漫画＝型紙と箱の上・真ん中／守り成功の漫画＝上の方（見出しと名前の所・型紙とボタンにかからない・予告の札（深さ 21）より後ろ）
const EYE_BOX = { top: 170, eyeH: 200, stripH: 110 };
const EYE_ACCENT = { hero: 0xe3c27a, foe: 0xd2342a };
const MANGA_POS = { hero: { x: 360, y: 470, w: 640, angle: -4 }, korae: { x: 420, y: 205, w: 450, angle: 3 } };
const KORAE_DEPTH = 19.5;
const DARK_TXT = '#3b2810';
const LAND_GAP = 0.12; // 同じ型紙の着地の音は、この秒より詰めて鳴らさない
const FLOOR_Y = -BOX_H / VIS; // 箱から落ちた型紙が着地する台（画面の y＝箱の下の端 GROUND+BOX_H・計算の高さに直した値）
const FLUTTER = { term: 260, sway: 40, wobble: 1.2, freq: 9 }; // 落ちる型紙のひらひら：落ちる速さの上限（紙の空気の抵抗）・横の揺れ（px/秒）・傾きの揺れ・揺れの速さ
const SINK = { down: 0.035, tau: 0.06, period: 0.2 }; // 連打の沈み：沈むまでの秒・戻りの減り方・ばねの周期
const KIME_BASHI = 0.45; // 決め技の「シャキーン」と同じ瞬間の「バシッ」の大きさの上限（重ねても山 0.35 以下）
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
    preloadVoices(this, boutVoiceIds(getLang())); // 主人公・ことねの声（勝ち・負け・決め技・立ち合い・こらえ）：今の言葉の物だけ
    load(kamiArt(HERO_FILE));
    CUT_USED.forEach((c) => load(cutinArt(c)));
    // 必殺技のカットイン（v42 第2段）：主人公の目の帯・持っていく決め技の漫画・守り成功の漫画・相手の目の帯（読めなくても取組は字の帯で続く）
    load(eyeArt(EYE_HERO));
    load(mangaArt(MANGA_KORAE));
    const hk = session.run ? chosenKimete(session.run, session.kimete) : null;
    if (hk) load(mangaArt(hk));
    if (foe) load(eyeArt(foe.id));
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
    this.lastDown = { left: -Infinity, right: -Infinity }; // 前に指がそれぞれのボタンに触れた時（ms）
    this.prev = { east: newPrev(), west: newPrev(), gap: Infinity, finisherAt: -Infinity, tac: null, slapAt: -Infinity, lastBar: null, lastFoeKime: null, ring: null, feelRing: null, feelFoe: null };
    this.lastThud = -Infinity;
    this.contacted = false; // 立ち合いのぶつかりを鳴らしたか（2度目からは「ばしっ」）
    this.doneT = -1; // 終わってからの秒（終わる前は −1）
    this.recorded = false;
    this.leaving = false;
    this.fall = null; // 終わった後の、落ちていく型紙の見た目だけの動き
    this.cutin = null; // 今出ているカットインの帯 { c, kind（band・heroEye・heroManga・foeEye）, held（画面の時計を止めている）, timer, onClose }
    this.korae = null; // 守り成功の漫画の絵（帯とは別・入力を取らない）
    this.koraeAt = -Infinity; // 守り成功の漫画を最後に出した時刻（ms）
    this.deferBar = false; // 相手の目の帯の間に押した右：予告から BAR.react 秒になったら、ため始める
    this.eyeBar = null; // 相手の目の帯を出した予告のバー（帯が閉じた後も、このバーの「まだ」の間の右は deferBarPress へ）
    this.guardUntil = Date.now() + OPEN_GUARD_MS; // 画面が出てからこの間は、ボタンを押しても受け付けない（沈まない・鳴らない）
    this.prevTier = 0; // 1コマ前のゲージの色の段（0＝光っていない）

    const { width } = this.scale;
    this.cx = width / 2;
    this.box = drawArena(this, foe.index); // 箱（連打で沈める）
    this.boxLabelY = this.box.label.y;
    // 手ごたえ（src/core/feel.js・src/ui/fx.js）：画面の時計・光と揺れと粒・連打の沈み
    this.clock = newClock();
    this.fx = createFx(this);
    this.sink = null; // 連打の沈み { t0, amp, jit, ms }
    this.heldMash = false; // ヒットストップの間に預かった左の一押し
    this.slowSide = null; // スローを始めた側（1番に1回）
    this.slowOn = false;
    this.slowDark = false;
    const cam = this.cameras.main;
    cam.resetFX();
    cam.setZoom(1).setScroll(0, 0);
    this.events.once('shutdown', () => { this.fx.destroy(); cam.resetFX(); cam.setZoom(1).setScroll(0, 0); });

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

    // 下の立体のボタン2つ（src/ui/bigbutton.js・押すと沈む／離すとばねで戻る・音と振動つき）。指の受け付けもこの部品（それぞれが自分の範囲の指だけを数える＝左右の2本の指は別々）
    // 左＝連打（mash）。効かない時（〇・バー・倒れ・立ち合い）は沈まず小さく横に揺れる。長押しは持たない（離しても何もしない）
    // 右＝一押しと長押し（strike）。出ている〇とバーの上の指も右が同じ指として受ける（zone＝hudTouch・同じ onDown/onUp・2本目の指も同じ数え方＝二重に押さない）
    // カットインの帯の間にたたいた時は、帯を閉じるだけ（左は相手の攻めの最中＝組みの連打を飲み込まない・右は倒れ・攻め・〇の間は、そのまま押しにする）。false＝押したことにしない（沈まない・鳴らない）
    this.lbtn = createBigButton(this, {
      ...LEFT_BTN,
      onDown: () => {
        if (Date.now() < this.guardUntil) return false; // 前の画面（懸賞旗）への二度たたきが、そのまま押しにならない
        if (this.cutin) {
          this.closeCutin();
          if (!(this.st && this.st.tactic)) return false;
        }
        return this.mash();
      },
    });
    this.rbtn = createBigButton(this, {
      ...RIGHT_BTN,
      zone: (p) => hudTouch(this.st, p) !== null,
      onDown: () => {
        if (Date.now() < this.guardUntil) return false; // 前の画面（懸賞旗）への二度たたきが、そのまま立ち合いの〇の判定にならない
        if (this.cutin) {
          this.closeCutin();
          // ただ倒れている時（長押しの起き上がり）と、相手の攻めの最中（予告のバー＝返す長押しを飲み込まない）と、〇の間（判定を飲み込まない）は、そのまま押しにする
          if (!(this.st && (this.st.f.east.down || this.st.tactic || this.st.f.east.ring))) return false;
        }
        // 相手の目の帯を出した予告の「まだ」の間＝そのまま長押しの守り（帯が開いていても閉じた後でも・2本目の指も。早い人も、帯を読んでから押す人も損をしない）
        if (this.deferBarPress()) return true;
        return this.strike();
      },
      onUp: () => { if (!this.rbtn.pressed) this.release(); }, // 2本の指（右のボタンとバー）で押した時は、両方離すまで押したまま
    });
    this.events.once('shutdown', () => { this.lbtn.destroy(); this.rbtn.destroy(); });
    this.pushAt = null; // 押し合いに入った時（計算の秒）
    this.bgm = { cued: false, ended: false }; // 取組の曲（nokotta）：押し合いの始まりで頭へ戻したか・終わりの節を出したか
    // 行司の声：立ち合い＝合図の少し前から「はっけよーい、のこった！」・押し合い＝約3.5秒ごとに「のこった、のこった！」（src/core/gyoji.js が間合いを決める）
    this.gyoji = { startAt: tachiaiVoiceAt(this.st.signalAt), started: false, lastAt: -Infinity, landAt: -Infinity, sounds: [], until: null };
    // v43 本人「『のこった』の直前に少し間がある」：合図が声の「のこった」の位置（GYOJI.lead）より早い取組は、取組の時計を動かす前にその分だけ待って声を先に鳴らす（のこった＝合図ちょうど）
    this.preRoll = tachiaiPreRoll(this.st.signalAt);
    this.events.once('shutdown', () => this.stopGyoji());
    hushGameVoices(this); // 前の取組・取組の後の声が残っていても、新しい取組は黙った所から始める（行司の声を捨てない）
    // 相手の攻めの予告の赤い札（予告の間だけ・敵の頭の上）
    this.warnBox = this.add.rectangle(0, WARN_Y, 240, 60, 0xb3261e, 0.95).setStrokeStyle(4, 0xffe3d6, 1).setDepth(WARN_DEPTH).setVisible(false);
    this.warnText = this.add.text(0, WARN_Y, '', textStyle(36, '#ffffff', { stroke: '#4a0d08', strokeThickness: 5 })).setOrigin(0.5).setDepth(WARN_DEPTH + 0.1).setVisible(false);
    this.warnId = null; // 吹き出しを出した予告（同じ予告で二度出さない）
    // 中央上の〇・左端のバー（src/ui/hud.js の場所と絵）と、〇の判定の ◎○×・バーの「こらえ成功！」
    this.hud = this.add.graphics().setDepth(HUD_DEPTH);
    this.ringMark = this.add.text(HUD.ring.x, HUD.ring.y, '', textStyle(130, COLORS.gold, { stroke: '#141a2e', strokeThickness: 10 })).setOrigin(0.5).setDepth(HUD_DEPTH + 0.1).setVisible(false);
    this.ringMarkKey = null; // 今出している判定の字の鍵（字と大きさを変えるのは鍵が変わった時だけ）
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
    // 大ボスの守りの合図（予告のたびに・予告が終わるか長押しが始まったら消える）
    this.isBoss = foe.index === PLAY_COUNT - 1;
    this.bossSay = fitText(this.add.text(BOSS_SAY.x, BOSS_SAY.y, t('kami.boss.defend'), textStyle(BOSS_SAY.size, '#ffffff', { stroke: '#7a120c', strokeThickness: 9 })).setOrigin(0.5).setDepth(HUD_DEPTH + 1).setVisible(false), BOSS_SAY.w);
    this.bossSayBase = this.bossSay.scaleX;
    this.alert = false;
    this.hintKey = null;
    // 1体目は練習の一番：場面ごとに、ことねの吹き出しを上に出す
    this.coach = foe.index === 0 ? { key: null, objs: [] } : null;
    this.tip = { key: null, until: -1, objs: [] }; // はじめて見る攻めの返し方（取組のどの体でも・記録の seenTactics に無い攻めの予告が出た時）

    // 指：触れた瞬間に1回だけ（押したままでは連打しない）。倒れている時は押している間を長押し（ボタンの部品が受ける）。ボタンと〇・バーの外は何も起きない
    // ただカットインの帯が出ている間は、その外をたたいても帯が閉じる
    this.input.on('pointerdown', (p) => {
      if (this.cutin && !this.lbtn.contains(p) && !this.rbtn.contains(p)) this.closeCutin();
      if (clockSlowing(this.clock)) clockSkip(this.clock); // スローの途中でたたいた＝残りは元の速さ（どこをたたいても）
    });
    // 画面が裏へ回ったら長押しを離す（戻った時に勝手に起き上がらない・バーをため続けない）
    const onHidden = () => { this.release(); this.lbtn.releaseAll(); this.rbtn.releaseAll(); whineStop(); };
    this.game.events.on('hidden', onHidden);
    this.events.once('shutdown', () => this.game.events.off('hidden', onHidden));
    this.events.once('shutdown', () => whineStop()); // 画面を離れる＝「ギュイーン」は必ず止める

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

  // 同じボタンの同じ指の二度押し（DOUBLE_MS 以内）は数えない。左右は別々に数える（2本の指で同時に押しても両方効く）
  fresh(which) {
    const now = this.time.now;
    if (now - this.lastDown[which] < DOUBLE_MS) return false;
    this.lastDown[which] = now;
    return true;
  }

  // 左のボタン（連打）：押し合いのたたき（kami.js の mash）にしたら true。〇・バー・倒れ・立ち合いの間は効かない＝沈まず小さく横に揺れる（false）
  // ヒットストップの間（計算の時刻が止まっている）の連打は1回だけ預かり、時間が動き出した時に渡す（止まった時刻に何度も跳ねて勢いを溜めない）
  mash() {
    const st = this.st;
    if (!st || st.phase === 'done' || !this.fresh('left')) return false;
    if (clockStopped(this.clock) && st.phase === 'push' && leftLook(st).mode === 'tap') {
      this.heldMash = true;
      this.boxBump(beatOffset(st) < ON_BEAT);
      return true;
    }
    if (mash(st, 'east')) { this.boxBump(beatOffset(st) < ON_BEAT); return true; }
    this.lbtn.shake();
    return false;
  }

  // 連打のたびに箱が「トン」と沈んで戻り、両方の型紙が小刻みに震える（拍に合うと少し強く）
  boxBump(onBeat) {
    const m = mashFeel(onBeat);
    this.sink = { t0: this.time.now, amp: m.sink, jit: m.jitter, ms: m.ms };
  }

  // 右のボタン（一押しと長押し）：kami.js の strike＝〇（立ち合い・決め技）が出ていればその判定（跳ねない）・倒れていれば長押しで起き上がり・
  // 押し合いの間は長押しの始まり（守りのバーの間はため始め・離して判定。ほかの時は何も起きない＝損はない・指は数える＝出た時に押したままなら「はなして、もう一度」）。
  // 立ち合いの〇が出る前は効かない（早押しは無い）＝沈まず小さく横に揺れる（false）
  strike() {
    const st = this.st;
    if (!st || st.phase === 'done' || !this.fresh('right')) return false;
    const ring = st.f.east.ring;
    if (st.phase === 'ready' && !ring) { this.rbtn.shake(); return false; }
    const judge = strike(st, 'east');
    if (ring && ring.kind === 'tachiai' && judge === 2) this.showCutin('kiai', t('cutin.kiai')); // 立ち合いの〇がぴったり＝気合のカットイン
    return true;
  }

  // カットインの帯：左に主人公の顔・右に大きな字（と小さな2行目）。約1秒で消える・たたくと閉じる。取組は止めない（上に重ねるだけ）
  showCutin(name, line1, line2 = '', onClose = null) {
    this.closeCutin(true);
    const c = drawCutinBand(this, CUT, name, line1, line2);
    this.cutin = { c, kind: 'band', held: false, onClose, timer: this.time.delayedCall(CUT.ms, () => this.closeCutin()) };
  }

  // 主人公の決め技（v42 第2段）：主人公の目の帯と技の名前（MANGA_MS.heroEye）→ その技の漫画の絵（heroManga）。その間は画面の時計を止める。
  // 目の帯の絵が読めない＝今の字だけの帯（止めない）・漫画が読めない＝目の帯だけで閉じる
  heroFinisherCutin() {
    const name = t(`newtech.${this.heroKimete}`);
    const eye = eyeArt(EYE_HERO);
    if (!this.textures.exists(eye.key)) { this.showCutin('kime', name, t('kami.finish')); return; }
    this.closeCutin(true);
    const c = drawEyeBand(this, EYE_BOX, eye.key, name, '', { accent: EYE_ACCENT.hero });
    clockHold(this.clock, true);
    const manga = mangaArt(this.heroKimete).key;
    this.cutin = { c, kind: 'heroEye', held: true, onClose: null, timer: this.time.delayedCall(MANGA_MS.heroEye, () => this.heroManga(manga)) };
  }

  heroManga(key) {
    const cut = this.cutin;
    if (!cut || cut.kind !== 'heroEye') return;
    const img = drawManga(this, key, MANGA_POS.hero);
    if (!img) { this.closeCutin(); return; }
    cut.c.destroy();
    cut.c = img;
    cut.kind = 'heroManga';
    cut.timer = this.time.delayedCall(MANGA_MS.heroManga, () => this.closeCutin());
  }

  // 相手の必殺技の予告が始まった（v42 第2段）：相手の目の帯と技の名前（MANGA_MS.foeEye）。その間は画面の時計を止める（予告の時間は削らない）。
  // 目の帯の絵が読めない＝名前の帯だけ（止めない）
  foeEyeCutin(kime) {
    this.closeCutin(true);
    const eye = eyeArt(this.foe.id);
    const held = this.textures.exists(eye.key);
    const c = drawEyeBand(this, { ...EYE_BOX, textL: BAR_CLEAR }, held ? eye.key : null, t(`foekime.${kime}`), t('kami.foeKime.by', { foe: foeLabel(this.foe) }), { accent: EYE_ACCENT.foe }); // 名前は左端の守りのバーにかからない所へ
    if (held) clockHold(this.clock, true);
    this.eyeBar = this.st.bar; // この予告のバー（帯が閉じた後の右も「まだ」で捨てない）
    this.cutin = { c, kind: 'foeEye', held, onClose: null, timer: this.time.delayedCall(MANGA_MS.foeEye, () => this.closeCutin()) };
  }

  // 相手の目の帯を出した予告（eyeBar）の右：守りのバーが出ていて、まだ「まだ」の間（予告から BAR.react 秒）なら、押したまま待って その時にため始める（true）。
  // 帯が開いている間でも閉じた後でも（src/core/kamibutton.js eyeDeferDue・v42 最終点検 M1）。指を離す・画面が裏へ回る（releaseAll）と deferTick が取りやめる
  deferBarPress() {
    if (!eyeDeferDue(this.st, this.eyeBar)) return false;
    this.fresh('right');
    this.deferBar = true;
    return true;
  }

  deferTick() {
    const st = this.st;
    const b = st.bar;
    if (!this.rbtn.pressed || st.phase !== 'push' || !b || b.side !== 'east' || b.result !== null || b.heldFrom !== null) { this.deferBar = false; return; }
    if (st.t >= b.from + BAR.react - 1e-6) { this.deferBar = false; strike(st, 'east'); }
  }

  // 守り成功の漫画の絵（MANGA_MS.korae・時計は止めない・ボタンにかからない上の方・入力を取らない）。4秒以内の2回目は出さない
  showKorae() {
    const now = this.time.now;
    if (!koraeDue(this.koraeAt, now)) return;
    const img = drawManga(this, mangaArt(MANGA_KORAE).key, MANGA_POS.korae, KORAE_DEPTH);
    if (!img) return;
    this.koraeAt = now;
    if (this.korae) this.korae.destroy();
    this.korae = img;
    this.time.delayedCall(MANGA_MS.korae, () => {
      if (this.korae !== img) return;
      this.korae = null;
      this.tweens.add({ targets: img, alpha: 0, duration: 150, onComplete: () => img.destroy() });
    });
  }

  dropKorae() {
    if (!this.korae) return;
    this.korae.destroy();
    this.korae = null;
  }

  closeCutin(now = false) {
    const cut = this.cutin;
    if (!cut) return;
    this.cutin = null;
    cut.timer.remove(false);
    if (cut.held) clockHold(this.clock, false); // 止めていた画面の時計を動かす
    if (cut.onClose) cut.onClose();
    if (now) { cut.c.destroy(); return; }
    this.tweens.add({ targets: cut.c, alpha: 0, duration: 150, onComplete: () => cut.c.destroy() });
  }

  release() {
    if (this.st) hold(this.st, 'east', false);
  }

  // 画面の時計（clockTick）が実の秒を、ヒットストップの間は 0・スローの間は 0.3倍にする。その秒を機械のたたき手と step の両方へ渡す（判定の時刻 st.t も同じだけ進む）
  update(time, delta) {
    const st = this.st;
    if (!st) return;
    if (this.preRoll > 0) { // 取組の時計を動かす前の待ち（実の秒）：行司の「はっけよーい」だけ先に鳴らす・型紙も〇も動かない
      this.preRoll -= delta / 1000;
      this.gyojiVoice();
      this.draw();
      whine(null);
      return;
    }
    this.feelEvents(); // 指で出た〇の判定（前のコマの後の押し）＝このコマから止める
    const dt = clockTick(this.clock, Math.min(delta / 1000, KAMI.MAX_DT));
    if (this.slowOn && !clockSlowing(this.clock)) this.endSlow();
    if (st.phase !== 'done') {
      if (dt > 0) {
        if (this.heldMash) { this.heldMash = false; mash(st, 'east'); } // 預かった一押し（止まった時刻のまま渡す）
        this.cpu.tick(st, 'west', dt);
        step(st, dt);
      }
      if (this.deferBar) this.deferTick();
      // 起き上がった後も指を離さなければ押したまま（立って押したままの指は何もしない＝バーをためるのは新しい押しだけ）
      this.sounds();
      this.tacticSounds();
      this.gyojiVoice();
      this.feelEvents();
      this.musicTick();
    } else {
      this.stopGyoji();
      if (!this.bgm.ended) { this.bgm.ended = true; musicEnd(st.winner === 'east'); } // 次の拍の頭で、勝ち＝短い勝ちの節／負け＝静かに閉じる
      this.afterDone(dt);
    }
    this.fx.update(dt);
    this.draw();
    whine(this.whineLevel());
  }

  // 「ギュイーン」の進み（v43・src/core/whine.js）：〇が縮む間＝縮みに合わせて・守りのバーを長押しでためる間＝バーの高さに合わせて。
  // 終わった・倒れた・画面の時計が止まっている（ヒットストップ・カットイン）間は鳴らさない＝null
  whineLevel() {
    if (clockStopped(this.clock)) return null;
    return boutWhine(this.st, barGauge);
  }

  // 手ごたえの合図（計算は演出を知らない＝前のコマとの差で見つける）：主人公の〇の判定（st.lastRing）・敵の必殺技（st.lastFoeKime）・箱の端を越えた（pastEdge）
  feelEvents() {
    const st = this.st, pv = this.prev;
    if (st.lastRing !== pv.feelRing) {
      pv.feelRing = st.lastRing;
      const r = st.lastRing;
      if (r && r.side === 'east') this.applyFeel(feelFor({ type: 'ring', judge: r.judge, reach: r.reach }), r.kind === 'kime');
      const ev = ringEvent(r); // ◎の決め技＝「えいっ！」・立ち合いの◎＝「うおおおっ！」
      if (ev) sayVoice(this, ev);
    }
    if (st.lastFoeKime !== pv.feelFoe) {
      pv.feelFoe = st.lastFoeKime;
      const k = st.lastFoeKime;
      if (k) this.applyFeel(feelFor({ type: 'foeKime', landed: k.landed }), true);
    }
    if (!this.slowSide) {
      const e = pastEdge(st.f.east), w = pastEdge(st.f.west);
      if (e || w) this.startSlow(e && w ? (st.f.east.y <= st.f.west.y ? 'east' : 'west') : e ? 'east' : 'west');
    }
  }

  // 止まる・光る・揺れる・「バシッ」（決め技の「シャキーン」と同じ瞬間は小さめに重ねる）
  applyFeel(f, withKime) {
    if (!f) return;
    clockHit(this.clock, f.stop);
    this.fx.flash(f.flash);
    if (f.shake) this.fx.shake(f.shake.px, f.shake.s);
    if (f.sound) playBout(f.sound, withKime ? Math.min(f.vol, KIME_BASHI) : f.vol);
  }

  // 箱の端を越えた側（side）が落ちていく所をスローで見せ、少し寄る。主人公が落ちる（負け）時は短く暗く
  startSlow(side) {
    this.slowSide = side;
    const s = slowFor(side === 'east');
    clockSlow(this.clock, s.secs, s.scale);
    if (!clockSlowing(this.clock)) return; // 足す遅れを使い切った
    this.slowOn = true;
    const cam = this.cameras.main;
    cam.zoomTo(s.zoom, 220, 'Sine.easeOut', true);
    this.slowDark = s.dark;
    if (s.dark) this.fx.dim(0.28, 200);
  }

  endSlow() {
    this.slowOn = false;
    const cam = this.cameras.main;
    cam.zoomTo(1, 200, 'Sine.easeOut', true);
    if (this.slowDark) this.fx.dim(0, 300);
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
      if (f.fell && !pv.fell) playBout('hyu', vol); // 「ことん」は舞って台に着地した時（afterDone）
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
      if (st.finisherBy === 'east' && this.heroKimete) this.heroFinisherCutin(); // 目の帯 → 漫画の絵（v42 第2段）
    }
    // ゲージの色の段が上がった時（光った時）：段の音。虹は太鼓の連打と確定音を続けて
    const tier = gaugeTierOf(st, 'east');
    if (tier > this.prevTier) {
      playBout(`gauge${tier}`);
      if (tier === 4) playBout('gaugeMax');
    }
    this.prevTier = tier;
  }

  // 取組の曲（src/ui/music.js の nokotta）を取組の時刻 st.t の拍（KAMI.BEAT の整数倍＝beatOffset の 0）に合わせる。毎コマ呼ぶ・消音や音が無い時は music 側が何もしない
  // 押し合いに入った最初のコマ（合図の「のこった」の後・2人とも立ち合った時）＝次の拍の頭から曲を1小節目へ。追い込み（端の近く・30秒過ぎ）は刻みの層を重ねる（musicLevel）
  // 止め・スローの間は合わせない（曲は元の速さで流れ、時間が動き出したコマで半拍以内の近い方へ合わせ直す）
  musicTick() {
    const st = this.st;
    if (clockStopped(this.clock) || clockSlowing(this.clock)) return;
    const cue = st.phase === 'push' && !this.bgm.cued;
    if (cue) this.bgm.cued = true;
    musicBeat(st.t, { level: musicLevel(st), cue });
  }

  // 行司の声：鳴らせない所（音が出ない端末・♪を消した時・声が読めていない時）は何もしない。重ならない（間合いが声より長い）・終わったら止める
  gyojiVoice() {
    const st = this.st;
    const g = this.gyoji;
    if (g.sounds.length && isMuted()) g.sounds = hushVoices(g.sounds); // 鳴っている途中で♪を消した＝その声も止める
    if (!g.started && st.t >= g.startAt) {
      g.started = true;
      if (this.playGyoji('hakkeyoi')) { g.lastAt = st.t; g.landAt = st.t + GYOJI.lead; }
      return;
    }
    if (g.started && !this.slowSide && nokottaDue(st, g.lastAt, g.landAt)) { // 箱の端を越えた後（スロー）は新しい「のこった」を始めない・重ならない：次まで gap(3.5秒) ＞ 声の長さ（2.51秒・1.87秒）なので、鳴り終わったかを見なくてよい
      if (this.playGyoji('nokotta')) g.lastAt = st.t;
    }
  }

  playGyoji(kind) {
    try {
      if (isMuted()) return false;
      const key = `gyoji-${kind}`;
      if (!this.cache.audio.exists(key)) return false;
      const until = claimVoiceSlot(this, kind === 'hakkeyoi' ? GYOJI.tachiaiLen : GYOJI.nokottaLen);
      if (!until) return false;
      this.gyoji.until = until; // 声は一度に1つ：ほかの声が鳴っている間は鳴らさない（次の「のこった」はまた来る）
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
    g.sounds = hushVoices(g.sounds);
    if (g.until != null) { releaseVoiceSlot(this, g.until); g.until = null; } // 止めた声の枠は空ける（勝ちの声を待たせない）
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
      if (key === 'kami.bar.ok') { playBout('brace'); this.sayBar(key, COLORS.gold); sayVoice(this, 'brace'); this.showKorae(); } // ことね「ナイスこらえ！」・守りの漫画の絵
      else if (key) this.sayBar(key, COLORS.sub);
    }
    const ring = st.f.east.ring;
    if (ring && ring !== this.prev.ring) { this.closeCutin(true); this.dropKorae(); } // 新しい〇が出た＝出ているカットインの帯と守りの漫画はすぐ閉じる（〇が先・〇の的を隠さない）
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
      if (cur.id === FOE_KIME_ID && tac.kime) this.foeEyeCutin(tac.kime); // 相手の必殺技＝相手の目の帯（時計を止める）
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
        if (f.fell) this.fall[side] = { x: f.x, y: f.y, vx: f.vx, vy: f.vy, a: f.a, va: (f.a >= 0 ? 1 : -1) * 2.5, ph: 0, landed: false };
        else this.fall[side] = { x: f.x, y: f.y, vx: 0, vy: Math.min(f.vy, 0), a: f.a, va: 0, settle: true }; // 勝った側は宙に浮いたままにせず、箱の面へ降りる（見た目だけ）
      });
    }
    this.doneT += dt;
    Object.keys(this.fall).forEach((side) => {
      const v = this.fall[side];
      if (v.settle) {
        v.vy -= KAMI.G * dt;
        v.x += v.vx * dt;
        v.y += v.vy * dt;
        if (v.y <= 0) { v.y = 0; v.vy = 0; }
        return;
      }
      if (v.landed) { v.a += ((v.a >= 0 ? 1 : -1) * Math.PI / 2 - v.a) * Math.min(1, dt * 10); return; } // 着地したら、ぱたりと寝る
      // 紙の型紙：落ちる速さは紙の空気の抵抗で上限まで・横と傾きはひらひら揺れる・画面の端から出きらない（見た目だけ）
      v.ph += dt * FLUTTER.freq;
      v.vy += (-FLUTTER.term - v.vy) * Math.min(1, dt * 8);
      v.vx *= Math.pow(0.4, dt);
      v.x = Math.max(KAMI.BOX.l - 10, Math.min(KAMI.BOX.r + 10, v.x + v.vx * dt + Math.sin(v.ph) * FLUTTER.sway * dt));
      v.y += v.vy * dt;
      v.a += v.va * dt + Math.cos(v.ph) * FLUTTER.wobble * dt;
      if (v.y <= FLOOR_Y) { // 「ことん」と台に着地・紙の土ぼこり（負けた時は暗め）
        v.y = FLOOR_Y; v.vx = 0; v.vy = 0; v.va = 0; v.landed = true;
        playBout('koton', side === 'east' ? 1 : 0.8);
        const x = Math.max(30, Math.min(this.scale.width - 30, this.drawX[side]));
        this.fx.dust(x, GROUND + BOX_H, { n: side === 'east' ? 10 : 14, dark: side === 'east' });
      }
    });
    if (this.doneT >= SHOW_FALL && !this.recorded) {
      this.recorded = true;
      const won = st.winner === 'east';
      const kimarite = kimariteOf(st);
      const word = t(won ? 'kami.win' : 'kami.lose');
      const foeKime = foeKimeOf(st); // 相手の必殺技で決まった＝その必殺技の名前（主人公の同じ系統の技の名前にしない）
      const how = t('bout.kimarite', { tech: foeKime ? t(`foekime.${foeKime}`) : kimariteLabel(kimarite) }); // 決め技で決まった＝その決め技の名前
      this.banner.setText(word).setColor(won ? COLORS.gold : COLORS.ink).setVisible(false);
      fitText(this.kimarite.setText(how), this.scale.width - 60).setVisible(false);
      // 勝ち＝喜び・負け＝悔しいのカットイン。帯が閉じたら、いつもの勝ち負けの字を出す
      const note = recordNow(won, kimarite);
      // 必殺技で勝ち・10体目以降と大ボス・昇進の一番＝座布団が舞い、大きなどよめき（ふつうの勝ちは今までの歓声）
      const cheer = cheerLevel({ won, how: st.how, foeIndex: this.foe.index, promoted: note ? note.promoted : null });
      playBout(cheer === 'zabuton' ? 'roar' : won ? 'win' : 'lose');
      if (cheer === 'zabuton') this.fx.zabuton();
      sayVoice(this, won ? 'win' : 'loss', { big: cheer === 'zabuton' }, { preempt: true }); // 勝ち＝「ごっつあんです！」（大きな勝ちは続けてことね「やったー！」）・負け＝声なし（v42：「もう一丁！」は取り直しと紛らわしい）
      this.showCutin(won ? 'yorokobi' : 'kuyashii', word, how, () => { this.banner.setVisible(true); this.kimarite.setVisible(true); });
      this.time.delayedCall(TO_AFTER_MS + (cheer === 'zabuton' ? ZABUTON_EXTRA_MS : 0), () => {
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

  // 下のボタン2つ：場面で字と色が変わる（見た目は leftLook・rightLook・描くのは立体のボタンの部品）
  // 左：押し合い＝「連打！」拍で輪が太く明るく／踏ん張り中＝暗く「待て」／〇・バー・倒れ＝暗く「→右」（出番は右）
  // 右：〇＝「一押し！」ぴったりに近いほど輪が太く・脈打つ／バー＝「長押し！」ためた分の弧と赤いふち（「はなして、もう一度」も赤いふち）／倒れ＝ふちに起き上がりの弧／何も無い時＝暗い
  // 暗い時は薄く・平らに沈み（押せない見た目）・字も灰。明るいのは多くて片方（どちらを押すか迷わない）
  drawButtons() {
    this.alert = bossAlert(this.st, this.isBoss);
    this.paintButton(this.lbtn, leftLook(this.st));
    this.paintButton(this.rbtn, rightLook(this.st), this.alert);
    // 大ボスの守りの合図：右のボタンの上に大きく「守り！長押し」（脈に合わせて少し大きく）
    if (this.alert) this.bossSay.setScale(this.bossSayBase * (1 + 0.07 * Math.sin((this.time.now / 1000) * BOSS_SAY.throbRate)));
    this.bossSay.setVisible(this.alert);
  }

  // alert＝大ボスの守りの合図（ふちの輪を脈打たせて太く明るく・ボタンも速く脈打つ・赤い光）
  paintButton(btn, l, alert = false) {
    const ring = l.mode === 'go' || l.mode === 'ring';
    btn.setLook({
      color: l.color,
      label: t(l.label),
      pulse: alert ? 0.55 + 0.45 * Math.sin((this.time.now / 1000) * BOSS_SAY.throbRate) : l.pulse,
      fill: l.fill,
      arc: l.mode === 'hold' || l.mode === 'bar',
      band: l.band, // バーの間：弧の上に緑の帯（左端のバーと同じ割合）・たまりは金
      fillColor: l.mode === 'bar' ? BAR_FILL : null,
      dim: l.dim,
      raise: l.dim ? 0.35 : 1,
      throb: ring || alert,
      throbRate: alert ? BOSS_SAY.throbRate : 14,
      ink: ring ? { color: DARK_TXT, stroke: '#fff3c4' } : l.dim ? { color: COLORS.sub, stroke: '#141a2e' } : { color: COLORS.ink, stroke: '#141a2e' },
      halo: l.alert || alert ? ALERT : null,
    });
    btn.update();
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
    const fl = ringFlash(st, 'east', this.recorded); // 勝ち負けの札を出したら「合」は必ず消す（v43）
    if (fl) {
      const age = st.t - st.lastRing.at;
      if (fl.key !== this.ringMarkKey) { // 「届かない…」は字が長いので小さく・幅に収める／◎の「合」は〇の中に収める（HIT_MARK）／○× は大きく
        this.ringMarkKey = fl.key;
        this.ringMark.setScale(1).setFontSize(fl.far ? 56 : fl.hit ? HIT_MARK.size : 130).setText(t(fl.key));
        if (fl.far) fitText(this.ringMark, this.scale.width - 120);
        if (fl.hit) fitText(this.ringMark, HIT_MARK.w);
      }
      const heroCut = !!this.cutin && (this.cutin.kind === 'heroEye' || this.cutin.kind === 'heroManga'); // 主人公の目の帯と漫画の間は「合」を隠す（目と絵に重ねない・時計が止まっているので閉じた後に残りが出る）
      this.ringMark.setColor(RING_INK[fl.judge]).setAlpha(Math.max(0, 1 - age / 0.7)).setVisible(!heroCut);
    } else { this.ringMark.setVisible(false); this.ringMarkKey = null; }
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
    const show = !!plate && !(this.cutin && this.cutin.kind === 'foeEye'); // 相手の目の帯の間は札を隠す（帯に同じ名前が出ている）
    this.warnBox.setVisible(show).setPosition(x, WARN_Y);
    this.warnText.setVisible(show).setPosition(x, WARN_Y);
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

  // はじめて見る攻め・敵の必殺技：予告が出た時、まだ見ていなければ 返し方（右のボタン（またはバー）を長押し・緑で離す）を ことねの吹き出しで出す。
  // 見たと記録する（その場で保存＝次の取組では出ない）のは、吹き出しが本当に見えた最初のコマ（drawTip・kamibutton.tipStep）。
  // 見えないまま閉じた（決め技の〇の間に来た予告など）は記録しない＝次の予告でまた出る（v42 第2段 D2）
  startTip(id) {
    const seen = session.run && Array.isArray(session.run.seenTactics) ? session.run.seenTactics : [];
    if (!session.run || !(isTactic(id) || id === FOE_KIME_ID) || seen.includes(id)) return;
    const tip = this.tip;
    tip.objs.forEach((o) => o.destroy());
    const { x, y, size, left, top, w, h } = COACH_BOX;
    tip.key = `tactic.tip.${id}`;
    tip.id = id;
    tip.shown = false;
    tip.until = this.st.t + TIP_SECS;
    tip.objs = [...speakerFace(this, OKAMI, x, y, size), ...speechBubble(this, left, top, w, h, t(tip.key), { size: 28, min: 28 })];
    tip.objs.forEach((o) => o.setDepth(9)); // 練習の吹き出し（8）より上
  }

  // 吹き出しは 一定の秒数・取組が終わるまで。カットインの帯（220〜440）の間は隠す。出ている間は練習の一番の吹き出しを隠す
  drawTip() {
    const tip = this.tip;
    if (!tip.objs.length) return;
    const s = tipStep(tip, { t: this.st.t, done: this.st.phase === 'done', attack: attackScene(this.st), cutin: !!this.cutin }); // 攻めの場面（連打・〇）になったら守りの返し方は閉じる（v42）
    if (s.close) {
      tip.objs.forEach((o) => o.destroy());
      tip.objs = [];
      tip.key = null;
      return;
    }
    if (s.note) { tip.shown = true; noteTacticSeen(tip.id); } // 見えた最初のコマで「見た」と記録
    tip.objs.forEach((o) => o.setVisible(s.visible));
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
    c.objs = [...speakerFace(this, OKAMI, x, y, size), ...speechBubble(this, left, top, w, h, t(key), { size: 28, min: 28 })];
    c.objs.forEach((o) => o.setDepth(8));
  }

  draw() {
    const st = this.st;
    const nowMs = this.time.now;
    // 連打の沈み：箱ごと「トン」と沈んでばねで戻る（少し上へ行き過ぎる）・型紙は小刻みに震える
    let sinkY = 0, jit = 0;
    const sn = this.sink;
    if (sn) {
      const tt = (nowMs - sn.t0) / 1000;
      if (tt * 1000 >= sn.ms) this.sink = null;
      else if (tt < SINK.down) { sinkY = sn.amp * tt / SINK.down; jit = sn.jit; } // 「トン」と沈む
      else { // ばねで戻る（少し上へ行き過ぎる）
        const u = tt - SINK.down, env = Math.exp(-u / SINK.tau);
        sinkY = sn.amp * env * Math.cos(u * 2 * Math.PI / SINK.period);
        jit = sn.jit * env;
      }
    }
    this.box.g.setY(sinkY);
    this.box.label.setY(this.boxLabelY + sinkY);
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
      } else if (img && f.fell) {
        // 落ちていく型紙（スローで舞う所・10/15 手ごたえ）：箱の端は画面の端に近いので、絵の四隅が画面の端（10px内側）から出ない所まで見た目だけ内側へ
        const th = -f.dir * v.a;
        const hw = img.displayWidth / 2, hh = img.displayHeight;
        const xs = [-hw, hw].flatMap((x) => [0, -hh].map((y) => x * Math.cos(th) - y * Math.sin(th)));
        const lo = 10 - Math.min(...xs), hi = this.scale.width - 10 - Math.max(...xs);
        target = Math.max(lo, Math.min(hi, v.x + this.off[side])) - v.x;
      } else if (f.fell) target = this.off[side]; // 落ちていく間はずらしを動かさない
      this.off[side] += (target - this.off[side]) * k; // なめらかに（倒れた時・起きた時に飛ばない）
      const dx = v.x + this.off[side];
      this.drawX[side] = dx;
      const onBoxNow = !f.fell; // 箱の上の型紙だけ、箱と一緒に沈む・震える
      if (img) {
        img.setPosition(dx + (onBoxNow && jit ? (Math.random() * 2 - 1) * jit : 0), GROUND - lift + (onBoxNow ? sinkY : 0));
        img.setRotation(-f.dir * v.a); // 反る向き（＋）が自分の後ろになるように
      }
      // 影：箱の上にいる間だけ・高く跳ねるほど小さく薄く（型紙と同じだけずらす）
      const sh = this.shadows[side];
      const onBox = v.x >= KAMI.BOX.l && v.x <= KAMI.BOX.r && v.y > KAMI.FALL_Y;
      const sk = Math.max(0.4, 1 - Math.max(0, lift) / (200 * VIS));
      sh.setPosition(dx, GROUND + 2 + sinkY).setScale(sk, 1).setAlpha(onBox ? 0.3 * sk + 0.05 : 0);
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
    this.hint.setVisible(!this.alert); // 大ボスの守りの合図が出ている間は、同じ所の案内の1行を隠す
    if (key !== this.hintKey) {
      this.hintKey = key;
      this.hint.setScale(1).setText(key ? t(key) : '').setColor(key === 'kami.hint.ring' || key === 'kami.hint.again' ? COLORS.gold : COLORS.ink);
      fitText(this.hint, this.scale.width - 60);
    }
  }
}
