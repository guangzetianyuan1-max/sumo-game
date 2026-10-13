// src/scenes/BoutScene.js — 取組を本人のドットの力士で見せる（10/11 本人「3の動きで『動画を入れて』」・見本＝art_src/動画試作/bout_video.py）
// 勝ち抜き：自分（東）＝run の値・相手（西）＝今の相手の値
// 取組を計算したらすぐ recordNow → 保存（動きは結果を見せるだけ）。ボタンは「結果へ」だけ（取組の後の画面 after へ）
// 結果が出たら右下に一言（10/11 本人）：勝ち＝娘が祝う・負け＝親方が心技体の不足と技の選びを言う（boutComment）。動きの記録はその時に最後の1行だけにする
// 自動の分岐（this.auto）は残してあるが、10/12 夜に場所の自動が無くなったので常に false
// 土俵：横に広い世界（WORLD.w）を container に入れ、触れ合う所を追って横に動かす（屋根と四房は画面に止めたまま）
// 力士：assets/bout/<east|west>/<姿勢>.png（tools/prep_bout.py）。姿勢の選びと位置の計算は src/core/boutanim.js
// 決まり方：突き押しの「出し」＝俵の外へ押し出して土俵の下へ／「倒し」＝俵際で倒れる／ほか＝踏ん張る勝ちと倒れる負け（技ごとの動きは後の段で1つずつ）
import { runBout } from '../core/bout.js?v=33';
import { makeWrestler } from '../core/wrestler.js?v=33';
import { currentFoe } from '../core/run.js?v=33';
import { foeArt, foePose, foeFrame, foePoseArt, stageAura, stageScale } from '../core/foeart.js?v=33';
import { boutStats } from '../core/career.js?v=33';
import { kumiPlan } from '../core/kumi.js?v=33';
import {
  POSE_NAMES, WORLD, OVERLAP, stepPoses, finishKind, isThrust, contactX, clampContact, viewScroll, bodyLeft, bodyScale,
} from '../core/boutanim.js?v=33';
import { t, techLabel, getLang, heroName, foeLabel } from '../i18n/i18n.js?v=33';
import { session, recordNow, boutSeed } from '../state.js?v=33';
import { boutComment } from '../core/advice.js?v=33';
import { WORD_COLOR, wordArt } from '../data/words.js?v=33';
import { playBout } from '../ui/sfx.js?v=33';
import {
  button, backButton, fitText, textStyle, statBars, speakerFace, speechBubble, preloadGuideArt, preloadOyakataArt,
  preloadWordsIndex, loadWordsArt, addAura, COLORS,
} from '../ui/widgets.js?v=33';

const STEP_MS = { normal: 1200, fast: 500 };
const SPEEDS = ['normal', 'fast', 'result'];
const PACE = { normal: 1, fast: 0.5 }; // 動きの長さに掛ける数（速いは見本の半分）
const FEET_Y = WORLD.feetY; // 足もとの線（輪の中心の線）
const STAGE = { top: 170, bottom: 810 }; // 土俵の画面の上下（床の下の端は場面の札 y808 のすぐ上）
const READY_MS = 1000; // 立ち合いの前の1行（塩をまいて、時間いっぱい）を見せる長さ
const AUTO_SHOW_MS = 800; // 自動の時、結果を見せる長さ
// 動きの長さ（ms・普通の速さ＝見本の間）。押し出しの決まり方は押し 900＋倒れる 650＋結果まで 250＝1.8秒
const MS = {
  rise: 120, charge: 180, hold: 150, // 立ち合い：立ち上がる・当たる・当たったまま（ドーン）
  slide: 180, recoilAt: 300, recoil: 80, // 1手：新しい所へ滑る・突いた手を引くまで・引いて離れる
  push: 900, pushdown: 700, fall: 650, fallDown: 600, banner: 250,
  word: 380, doon: 450, pop: 120, shake: 100, shakeHit: 60,
};
const WORD = { y: 275, w: 372, edge: 8 }; // 効果文字：画面の y・幅（絵 600px の 0.62）・画面の端からの余白
// 結果の札：顔（頭の上の端 y≈337）にかからないよう屋根の所まで上げた（前は y231〜381）
const BANNER = { top: 172, h: 150, win: 221, kim: 286 };
// 結果の後の一言：動きの記録（y852〜・最後の1行だけ＝折れても2行で y940 まで）の下・「取組の順へ」（上の端 y1145）の上
const COMMENT = { left: 30, right: 700, top: 952, h: 180, face: 110 };
// 組み絵のカットイン（設計書 9.6.1）：帯の中心の高さ・絵の高さの上限・出す長さ
const KUMI = { y: 560, h: 480, ms: { normal: 1200, fast: 600 } };
const SIDES = ['east', 'west'];
const other = (side) => (side === 'east' ? 'west' : 'east');
const lerp = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u));

export class BoutScene extends Phaser.Scene {
  constructor() {
    super('bout');
  }

  preload() {
    preloadGuideArt(this); // 勝った時の娘の顔
    preloadOyakataArt(this); // 負けた時の親方の顔
    preloadWordsIndex(this); // 効果文字（ドーン！・バチーン！など）
    // 力士の姿勢の絵と目録（大きさと前の端）
    if (!this.cache.json.exists('bout-index')) this.load.json('bout-index', 'assets/bout/index.json');
    SIDES.forEach((side) => POSE_NAMES.forEach((p) => {
      const key = `bout-${side}-${p}`;
      if (!this.textures.exists(key)) this.load.image(key, `assets/bout/${side}/${p}.png`);
    }));
    // 敵のドット（右にいて左を向く1枚・姿勢に合わせて傾ける）
    const foe = session.run ? currentFoe(session.run) : null;
    if (foe) {
      const a = foeArt(foe);
      if (!this.textures.exists(a.dotKey)) this.load.image(a.dotKey, a.dotPath);
    }
    if (!this.cache.json.exists('foe-poses')) this.load.json('foe-poses', 'assets/figures/dot/poses.json');
    this.load.json('kumi-index', 'assets/figures/kumi/index.json'); // 組み絵の目録（届いた物だけ）
  }

  create() {
    this.done = false;
    this.kumiClose = null; // 出ている組み絵の帯を閉じる関数
    this.auto = false; // 10/12 夜 場所の自動は無くなった（自動の分岐は使わない）
    this.lastPos = 0;
    this.history = [];
    this.i = 0;
    const run = session.run;
    const foe = run ? currentFoe(run) : null;
    if (!foe || !session.strategy || !session.oppStrategy) {
      this.scene.start(run ? 'ladder' : 'guide');
      return;
    }
    const you = makeWrestler(run.type, { ...boutStats(run), known: run.known }); // 自分は覚えた手で取る（疲れは無い）
    const opp = makeWrestler(foe.type, foe.stats);
    // 種は run の勝ち数と連敗数から（読み直して取り直しても同じ取組）
    this.result = runBout({ wrestler: you, strategy: session.strategy }, { wrestler: opp, strategy: session.oppStrategy }, boutSeed(run));
    this.names = { east: heroName(run.type), west: foeLabel(foe) };
    // 結果の後の一言の材料（自分の値は取組の値）
    this.commentIn = {
      my: { shin: you.shin, gi: you.gi, tai: you.tai }, opp: { shin: opp.shin, gi: opp.gi, tai: opp.tai },
      known: you.known, myType: run.type, oppType: foe.type, guide: run.guide,
    };
    // 結果はここで記録して保存する（作戦は recordNow が空にする＝この画面にもう一度入っても取り直さず取組の後へ）
    recordNow(this.result.winner === 'east', this.result.kimarite);
    // 組み絵：立ち合いの後（踏ん張り）と決まる直前（投げ／投げられ）。READY_MS の間に読み込み、間に合わなければ出さない
    const kumiHave = this.cache.json.get('kumi-index') || [];
    this.kumi = kumiPlan(foe, this.result.winner === 'east', kumiHave);
    // この取組で読み込んだ組み絵は、画面を出る時に TextureManager から外す（60枚が居座って古い iPhone の Safari で重くならないように）
    const kumiKeys = [];
    [this.kumi.grip, this.kumi.finish].filter(Boolean).forEach((f) => {
      const k = `kumi-${f}`;
      if (!this.textures.exists(k)) { kumiKeys.push(k); this.load.image(k, `assets/figures/kumi/${f}.jpg`); }
    });
    this.events.once('shutdown', () => {
      kumiKeys.forEach((k) => { if (this.textures.exists(k)) this.textures.remove(k); });
    });
    this.load.start();

    const { width } = this.scale;
    this.cx = width / 2;
    loadWordsArt(this, getLang()); // 目録にある効果文字の絵だけ（届く前に出す時は字で代える）
    this.boutIndex = this.cache.json.get('bout-index');
    this.sizes = { east: bodyScale(run.type), west: bodyScale(foe.type) };
    // 敵のドットがあればそれを西に置く（大きさは段階ごと・光るオーラも）
    const dot = foeArt(foe).dotKey;
    this.foeDot = this.textures.exists(dot) ? dot : null;
    this.foeAura = stageAura(foe.stage);
    if (this.foeDot) {
      const k = stageScale(foe.stage);
      this.sizes.west = { sx: k, sy: k };
    }
    // 横向きの姿勢の絵（届いた物だけ）。まだ読んでいなければ読み、読めたら置き直す（それまでは正面のドット）
    this.foeFile = foeArt(foe).file;
    const listed = (this.cache.json.get('foe-poses') || {})[this.foeFile] || [];
    const loaded = () => listed.filter((p) => this.textures.exists(foePoseArt(this.foeFile, p).key));
    this.foeHave = loaded();
    const todo = listed.filter((p) => !this.textures.exists(foePoseArt(this.foeFile, p).key));
    if (todo.length) {
      todo.forEach((p) => { const a = foePoseArt(this.foeFile, p); this.load.image(a.key, a.path); });
      this.load.once('complete', () => { this.foeHave = loaded(); if (this.bodies) this.layout(); });
      this.load.start();
    }
    this.anims = []; // 動いている動きの tween（結果だけに替えた時に止める）
    this.words = []; // 出ている効果文字
    this.thrustN = 0; // 突っ張りの数（バチーン！とバシッ！を交互に）
    this.tachiaiDone = false;
    this.shown = false;
    // 立ち合いの前：仕切り・二人の間 120
    this.view = { contact: WORLD.ringX, gap: 120, east: { pose: 'shikiri', dy: 0 }, west: { pose: 'shikiri', dy: 0 } };
    this.drawStage();
    this.layout();
    const half = width / 2 - 40;
    // 東西の札は一段上げ、その下に心・技・体の小さな棒（屋根は y170 から）
    // 東西の名前はしこ名（自分は東）
    fitText(this.add.text(30, 88, t('bout.sideType', { side: t('bout.east'), type: this.names.east }), textStyle(30, COLORS.ink)), half);
    fitText(this.add.text(width - 30, 88, t('bout.sideType', { side: t('bout.west'), type: this.names.west }), textStyle(30, COLORS.ink)).setOrigin(1, 0), half);
    statBars(this, 30, 128, width / 2 - 50, { shin: you.shin, gi: you.gi, tai: you.tai }, { compact: true });
    statBars(this, width / 2 + 20, 128, width / 2 - 50, { shin: opp.shin, gi: opp.gi, tai: opp.tai }, { compact: true });
    this.sceneLabel = this.add.text(30, 808, '', textStyle(28, COLORS.gold));
    this.lines = this.add.text(30, 852, '', textStyle(30, COLORS.ink, { lineSpacing: 12, wordWrap: { width: width - 60, useAdvancedWrap: true } }));
    // 結果はもう記録してある＝取組の順へ戻っても取り直しにはならない
    backButton(this, () => this.scene.start('after'));
    if (this.auto) {
      // 自動：画面のどこを押しても自動を止めて取組の順へ（結果は記録済み）
      const onDown = () => this.stopAuto();
      this.input.on('pointerdown', onDown);
      this.events.once('shutdown', () => this.input.off('pointerdown', onDown));
      this.play();
      return;
    }
    this.speedBtn = button(this, width - 160, 50, 270, 72, this.speedLabel(), () => this.cycleSpeed(), { color: COLORS.buttonSub, size: 26 });
    // 立ち合いの前に1行だけ（時間いっぱいの長さは段ごとに違うが、分は出さない）。速さを「結果だけ」に替えたらすぐ始まる
    this.lines.setText(t('bout.ready'));
    this.time.delayedCall(READY_MS, () => this.play());
  }

  // 自動の最中に押された：自動を止めて取組の順へ（1度だけ）
  stopAuto() {
    if (!this.auto) return;
    this.auto = false;
    this.time.removeAllEvents();
    this.scene.start('after');
  }

  // この1番の速さ（自動の時は結果だけ・本人の設定 session.speed はそのまま）
  speed() {
    return this.auto ? 'result' : session.speed;
  }

  speedLabel() {
    return t('bout.speed', { speed: t(`speed.${session.speed}`) });
  }

  // 土俵（見本と同じ見た目）：少し上から見た土俵の上の面・台の横の面と土の段・楕円の俵の輪・仕切り線・奥の観客
  // 観客と土俵と力士は横に広い世界（container）の中・屋根と四房は画面に止める
  drawStage() {
    const { width } = this.scale;
    const { w: WW, ringX: RC, rx: RX, ry: RY } = WORLD;
    this.add.rectangle(width / 2, (STAGE.top + STAGE.bottom) / 2, width, STAGE.bottom - STAGE.top, 0x1b2238);
    this.world = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x262e4a, 1);
    for (const y of [150, 195, 240, 285]) {
      for (let x = 18; x < WW; x += 36) g.fillCircle(x, STAGE.top + y, 12);
    }
    const top = FEET_Y - RY - 40;
    const near = FEET_Y + RY + 40;
    const base = FEET_Y + RY + 95; // 800：場面の札（y808）の上
    g.fillStyle(0xc9a46b, 1); // 土俵の上の面
    g.fillPoints([{ x: 30, y: top }, { x: WW - 30, y: top }, { x: WW + 40, y: near }, { x: -40, y: near }], true);
    g.fillStyle(0xa8824c, 1); // 台の横の面
    g.fillRect(-40, near, WW + 80, base - near);
    g.lineStyle(2, 0x987442, 1); // 横の面の土の段
    for (let k = 0; k < 4; k++) g.lineBetween(-40, near + 12 + k * 12, WW + 40, near + 12 + k * 12);
    g.lineStyle(12, 0xe8d6a8, 1); // 俵の輪
    g.strokeEllipse(RC, FEET_Y, RX * 2 - 12, RY * 2 - 12, 96);
    g.lineStyle(2, 0xc2ae80, 1);
    g.strokeEllipse(RC, FEET_Y, RX * 2 - 26, RY * 2 - 22, 96);
    g.lineStyle(5, 0xf6f1e6, 1); // 仕切り線
    [RC - 45, RC + 45].forEach((x) => g.lineBetween(x, FEET_Y - 14, x, FEET_Y + 14));
    g.fillStyle(0x2a2238, 1); // 床
    g.fillRect(0, base, WW, STAGE.bottom - base);
    this.world.add(g);
    // 力士（原点は左下＝足もと）。東を手前に
    this.bodies = {};
    ['west', 'east'].forEach((side) => {
      const foeImg = side === 'west' && this.foeDot;
      const img = this.add.image(0, FEET_Y, foeImg ? this.foeDot : `bout-${side}-shikiri`).setOrigin(0, 1);
      img.setScale(this.sizes[side].sx, this.sizes[side].sy);
      if (foeImg) addAura(this, img, this.foeAura);
      this.bodies[side] = img;
      this.world.add(img);
    });
    // 屋根のにおわせ（画面に止める）
    const roof = this.add.graphics();
    roof.fillStyle(0x3a2a20, 1);
    roof.fillPoints([{ x: 60, y: 170 }, { x: 660, y: 170 }, { x: 720, y: 230 }, { x: 0, y: 230 }], true);
    [[40, 0x3f6aa8], [253, 0xc8553d], [467, 0xf3e6c8], [680, 0x222222]].forEach(([x, c]) => this.add.rectangle(x, 245, 14, 30, c));
  }

  // 姿勢の絵の大きさと前の端（目録が読めなかった時の代わりの値）
  meta(side, pose) {
    const idx = this.boutIndex && this.boutIndex[side];
    const m = idx && Object.prototype.hasOwnProperty.call(idx, pose) ? idx[pose] : null;
    return m || { w: 200, h: 250, front: side === 'east' ? 199 : 0 };
  }

  // this.view（触れ合う所・二人の間・姿勢・上下のずれ）から、絵の置き場と画面の追いを決める
  layout() {
    const v = this.view;
    this.world.x = -Math.round(viewScroll(v.contact));
    SIDES.forEach((side) => {
      const s = v[side];
      const img = this.bodies[side];
      let m;
      if (side === 'west' && this.foeDot) {
        // 敵は姿勢の名に合わせて横向きの絵を選んで傾ける（無ければ正面のドットを傾ける）。足もとの左端を軸に・前の端＝左端
        const fr = foeFrame(s.pose, this.foeHave || []);
        const tex = fr ? foePoseArt(this.foeFile, fr.img).key : this.foeDot;
        if (img.texture.key !== tex) img.setTexture(tex);
        const fp = fr || foePose(s.pose);
        img.setAngle(fp.angle);
        img.setScale(this.sizes.west.sx, this.sizes.west.sy * fp.sy);
        m = { w: img.width, h: img.height, front: 0 };
      } else {
        const key = `bout-${side}-${s.pose}`;
        if (img.texture.key !== key && this.textures.exists(key)) img.setTexture(key);
        m = this.meta(side, s.pose);
      }
      img.setPosition(Math.round(bodyLeft(side, v.contact, v.gap, m.front, this.sizes[side].sx)), Math.round(FEET_Y + s.dy));
    });
  }

  pace() {
    return PACE[this.speed()] || 1;
  }

  // 0→1 の u で fn を呼ぶ動き1つ（終わったら done）
  phase(ms, fn, done) {
    const o = { u: 0 };
    const tw = this.tweens.add({
      targets: o, u: 1, duration: Math.max(1, Math.round(ms)),
      onUpdate: () => {
        fn(o.u);
        this.layout();
      },
      onComplete: () => {
        this.anims = this.anims.filter((a) => a !== tw);
        fn(1);
        this.layout();
        if (done) done();
      },
    });
    this.anims.push(tw);
  }

  // 動きの段を順に：steps＝[{ ms, fn(u), at: [[割合, 出来事]] }]。animate が偽なら、言葉も音も出さず最後の形にすぐ置く
  runSteps(steps, done, animate) {
    if (!animate) {
      steps.forEach((st) => st.fn(1));
      this.layout();
      if (done) done();
      return;
    }
    const next = (k) => {
      if (k >= steps.length) {
        if (done) done();
        return;
      }
      const st = steps[k];
      const ms = st.ms * this.pace();
      (st.at || []).forEach(([f, cb]) => {
        if (f <= 0) cb();
        else this.time.delayedCall(f * ms, cb);
      });
      this.phase(ms, st.fn, () => next(k + 1));
    };
    next(0);
  }

  stopAnims() {
    this.anims.forEach((tw) => tw.stop());
    this.anims = [];
  }

  clearWords() {
    this.words.forEach((o) => {
      this.tweens.killTweensOf(o);
      o.destroy();
    });
    this.words = [];
  }

  // 効果文字をぽんと出す（触れ合う所の上・dx だけ横へ）。絵が無ければ太い字で代える。life ms で消える
  word(id, dx, life) {
    const { width } = this.scale;
    const art = wordArt(getLang(), id, this.cache.json.get('word-index'), this.cache.json.get('word-en-index'));
    let obj;
    if (art && this.textures.exists(art.key)) {
      obj = this.add.image(0, WORD.y, art.key);
      obj.setScale(WORD.w / obj.width);
    } else {
      obj = fitText(this.add.text(0, WORD.y, t(`word.${id}`), textStyle(56, WORD_COLOR[id], { stroke: '#1a1020', strokeThickness: 10 })).setOrigin(0.5), WORD.w);
    }
    const half = obj.displayWidth / 2;
    const x = this.view.contact - viewScroll(this.view.contact) + dx;
    obj.setX(Math.max(WORD.edge + half, Math.min(width - WORD.edge - half, x))).setDepth(5);
    const full = obj.scaleX;
    obj.setScale(full * 1.35);
    this.tweens.add({ targets: obj, scale: full, duration: MS.pop * this.pace() });
    this.words.push(obj);
    this.time.delayedCall(life * this.pace(), () => {
      this.tweens.killTweensOf(obj);
      this.words = this.words.filter((o) => o !== obj);
      obj.destroy();
    });
  }

  // 画面を横にだけ揺らす（見本：当たりで 6px・突っ張りで 4px）
  shake(px, ms) {
    this.cameras.main.shake(ms * this.pace(), new Phaser.Math.Vector2(px / this.scale.width, 0));
  }

  // 立ち合い：仕切り → 立ち上がる → 当たる（ドーン！・どん・揺れ）
  tachiai(done) {
    const v = this.view;
    const both = (pose) => {
      v.east.pose = v.west.pose = pose;
      v.east.dy = v.west.dy = 0;
    };
    this.runSteps([
      { ms: MS.rise, fn: (u) => { both('rise'); v.gap = lerp(120, 95, u); } },
      { ms: MS.charge, fn: (u) => { both('tachiai'); v.gap = lerp(95, 0, u); } },
      {
        ms: MS.hold, fn: () => both('tachiai'),
        at: [[0, () => { this.word('doon', 0, MS.doon); playBout('thud'); this.shake(6, MS.shake); }]],
      },
    ], done, true);
  }

  // 突っ張りが当たった：バチーン！とバシッ！を交互に・平手の音・小さな揺れ
  thrustHit(attacker) {
    const id = this.thrustN % 2 === 0 ? 'bachiin' : 'bashi';
    this.thrustN += 1;
    this.word(id, id === 'bashi' ? (attacker === 'east' ? 50 : -50) : 0, MS.word);
    playBout('slap');
    this.shake(4, MS.shakeHit);
  }

  // 記録の1行：姿勢を選び、新しい触れ合う所へ滑る。突き押しは手を引いて少し離れる（見本の突っ張りの間）
  showEntry(e, idx, animate) {
    this.stopAnims();
    const p = stepPoses(e, this.lastPos, idx);
    this.lastPos = e.pos;
    this.sceneLabel.setText(t(`scene.${e.east.scene}`));
    this.history = [...this.history, t('bout.line', { east: techLabel(e.east.id), west: techLabel(e.west.id) })].slice(-4);
    this.lines.setText(this.history.join('\n'));
    const v = this.view;
    const from = v.contact;
    const gap0 = v.gap;
    const to = contactX(e.pos);
    const thrust = !!p.attacker && isThrust(e[p.attacker].id);
    const steps = [{
      ms: MS.slide,
      fn: (u) => {
        v.east.pose = p.east;
        v.west.pose = p.west;
        v.east.dy = v.west.dy = 0;
        v.contact = lerp(from, to, u);
        v.gap = lerp(gap0, 0, u);
      },
      at: thrust ? [[0, () => this.thrustHit(p.attacker)]] : [],
    }];
    if (thrust && animate) {
      const a = p.attacker;
      steps.push({ ms: MS.recoilAt - MS.slide, fn: () => {} });
      steps.push({ ms: MS.recoil, fn: (u) => { v[a].pose = 'grip'; v[other(a)].pose = 'back'; v.gap = lerp(0, 30, u); } });
    }
    this.runSteps(steps, null, animate);
  }

  play() {
    if (this.done) return;
    const log = this.result.log;
    if (this.speed() === 'result') {
      // 結果だけ：言葉も音も出さず、最後の形へすぐ置く
      this.stopAnims();
      this.clearWords();
      this.showEntry(log[log.length - 1], log.length - 1, false);
      this.finish();
      return;
    }
    if (this.i >= log.length) {
      this.finish();
      return;
    }
    if (!this.tachiaiDone) {
      this.tachiaiDone = true;
      this.tachiai(() => this.showKumi(this.kumi.grip, () => this.play()));
      return;
    }
    this.showEntry(log[this.i], this.i, true);
    this.i += 1;
    this.time.delayedCall(STEP_MS[this.speed()], () => this.play());
  }

  // 決まり方の動きの段（finishKind で選ぶ）。最後の形は速さによらず同じ（結果だけ＝各段の u=1 を順に置く）
  finishSteps() {
    const { winner, kimarite } = this.result;
    const W = winner;
    const L = other(W);
    const dir = W === 'east' ? 1 : -1;
    const v = this.view;
    const c0 = v.contact;
    const g0 = v.gap;
    const kind = finishKind(kimarite);
    const fall = this.meta(L, 'fall');
    const lyingOut = fall.h * this.sizes[L].sy * 0.25; // 見本：土俵の下へ落ちた絵は高さの 1/4 だけ下げる
    // 輪の中心から dx 先の触れ合う所。二人の絵（使う姿勢のいちばん広いもの）が世界の外へ出ない所に止める
    const edge = (dx, gap) => {
      const ext = (side, poses) => Math.max(...poses.map((p) => this.meta(side, p).w * this.sizes[side].sx)) + gap / 2 - OVERLAP;
      const win = ext(W, ['push', 'brace']);
      const lose = ext(L, ['back', 'stagger', 'topple', 'fall']);
      const x = WORLD.ringX + dir * dx;
      return W === 'east' ? clampContact(x, win, lose) : clampContact(x, lose, win);
    };
    const bob = (u, ms) => -4 * Math.abs(Math.sin(u * (ms / 1000) * Math.PI * 6)); // 一歩ごとに小さく上下（1秒に3歩）
    const setW = (pose, dy) => {
      v[W].pose = pose;
      v[W].dy = dy;
    };
    const setL = (pose, dy) => {
      v[L].pose = pose;
      v[L].dy = dy;
    };
    // 寄って押し込む（勝った側＝押す・負けた側＝後ずさり→よろける）。ズザザ！とすり足の音
    const advance = (ms, cEnd) => ({
      ms,
      fn: (u) => {
        v.contact = lerp(c0, cEnd, u);
        v.gap = lerp(g0, 0, u * 4);
        setW('push', u >= 1 ? 0 : bob(u, ms));
        setL(u < 0.6 ? 'back' : 'stagger', 0);
      },
      at: [[0.17, () => { this.word('zuzaza', 50 * dir, MS.word * 2); playBout('scrape'); }]],
    });
    // 倒れる：前半は落ちる途中（topple）・後半は倒れた（fall）。out＝土俵の下へ落ちる
    const topple = (ms, out, from, to, gapFrom, gapTo, sayDosun) => ({
      ms,
      fn: (u) => {
        v.contact = lerp(from, to, u);
        v.gap = lerp(gapFrom, gapTo, u);
        setW('brace', 0);
        if (u < 0.45) setL('topple', lerp(0, out ? 25 : 10, u / 0.45));
        else {
          const q = Math.pow((u - 0.45) / 0.55, 2);
          setL('fall', out ? lyingOut + lerp(25, 120, q) : lerp(10, 16, q));
        }
      },
      at: [[0.45, () => {
        if (sayDosun) this.word('dosun', 60 * dir, MS.word);
        playBout('thud');
      }]],
    });
    const wait = { ms: MS.banner, fn: () => {} };
    if (kind === 'pushout') {
      const cEnd = edge(290, 60);
      return [advance(MS.push, cEnd), topple(MS.fall, true, cEnd, cEnd, 0, 60, false), wait];
    }
    if (kind === 'pushdown') {
      const cEnd = edge(230, 40);
      return [advance(MS.pushdown, cEnd), topple(MS.fallDown, false, cEnd, cEnd, 0, 40, true), wait];
    }
    // ほかの決まり手：踏ん張る勝ちと倒れる負け。負けた側が俵の外にいれば（位置が勝った側の向きに100以上）土俵の下へ
    const out = Math.abs(this.lastPos) >= 100 && Math.sign(this.lastPos) === dir;
    const cEnd = out ? edge(290, 60) : c0;
    return [topple(MS.fall, out, c0, cEnd, g0, 60, true), wait];
  }

  // 組み絵の帯を出して、閉じたら done（絵が無い・読み込みが間に合わない・「結果だけ」の時はすぐ done）
  showKumi(file, done) {
    const key = file ? `kumi-${file}` : null;
    if (!key || !this.textures.exists(key) || this.speed() === 'result') { done(); return; }
    const { width } = this.scale;
    const shade = this.add.rectangle(width / 2, KUMI.y, width, KUMI.h + 40, 0x000000, 0.55).setDepth(50).setInteractive();
    const img = this.add.image(width + 400, KUMI.y, key).setDepth(51);
    img.setScale(Math.min((width - 40) / img.width, KUMI.h / img.height));
    const auraTween = this.kumi.aura ? addAura(this, img, this.kumi.aura) : null;
    playBout('kumi');
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this.kumiClose = null;
      this.tweens.killTweensOf(img);
      if (auraTween) auraTween.remove(); // 虹のオーラの回る tween は絵を消す前に止める
      shade.destroy();
      img.destroy();
      done();
    };
    this.kumiClose = close;
    this.tweens.add({ targets: img, x: width / 2, duration: 150, ease: 'Cubic.Out' });
    shade.once('pointerdown', close);
    this.time.delayedCall(KUMI.ms[this.speed()] || KUMI.ms.normal, close);
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.showKumi(this.kumi.finish, () => this.runSteps(this.finishSteps(), () => this.showResult(), this.speed() !== 'result'));
  }

  // 結果の札・一言・取組の順へ（前と同じ）
  showResult() {
    if (this.shown) return;
    this.shown = true;
    this.clearWords();
    const { winner, kimarite } = this.result;
    const side = this.names[winner];
    const { width } = this.scale;
    // 屋根や飾りの上でも読めるよう、字の下に濃い丸い台を敷く
    const back = this.add.graphics();
    back.fillStyle(COLORS.panel, 0.85);
    back.fillRoundedRect(this.cx - 330, BANNER.top, 660, BANNER.h, 24);
    fitText(this.add.text(this.cx, BANNER.win, t('bout.win', { side }), textStyle(72, COLORS.gold)).setOrigin(0.5), width - 60);
    fitText(this.add.text(this.cx, BANNER.kim, t('bout.kimarite', { tech: techLabel(kimarite) }), textStyle(46, COLORS.ink)).setOrigin(0.5), width - 60);
    this.comment();
    if (this.auto) {
      this.time.delayedCall(AUTO_SHOW_MS, () => this.scene.start('after')); // 自動：結果を見せて取組の後へ
      return;
    }
    button(this, this.cx, 1200, 460, 110, t('bout.toAfter'), () => this.scene.start('after'), { size: 38 });
  }

  // 結果の後の右下の一言：左に話す人の顔（娘か親方・親方は「親方」の札付き）、右に吹き出し。右から滑って出る
  comment() {
    const { winner, kimarite, log } = this.result;
    const c = boutComment({ ...this.commentIn, won: winner === 'east', log, kimarite, n: 1 });
    if (!c) return;
    // 動きの記録は決めの一合（最後の1行）だけにして、吹き出しの場所を空ける
    if (this.history.length > 1) {
      this.history = this.history.slice(-1);
      this.lines.setText(this.history[0]);
    }
    const name = (p) => ({
      stat: p.stat ? t(`stat.${p.stat}`) : undefined,
      scene: p.scene ? t(`scene.${p.scene}`) : undefined,
      mine: p.mine ? techLabel(p.mine) : undefined,
      theirs: p.theirs ? techLabel(p.theirs) : undefined,
      good: p.good ? techLabel(p.good) : undefined,
    });
    const str = c.keys.map((k) => t(k.key, name(k.params))).join('\n');
    const cy = COMMENT.top + COMMENT.h / 2;
    const bubbleLeft = COMMENT.left + COMMENT.face + 18;
    const objs = [
      ...speakerFace(this, c.who, COMMENT.left + COMMENT.face / 2, cy, COMMENT.face, 'normal'),
      ...speechBubble(this, bubbleLeft, COMMENT.top, COMMENT.right - bubbleLeft, COMMENT.h, str, { size: 24, min: 14 }),
    ];
    objs.forEach((o) => {
      const x = o.x;
      o.setAlpha(0).setX(x + 40);
      this.tweens.add({ targets: o, x, alpha: 1, duration: 260, ease: 'Cubic.Out' });
    });
  }

  cycleSpeed() {
    session.speed = SPEEDS[(SPEEDS.indexOf(session.speed) + 1) % SPEEDS.length];
    this.speedBtn.text.setText(this.speedLabel());
    this.speedBtn.text.setScale(1);
    fitText(this.speedBtn.text, 270 - 48);
    if (session.speed === 'result') {
      // 組み絵の帯が出ていれば閉じる（立ち合いの後なら play が、決まる直前なら結果への runSteps が続く）。閉じた後は done が立つので二重には進まない
      if (this.kumiClose) this.kumiClose();
      if (!this.done) {
        this.time.removeAllEvents();
        this.play();
      }
    }
  }
}
