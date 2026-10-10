// src/scenes/TrainingScene.js — 稽古（場所の前に6回）：上に自分のしこ名・番付・残りの回数・疲れの目盛りと調子、心技体の棒、稽古7つの札（2列×4段）
// 疲れ10で「番付を見る」を押すと休場の場所に入る（番付 → 取組の順は全部「休」→ 結果）
// 押すと train → 保存 → 効果音 → 描き直した上に稽古の絵と効き目の札（1.6秒で閉じる・押せばすぐ閉じる）。0回になったら「番付を見る」→ 場所を始めて（保存）→ 番付
import { TRAININGS, FATIGUE_MAX, condition, trainingEffects } from '../core/career.js?v=13';
import { t, rankLabel, shikonaLabel } from '../i18n/i18n.js?v=13';
import { session, trainNow, beginBasho } from '../state.js?v=13';
import { button, fitText, roundBox, hitZone, textStyle, statBars, preloadTypeArt, preloadTrainingIndex, loadTrainingArt, COLORS, CONDITION_COLOR, cssColor, clearScene, backButton, saveButton, TOP_LEFT_FREE, TOP_RIGHT_FREE } from '../ui/widgets.js?v=13';
import { playTraining } from '../ui/sfx.js?v=13';

const BARS = { x: 40, y: 226, w: 640 }; // 心技体の棒（statBars の大きい版：行の高さ44・名前の幅96・数の幅46）
const CARD = { w: 310, h: 150, cols: [190, 530], top: 450, step: 170 };
const POP = { w: 560, artW: 420, artH: 300, ms: 1600, stepMs: 150 }; // 稽古の絵の札
const MINUS = '−'; // 減った値の印（全角でない長い横線）

export class TrainingScene extends Phaser.Scene {
  constructor() {
    super('training');
  }

  preload() {
    preloadTypeArt(this); // 稽古の絵がまだ無い時は自分のタイプの絵で代える
    preloadTrainingIndex(this);
  }

  create() {
    if (!session.career) {
      this.scene.start('guide');
      return;
    }
    this.popup = null;
    loadTrainingArt(this); // 本人の稽古の絵は後から届く（目録 assets/training/index.json にある物だけ）
    this.draw();
  }

  // pop＝{ kind, effects } を渡すと、描き直した上に稽古の絵の札を出す
  redraw(pop) {
    this.time.delayedCall(0, () => {
      this.draw();
      if (pop) this.showPopup(pop.kind, pop.effects);
    });
  }

  draw() {
    this.popup = null;
    this.tweens.killAll(); // 前の札の字の動きを消してから描き直す
    clearScene(this);
    const c = session.career;
    const { width } = this.scale;
    backButton(this, () => this.scene.start('guide')); // 初めの画面へ（つづきからで戻って来られる）
    saveButton(this); // 右上の「セーブ」（しこ名はその左の手前まで）
    fitText(this.add.text(TOP_LEFT_FREE, 56, shikonaLabel(c.name), textStyle(52, COLORS.gold)).setOrigin(0, 0.5), width - TOP_RIGHT_FREE - TOP_LEFT_FREE);
    fitText(this.add.text(40, 112, rankLabel(c.pos), textStyle(30, COLORS.ink)).setOrigin(0, 0.5), width - 80);
    fitText(this.add.text(40, 158, t('train.left', { n: c.trainingLeft }), textStyle(30, COLORS.gold)).setOrigin(0, 0.5), 130);
    this.fatigueGauge(c.fatigue, 180, 158, width - 40);
    fitText(this.add.text(40, 194, t('fatigue.note'), textStyle(20, COLORS.sub, { fontStyle: '500' })).setOrigin(0, 0.5), width - 80);
    statBars(this, BARS.x, BARS.y, BARS.w, c.stats);

    TRAININGS.forEach((kind, i) => this.card(kind, CARD.cols[i % 2], CARD.top + Math.floor(i / 2) * CARD.step, c.trainingLeft > 0));

    const done = c.trainingLeft === 0;
    button(this, width / 2, 1190, 460, 110, t('train.done'), () => {
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

  // 稽古が残っている時に「番付を見る」を押したら、ボタンの上に理由を出して少し揺らす
  needMore() {
    this.hint?.destroy();
    const { width } = this.scale;
    this.hint = fitText(this.add.text(width / 2, 1100, t('hint.trainFirst', { n: session.career.trainingLeft }), textStyle(30, COLORS.gold, { align: 'center' })).setOrigin(0.5), width - 60);
    this.tweens.add({ targets: this.hint, x: { from: width / 2 - 12, to: width / 2 }, duration: 300, ease: 'Bounce.Out' });
  }

  // 稽古の札：名前と効き目の2行。回数が残っていない時は薄く、押しても何もしない
  card(kind, x, y, open) {
    const gfx = roundBox(this, x, y, CARD.w, CARD.h, COLORS.panel, { radius: 28, stroke: COLORS.frame });
    const name = fitText(this.add.text(x, y - 24, t(`train.${kind}`), textStyle(34, COLORS.ink)).setOrigin(0.5), CARD.w - 30);
    const desc = fitText(this.add.text(x, y + 30, t(`train.${kind}.desc`), textStyle(24, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), CARD.w - 30);
    if (!open) {
      [gfx, name, desc].forEach((p) => p.setAlpha(0.4));
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
      if (!down || session.career.trainingLeft <= 0) return;
      down = false;
      const before = session.career;
      const after = trainNow(kind);
      playTraining(kind);
      this.redraw({ kind, effects: trainingEffects(before, after) });
    });
  }

  // 稽古の絵の札（10/11 本人「各ボタンを押すと、イラストが表示される。休みは寝ている姿。イラスト表示中に疲れ-1などの教示」）
  // 暗幕は画面全体の押し当たり＝開いている間、下の札とボタンは反応しない。どこかを押すか 1.6 秒で閉じて描き直す
  showPopup(kind, effects) {
    const { width, height } = this.scale;
    const D = 1000;
    const objs = [];
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.65).setOrigin(0).setDepth(D).setInteractive();
    objs.push(overlay);

    const lines = this.effectLines(effects);
    const LINE_H = 46;
    const PAD = 30;
    const h = PAD + POP.artH + 16 + 50 + 14 + lines.length * LINE_H + PAD;
    const top = Math.round((height - h) / 2);
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

    const timer = this.time.delayedCall(POP.ms, () => this.closePopup());
    // 押した瞬間に閉じる（離しは描き直した札に当たるが、札は押しがその札で始まった時だけ効く）
    overlay.on('pointerdown', () => this.time.delayedCall(0, () => this.closePopup()));
    this.popup = { objs, timer };
  }

  closePopup() {
    if (!this.popup) return;
    this.popup.timer.remove(false);
    this.popup = null;
    this.draw();
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
