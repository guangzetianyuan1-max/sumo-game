// src/scenes/LadderScene.js — 勝ち抜き番付（10/12 夜）：主人公の絵と名・地位・倒した数の目盛り・次の昇進・心技体・次の相手 → 相手の情報
// 負けた後の稽古の途中なら稽古へ（つづきからと同じ）。下に「稽古する」：いつでも何度でも自分から稽古に入れる（10/13 本人「好きなときに稽古が出来るように」）
import { t, heroName, foeLabel } from '../i18n/i18n.js?v=34';
import { session, trainFreeBegin, trainLeaveNow } from '../state.js?v=34';
import { rankOf, nextRank, CLEAR_AT } from '../core/ladder.js?v=34';
import { currentFoe, canLeaveTraining } from '../core/run.js?v=34';
import { button, backButton, saveButton, topTitle, fitText, roundBox, textStyle, statBars, preloadTypeArt, preloadHeroFigures, heroKey, COLORS } from '../ui/widgets.js?v=34';

const BAR = { x: 60, y: 520, w: 600, h: 34 };
const HELP_Y = 1062; // 「遊び方」（次の相手の行 960 と、大きなボタン 1135〜 の間）
const TRAIN_COLOR = 0x4f8a68; // 「稽古する」のボタン（緑・次の相手へ の朱と並べて見分ける）

export class LadderScene extends Phaser.Scene {
  constructor() {
    super('ladder');
  }

  preload() {
    preloadTypeArt(this);
    preloadHeroFigures(this);
  }

  create() {
    const r = session.run;
    if (!r) { this.scene.start('guide'); return; }
    // 負けた後の稽古は終えるまで抜けない。自分から入った稽古（voluntary）の途中は番付に居てよい（稽古するで続き・次の相手へで捨てる）
    if (r.training && !canLeaveTraining(r)) { this.scene.start('training'); return; }
    const { width } = this.scale;
    backButton(this, () => this.scene.start('guide'));
    saveButton(this);
    topTitle(this, 52, t('ladder.title'), 52, COLORS.gold, { save: true });

    // 主人公の札：左に絵・右に名と地位
    roundBox(this, width / 2, 270, 640, 250, COLORS.panel, { radius: 32, stroke: COLORS.frame });
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

    // 左下に小さく「遊び方」（説明を飛ばした人も、いつでも同じ3枚に入れる）
    button(this, 140, HELP_Y, 220, 64, t('ladder.help'), () => this.scene.start('help'), { size: 26, color: COLORS.buttonSub });

    if (r.cleared) {
      fitText(this.add.text(width / 2, 960, t('ladder.clear'), textStyle(40, COLORS.gold)).setOrigin(0.5), width - 60);
      // クリアの画面をもう一度見る（「遊び方」の右・同じ高さ）
      button(this, 470, HELP_Y, 340, 64, t('ladder.seeClear'), () => this.scene.start('clear'), { size: 26 });
      button(this, width / 2, 1190, 460, 110, t('ladder.toTop'), () => this.scene.start('guide'), { size: 38 });
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
