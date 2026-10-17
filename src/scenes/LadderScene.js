// src/scenes/LadderScene.js — 勝ち抜き番付（10/12 夜）：主人公の絵と名・地位・倒した数の目盛り・次の昇進・心技体・次の相手 → 相手の情報
// 負けた後の稽古の途中なら稽古へ（つづきからと同じ）。下に「稽古する」：いつでも何度でも自分から稽古に入れる（10/13 本人「好きなときに稽古が出来るように」）
import { t, heroName, foeLabel } from '../i18n/i18n.js?v=59';
import { session, trainFreeBegin, trainLeaveNow } from '../state.js?v=59';
import { rankOf, nextRank, CLEAR_AT } from '../core/ladder.js?v=59';
import { currentFoe, canLeaveTraining } from '../core/run.js?v=59';
import { preloadBackdrop, drawBackdrop, inkPanel } from '../ui/backdrop.js?v=59';
import { menuBgKey } from '../core/bgkey.js?v=59';
import { button, backButton, saveButton, topTitle, fitText, roundBox, textStyle, statBars, preloadTypeArt, preloadHeroFigures, heroKey, COLORS } from '../ui/widgets.js?v=59';

const BAR = { x: 60, y: 520, w: 600, h: 34 };
const HELP_Y = 1062; // 「遊び方」（次の相手の行 960 と、大きなボタン 1135〜 の間）
const TRAIN_COLOR = 0x4f8a68; // 「稽古する」のボタン（緑・次の相手へ の朱と並べて見分ける）
const PANEL = { x: 24, w: 672 }; // 字の後ろの墨の板（画面のふちの枠 14 の内側）
const BAND = 104; // 見出しの帯の下の端（主人公の札の上 145 より上）
// 背景＝その時の場所（今の相手の場所・クリアした後は土俵）
const bgKey = (r) => menuBgKey('ladder', { foeIndex: r && !r.cleared ? currentFoe(r).index : null, cleared: !!(r && r.cleared) });

export class LadderScene extends Phaser.Scene {
  constructor() {
    super('ladder');
  }

  preload() {
    preloadTypeArt(this);
    preloadHeroFigures(this);
    if (session.run) preloadBackdrop(this, bgKey(session.run));
  }

  create() {
    const r = session.run;
    if (!r) { this.scene.start('guide'); return; }
    // 負けた後の稽古は終えるまで抜けない。自分から入った稽古（voluntary）の途中は番付に居てよい（稽古するで続き・次の相手へで捨てる）
    if (r.training && !canLeaveTraining(r)) { this.scene.start('training'); return; }
    const { width } = this.scale;
    drawBackdrop(this, bgKey(r), { band: BAND });
    backButton(this, () => this.scene.start('guide'));
    saveButton(this);
    topTitle(this, 52, t('ladder.title'), 52, COLORS.gold, { save: true });

    // 主人公の札：左に絵・右に名と地位
    inkPanel(this, 40, 145, 640, 250, { radius: 32 }); // 墨の板（後ろの場所の絵が少し透ける・字の明るさの比は板が受け持つ）
    const key = heroKey(this, r.type);
    if (this.textures.exists(key)) {
      const img = this.add.image(170, 270, key);
      img.setScale(210 / img.height);
    }
    fitText(this.add.text(300, 220, heroName(r.type), textStyle(52, COLORS.ink)).setOrigin(0, 0.5), 380);
    fitText(this.add.text(300, 300, t(`div.${rankOf(r.wins)}`), textStyle(44, COLORS.gold)).setOrigin(0, 0.5), 380);

    // 倒した数の目盛り
    fitText(this.add.text(width / 2, 470, t('ladder.count', { n: r.wins }), textStyle(32, COLORS.ink)).setOrigin(0.5), width - 60);
    roundBox(this, BAR.x + BAR.w / 2, BAR.y, BAR.w, BAR.h, COLORS.empty, { radius: 16, shadow: false });
    const fill = Math.max(0, Math.round(BAR.w * r.wins / CLEAR_AT));
    if (fill > 0) this.add.rectangle(BAR.x + fill / 2, BAR.y, fill, BAR.h - 8, 0xe3b23c);
    const nr = nextRank(r.wins);
    const nextLine = r.cleared ? '' : nr ? t('ladder.next', { n: nr.at - r.wins, rank: t(`div.${nr.id}`) }) : t('ladder.toClear', { n: CLEAR_AT - r.wins });
    if (nextLine) fitText(this.add.text(width / 2, 578, nextLine, textStyle(28, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5), width - 60);

    statBars(this, 40, 640, 640, r.stats);
    inkPanel(this, PANEL.x, 436, PANEL.w, 354); // 倒した数・目盛り・次の昇進・心技体（436〜790）
    inkPanel(this, PANEL.x, 922, PANEL.w, 76); // 次の相手（またはクリア）の行

    // 左下に小さく「遊び方」（説明を飛ばした人も、いつでも同じ3枚に入れる）・その右に「コレクション」（10/17 本人「倒した敵はコレクションとして見れるように」）
    button(this, 150, HELP_Y, 240, 72, t('ladder.help'), () => this.scene.start('help'), { size: 28, color: COLORS.buttonSub });
    button(this, 490, HELP_Y, 340, 72, t('ladder.collection'), () => this.scene.start('collection', { then: 'ladder' }), { size: 28, color: COLORS.buttonSub });

    if (r.cleared) {
      fitText(this.add.text(width / 2, 960, t('ladder.clear'), textStyle(40, COLORS.gold)).setOrigin(0.5), width - 60);
      // クリアの画面をもう一度見る（左）・はじめの画面へ（右）。上の段に3つ並べると字が 28 より小さく縮んだ（10/17）
      button(this, width / 2 - 170, 1190, 320, 110, t('ladder.seeClear'), () => this.scene.start('clear'), { size: 36, color: TRAIN_COLOR });
      button(this, width / 2 + 170, 1190, 320, 110, t('ladder.toTop'), () => this.scene.start('guide'), { size: 36 });
      return;
    }
    const foe = currentFoe(r);
    fitText(this.add.text(width / 2, 960, t('ladder.nextFoe', { name: foeLabel(foe), n: foe.index + 1 }), textStyle(32, COLORS.ink)).setOrigin(0.5), width - 60);
    // 左に「稽古する」（いつでも・何度でも）・右に「次の相手へ」。自分から入った稽古の途中で相手へ行くなら、残りのコマは捨てる
    button(this, width / 2 - 170, 1190, 320, 110, t('ladder.train'), () => {
      trainFreeBegin();
      this.scene.start('training');
    }, { size: 38, color: TRAIN_COLOR });
    button(this, width / 2 + 170, 1190, 320, 110, t('ladder.go'), () => {
      trainLeaveNow();
      this.scene.start('opponent');
    }, { size: 36 });
  }
}
