// src/scenes/TrainingScene.js — 稽古（場所の前に6回）：上の真ん中に自分のしこ名・番付・部屋の名、残りの回数・疲れの目盛りと調子、心技体の棒、稽古7つの札（2列×4段・部屋の得意に「得意」の札）
// 右下（休みの札の右の空き）に親方か娘が出て助言する（trainingAdvice・描き直すたびに出し直す）
// 疲れ10で「番付を見る」を押すと休場の場所に入る（番付 → 取組の順は全部「休」→ 結果）
// 押すと train → 保存 → 効果音 → 描き直した上に稽古の絵と効き目の札と応援の1行（2.4秒で閉じる・応援が無い時は1.6秒・押せばすぐ閉じる）。0回になったら「番付を見る」→ 場所を始めて（保存）→ 番付
// 下の段の左「おまかせ稽古」（10/11 本人「自動モード」）：残りの稽古を親方の助言どおり（autoTrainingChoice）に1回ずつ・札は0.9秒で次へ。どこかを押すと今の1回の後で止まる
import { TRAININGS, FATIGUE_MAX, condition, trainingEffects } from '../core/career.js?v=57';
import { t, getLang, rankLabel, shikonaLabel } from '../i18n/i18n.js?v=57';
import { session, trainNow, beginBasho } from '../state.js?v=57';
import { HEYA, heyaOfGuide } from '../data/heya.js?v=57';
import { cheerKey, trainingAdvice } from '../core/cheer.js?v=57';
import {
  button, fitText, roundBox, hitZone, textStyle, statBars, preloadTypeArt, preloadTrainingIndex, loadTrainingArt, preloadWordsIndex, loadWordsArt, preloadVoiceIndex, loadVoice, preloadGuideArt, preloadOyakataArt,
  speakerFace, speechBubble, COLORS, CONDITION_COLOR, cssColor, clearScene, backButton, saveButton, TOP_LEFT_FREE,
} from '../ui/widgets.js?v=57';
import { playTraining } from '../ui/sfx.js?v=57';
import { autoTrainingChoice } from '../core/auto.js?v=57';
import { wordsFor, wordSpot, WORD_COLOR, wordArt, voiceSet, voiceKey } from '../data/words.js?v=57';

const BARS = { x: 40, y: 226, w: 640 }; // 心技体の棒（statBars の大きい版：行の高さ44・名前の幅96・数の幅46）
const CARD = { w: 310, h: 150, cols: [190, 530], top: 450, step: 170 };
const POP = { w: 560, artW: 420, artH: 300, ms: 1600, cheerMs: 2400, stepMs: 150, face: 110, rowH: 130, gap: 16 }; // 稽古の絵の札（応援の段＝顔110・高さ130）
const BUTTON_TOP = 1190 - 55; // 「番付を見る」の上の端（札はこれより上に収める）
const BOTTOM = { y: 1190, w: 320, h: 110, dx: 170 }; // 下の段の2つ（左＝おまかせ稽古・右＝番付を見る）。真ん中から左右へ dx
const AUTO_MS = 900; // おまかせの間の稽古の札の長さ（声と言葉は出す）
// 右下の助言：休みの札（左の列の4段目）の右の空き。札の右の列は x 375〜685・4段目は y 885〜1035
const ADVICE = { left: 384, right: 700, top: 885, h: 150, face: 96 };
const HEAD = { name: 50, rank: 98, heya: 128 }; // 上の真ん中の3行（しこ名・番付・部屋の名）の高さ
const WORD = { maxW: 260, maxH: 170, ms: 250, second: 250, voiceVolume: 0.9, sfxWithVoice: 0.6 }; // 効果文字（アニメの言葉）：幅300まで・ぽんと出る250ms・2つ目は250ms遅れ／声の音量・声がある時の効果音の倍率
const MINUS = '−'; // 減った値の印（全角でない長い横線）

export class TrainingScene extends Phaser.Scene {
  constructor() {
    super('training');
  }

  preload() {
    preloadTypeArt(this); // 稽古の絵がまだ無い時は自分のタイプの絵で代える
    preloadTrainingIndex(this);
    preloadWordsIndex(this);
    preloadVoiceIndex(this);
    preloadGuideArt(this); // 応援と助言の娘の顔
    preloadOyakataArt(this); // 応援と助言の親方の顔
  }

  create() {
    if (!session.career) {
      this.scene.start('guide');
      return;
    }
    this.popup = null;
    this.auto = null; // おまかせの最中は { stop }（どこかを押すと stop＝今の1回の後で止まる）
    this.hint = null;
    // 画面のどこを押しても、おまかせの最中なら止める（場面に1つだけ・描き直しでは増えない・場面を出る時に外す）
    const onDown = () => {
      if (this.auto) this.auto.stop = true;
    };
    this.input.on('pointerdown', onDown);
    this.events.once('shutdown', () => this.input.off('pointerdown', onDown));
    loadTrainingArt(this); // 本人の稽古の絵は後から届く（目録 assets/training/index.json にある物だけ）
    loadWordsArt(this, getLang()); // 効果文字の絵（assets/words・英語は assets/words/en）と稽古の声（assets/voice/<言葉>/<タイプ>）も同じ・目録にある物だけ
    loadVoice(this, getLang(), session.career.type);
    this.draw();
  }

  // pop＝{ kind, effects } を渡すと、描き直した上に稽古の絵の札を出す
  redraw(pop) {
    this.time.delayedCall(0, () => {
      this.draw();
      if (pop) this.showPopup(pop.kind, pop.effects, pop.auto);
    });
  }

  draw() {
    this.popup = null;
    this.hint = null; // 字は clearScene で消える
    this.tweens.killAll(); // 前の札の字の動きを消してから描き直す
    clearScene(this);
    const c = session.career;
    const { width } = this.scale;
    backButton(this, () => this.scene.start('guide')); // 初めの画面へ（つづきからで戻って来られる）
    saveButton(this); // 右上の「セーブ」（しこ名はその左の手前まで）
    // 10/11 本人「上の主人公の名前は真ん中に」：しこ名は「もどる」と「セーブ」の間の真ん中（掛かる長さなら縮める）・その下に番付と部屋の名
    const heya = heyaOfGuide(c.guide);
    fitText(this.add.text(width / 2, HEAD.name, shikonaLabel(c.name), textStyle(52, COLORS.gold)).setOrigin(0.5), width - 2 * TOP_LEFT_FREE);
    fitText(this.add.text(width / 2, HEAD.rank, rankLabel(c.pos), textStyle(28, COLORS.ink)).setOrigin(0.5), width - 80);
    if (heya) fitText(this.add.text(width / 2, HEAD.heya, t(`heya.${heya}.name`), textStyle(22, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), width - 80);
    fitText(this.add.text(40, 158, t('train.left', { n: c.trainingLeft }), textStyle(30, COLORS.gold)).setOrigin(0, 0.5), 130);
    this.fatigueGauge(c.fatigue, 180, 158, width - 40);
    fitText(this.add.text(40, 194, t('fatigue.note'), textStyle(20, COLORS.sub, { fontStyle: '500' })).setOrigin(0, 0.5), width - 80);
    statBars(this, BARS.x, BARS.y, BARS.w, c.stats);

    const special = heya ? HEYA[heya].specialty : null;
    TRAININGS.forEach((kind, i) => this.card(kind, CARD.cols[i % 2], CARD.top + Math.floor(i / 2) * CARD.step, c.trainingLeft > 0, kind === special));
    this.advisor();

    const done = c.trainingLeft === 0;
    button(this, width / 2 - BOTTOM.dx, BOTTOM.y, BOTTOM.w, BOTTOM.h, t('auto.train'), () => this.startAuto(), { size: 34, color: COLORS.buttonSub });
    button(this, width / 2 + BOTTOM.dx, BOTTOM.y, BOTTOM.w, BOTTOM.h, t('train.done'), () => {
      if (this.auto) return;
      if (session.career.trainingLeft > 0) {
        this.needMore(); // 押しても進まない理由を出す（本人「番付を見るから進まない」）
        return;
      }
      beginBasho(); // basho が無い時だけ始める
      this.scene.start('banzuke');
    }, { size: 38, color: done ? COLORS.button : COLORS.buttonSub });
  }

  // 疲れの目盛り（10の小さな四角・埋まった数＝疲れ・色は調子の帯）と、その右に調子の字。left〜right の中に収める
  // 10/11 本人「悪い基準が分からない。グラフにし、10まで行くとアウト場所に出れない」
  fatigueGauge(fatigue, left, cy, right) {
    const cond = condition(fatigue);
    const color = CONDITION_COLOR[cond.id];
    const label = fitText(this.add.text(left, cy, t('train.fatigue'), textStyle(26, COLORS.ink)).setOrigin(0, 0.5), 110);
    const SEG_W = 14;
    const SEG_H = 26;
    const SEG_STEP = 18;
    const x0 = left + label.displayWidth + 12;
    for (let i = 0; i < FATIGUE_MAX; i++) {
      roundBox(this, x0 + i * SEG_STEP + SEG_W / 2, cy, SEG_W, SEG_H, i < fatigue ? color : 0x2f3858, { radius: 4, shadow: false });
    }
    const cx = x0 + FATIGUE_MAX * SEG_STEP + 12;
    const word = t('cond.label', { c: t(`cond.${cond.id}`) });
    fitText(this.add.text(cx, cy, word, textStyle(26, cssColor(color))).setOrigin(0, 0.5), right - cx);
  }

  // 右下の助言（10/11 本人「画面右下に親方また女子が現れ、アドバイスをする」）：左に顔、右に吹き出し。描くたびに右から滑って出る
  advisor() {
    const a = trainingAdvice(session.career);
    if (!a) return;
    const params = a.params.stat ? { stat: t(`stat.${a.params.stat}`), train: t(`train.${a.params.train}`) } : {};
    const cy = ADVICE.top + ADVICE.h / 2;
    const bubbleLeft = ADVICE.left + ADVICE.face + 14;
    const objs = [
      // 親方の顔：稽古を使い切った時（番付を見ろ）は笑顔・ほかは普通
      ...speakerFace(this, a.who, ADVICE.left + ADVICE.face / 2, cy, ADVICE.face, a.key.endsWith('.done') ? 'smile' : 'normal'),
      ...speechBubble(this, bubbleLeft, ADVICE.top, ADVICE.right - bubbleLeft, ADVICE.h, t(a.key, params), { size: 22, min: 14 }),
    ];
    objs.forEach((o) => {
      const x = o.x;
      o.setAlpha(0).setX(x + 40);
      this.tweens.add({ targets: o, x, alpha: 1, duration: 260, ease: 'Cubic.Out' });
    });
  }

  // 稽古が残っている時に「番付を見る」を押したら、ボタンの上に理由を出して少し揺らす
  needMore() {
    this.showHint(t('hint.trainFirst', { n: session.career.trainingLeft }));
  }

  // 下の段のボタンの上の1行（金・少し揺れる）。もう一度出したら前の行は消す
  showHint(text) {
    this.hint?.destroy();
    const { width } = this.scale;
    this.hint = fitText(this.add.text(width / 2, 1100, text, textStyle(30, COLORS.gold, { align: 'center' })).setOrigin(0.5), width - 60);
    this.tweens.add({ targets: this.hint, x: { from: width / 2 - 12, to: width / 2 }, duration: 300, ease: 'Bounce.Out' });
  }

  // 「おまかせ稽古」：残りが無ければ理由を出す・あれば1回目から
  startAuto() {
    if (this.auto) return;
    if (session.career.trainingLeft <= 0) {
      this.showHint(t('auto.trainDone'));
      return;
    }
    this.auto = { stop: false };
    this.autoStep();
  }

  // おまかせの1回：選ぶ → train → 保存 → 効果音 → 短い札。札が閉じたら closePopup がまたここへ来る
  autoStep() {
    if (!this.auto) return;
    const kind = autoTrainingChoice(session.career);
    if (!kind || this.auto.stop) {
      const stopped = this.auto.stop && kind !== null;
      this.auto = null;
      if (stopped) this.showHint(t('auto.trainStopped'));
      return;
    }
    this.doTrain(kind, true);
  }

  // 稽古を1回（札を押した時とおまかせで同じ）
  doTrain(kind, auto) {
    const before = session.career;
    const after = trainNow(kind);
    playTraining(kind, this.hasVoice(kind) ? WORD.sfxWithVoice : 1); // 声が付く稽古は効果音を下げて声を聞こえやすく
    this.redraw({ kind, effects: trainingEffects(before, after), auto });
  }

  // 稽古の札：名前と効き目の2行。回数が残っていない時は薄く、押しても何もしない
  // special＝入門した部屋の得意の稽古（右上の角に金の小札「得意」・札の上の縁にまたがる）
  card(kind, x, y, open, special) {
    const gfx = roundBox(this, x, y, CARD.w, CARD.h, COLORS.panel, { radius: 28, stroke: COLORS.frame });
    const name = fitText(this.add.text(x, y - 24, t(`train.${kind}`), textStyle(34, COLORS.ink)).setOrigin(0.5), CARD.w - 30);
    const desc = fitText(this.add.text(x, y + 30, t(`train.${kind}.desc`), textStyle(24, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), CARD.w - 30);
    const parts = [gfx, name, desc];
    if (special) {
      const tag = fitText(this.add.text(0, y - CARD.h / 2, t('heya.tag'), textStyle(20, COLORS.bg)).setOrigin(0.5), 120);
      const tw = tag.displayWidth + 24;
      const tx = x + CARD.w / 2 - 16 - tw / 2;
      tag.setX(tx);
      parts.push(roundBox(this, tx, y - CARD.h / 2, tw, 32, COLORS.frame, { radius: 16, shadow: false }), tag);
      tag.setDepth(1);
    }
    if (!open) {
      parts.forEach((p) => p.setAlpha(0.4));
      return;
    }
    const zone = hitZone(this, x, y, CARD.w, CARD.h);
    let down = false;
    zone.on('pointerdown', () => {
      down = true;
      gfx.setAlpha(0.8);
    });
    zone.on('pointerout', () => {
      down = false;
      gfx.setAlpha(1);
    });
    zone.on('pointerup', () => {
      gfx.setAlpha(1);
      if (!down || this.auto || session.career.trainingLeft <= 0) return; // おまかせの最中は札を押しても稽古しない（二重の稽古を防ぐ）
      down = false;
      this.doTrain(kind, false);
    });
  }

  // 稽古の絵の札（10/11 本人「各ボタンを押すと、イラストが表示される。休みは寝ている姿。イラスト表示中に疲れ-1などの教示」）
  // 暗幕は画面全体の押し当たり＝開いている間、下の札とボタンは反応しない。どこかを押すか 1.6 秒で閉じて描き直す
  // auto＝おまかせの1回（AUTO_MS で閉じる）
  showPopup(kind, effects, auto = false) {
    const { width, height } = this.scale;
    const D = 1000;
    const objs = [];
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.65).setOrigin(0).setDepth(D).setInteractive();
    objs.push(overlay);

    const lines = this.effectLines(effects);
    const LINE_H = 46;
    const PAD = 30;
    // 応援の1行（10/11 本人「女子は、ちゃんこと休みの際に応援。親方はそれ以外の稽古で応援」）。文は稽古の回数の奇数・偶数で交互
    const cheer = cheerKey(session.career.guide, kind, 6 - session.career.trainingLeft);
    const h = PAD + POP.artH + 16 + 50 + 14 + lines.length * LINE_H + (cheer ? POP.gap + POP.rowH : 0) + PAD;
    // 真ん中に置き、「番付を見る」に掛かるなら上へずらす（画面の上からははみ出さない）
    const top = Math.max(16, Math.min(Math.round((height - h) / 2), BUTTON_TOP - 16 - h));
    const cx = width / 2;
    objs.push(roundBox(this, cx, top + h / 2, POP.w, h, COLORS.panel, { radius: 30, stroke: COLORS.frame }).setDepth(D + 1));

    // 絵：本人の稽古の絵（あれば）・無ければ自分のタイプの絵（休みは横に寝かせる）
    const artY = top + PAD + POP.artH / 2;
    const own = `train-${kind}`;
    const key = this.textures.exists(own) ? own : `type-${session.career.type}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(cx, artY, key).setDepth(D + 2);
      const lying = key !== own && kind === 'rest';
      if (lying) img.setAngle(-90);
      const w = lying ? img.height : img.width;
      const hh = lying ? img.width : img.height;
      img.setScale(Math.min(POP.artW / w, POP.artH / hh));
      objs.push(img);
    }

    let y = top + PAD + POP.artH + 16 + 25;
    objs.push(fitText(this.add.text(cx, y, t(`train.${kind}`), textStyle(42, COLORS.gold)).setOrigin(0.5).setDepth(D + 2), POP.w - 60));
    y += 25 + 14 + LINE_H / 2;
    lines.forEach(([str, color], i) => {
      const txt = fitText(this.add.text(cx, y + i * LINE_H, str, textStyle(34, color)).setOrigin(0.5).setDepth(D + 2), POP.w - 60);
      const full = txt.scaleX;
      txt.setAlpha(0).setScale(full * 0.6);
      // 1行ずつ、少し遅れてぽんと出る
      this.tweens.add({ targets: txt, alpha: 1, scale: full, delay: i * POP.stepMs, duration: 180, ease: 'Back.Out' });
      objs.push(txt);
    });

    if (cheer) {
      // 効き目の行の下：左に話す人の顔（娘か親方）、右に吹き出し。効き目の行が出そろってから出る
      const rowTop = y + (lines.length - 1) * LINE_H + LINE_H / 2 + POP.gap;
      const left = cx - POP.w / 2 + PAD;
      const bubbleLeft = left + POP.face + 22;
      const row = [
        ...speakerFace(this, cheer.who, left + POP.face / 2, rowTop + POP.rowH / 2, POP.face, 'shout'), // 親方は声を張る顔
        ...speechBubble(this, bubbleLeft, rowTop, cx + POP.w / 2 - PAD - bubbleLeft, POP.rowH, t(cheer.key), { size: 24, min: 14 }),
      ];
      row.forEach((o) => {
        o.setDepth(D + 2).setAlpha(0);
        this.tweens.add({ targets: o, alpha: 1, delay: lines.length * POP.stepMs, duration: 200 });
      });
      objs.push(...row);
    }

    this.showWords(kind, cx, artY, D + 3, objs);
    this.playVoice(kind);

    const timer = this.time.delayedCall(auto ? AUTO_MS : (cheer ? POP.cheerMs : POP.ms), () => this.closePopup());
    // 押した瞬間に閉じる（離しは描き直した札に当たるが、札は押しがその札で始まった時だけ効く）
    overlay.on('pointerdown', () => this.time.delayedCall(0, () => this.closePopup()));
    this.popup = { objs, timer };
  }

  // いまの言葉とタイプで使う声の音の鍵（組が無い・まだ読めていない時は null）
  voiceKeyFor(kind) {
    const set = voiceSet(this.cache.json.get('voice-index'), getLang(), session.career.type);
    if (!set) return null;
    const key = voiceKey(set, kind);
    return this.cache.audio.exists(key) ? key : null;
  }

  hasVoice(kind) {
    return this.voiceKeyFor(kind) !== null;
  }

  // 稽古の声（assets/voice/train_<kind>.mp3）。読めていれば鳴らす・無ければ今まで通り（効果音だけ）。鳴らせなくても遊びは続ける
  playVoice(kind) {
    try {
      if (this.voice) this.voice.stop();
      this.voice = null;
      const key = this.voiceKeyFor(kind);
      if (!key) return;
      this.voice = this.sound.add(key, { volume: WORD.voiceVolume });
      this.voice.play();
    } catch {
      this.voice = null;
    }
  }

  // 絵の上のほうに効果文字（アニメの言葉）をぽんと出す。絵（assets/words）があれば絵・無ければ太い字で代える。札が閉じるまで残る
  // 置き場は稽古ごとに決まっている（wordSpot）・2つ目は少し遅れて反対側に出る。回転 −8°〜+8°・拡大 0.3→1 を Back.Out で
  showWords(kind, cx, artY, depth, objs) {
    wordsFor(kind).forEach((id, i) => {
      const spot = wordSpot(kind, i);
      const x = cx + spot.dx * POP.artW;
      const y = artY + spot.dy * POP.artH;
      const art = wordArt(getLang(), id, this.cache.json.get('word-index'), this.cache.json.get('word-en-index'));
      let obj;
      if (art && this.textures.exists(art.key)) {
        obj = this.add.image(x, y, art.key);
        obj.setScale(Math.min(WORD.maxW / obj.width, WORD.maxH / obj.height));
      } else {
        obj = fitText(this.add.text(x, y, t(`word.${id}`), textStyle(56, WORD_COLOR[id], { stroke: '#1a1020', strokeThickness: 10 })).setOrigin(0.5), WORD.maxW);
      }
      const full = obj.scaleX;
      obj.setDepth(depth).setAngle(spot.rot).setAlpha(0).setScale(full * 0.3);
      this.tweens.add({ targets: obj, alpha: 1, scale: full, delay: i * WORD.second, duration: WORD.ms, ease: 'Back.Out' });
      objs.push(obj);
    });
  }

  closePopup() {
    if (!this.popup) return;
    this.popup.timer.remove(false);
    this.popup = null;
    this.draw();
    if (this.auto) this.autoStep(); // おまかせの続き（止められていれば、ここで止めて理由を出す）
  }

  // 効き目の行 [文, 色]：伸びは金・疲れが増えたら今の調子の色・減ったら緑・調子が変わったら新しい調子の色
  effectLines(effects) {
    if (!effects.length) return [[t('train.none'), COLORS.sub]];
    const after = condition(session.career.fatigue).id;
    const num = (d) => (d > 0 ? `+${d}` : `${MINUS}${Math.abs(d)}`);
    return effects.map((e) => {
      if (e.key === 'condition') {
        return [t('cond.change', { from: t(`cond.${e.from}`), to: t(`cond.${e.to}`) }), cssColor(CONDITION_COLOR[e.to])];
      }
      if (e.key === 'fatigue') {
        const color = e.delta > 0 ? CONDITION_COLOR[after] : CONDITION_COLOR.good;
        return [t('train.effect', { stat: t('train.fatigue'), n: num(e.delta) }), cssColor(color)];
      }
      return [t('train.effect', { stat: t(`stat.${e.key}`), n: num(e.delta) }), COLORS.gold];
    });
  }
}
