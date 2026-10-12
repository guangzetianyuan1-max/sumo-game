// src/scenes/LadderScene.js — 勝ち抜き番付（10/12 夜）：主人公の絵と名・地位・倒した数の目盛り・次の昇進・心技体・次の相手 → 相手の情報
// 覚える候補があれば技の画面へ・稽古の途中なら稽古へ（つづきからと同じ）
import { t, heroName, foeLabel } from '../i18n/i18n.js?v=30';
import { session } from '../state.js?v=30';
import { rankOf, nextRank, CLEAR_AT } from '../core/ladder.js?v=30';
import { currentFoe } from '../core/run.js?v=30';
import { button, backButton, saveButton, topTitle, fitText, roundBox, textStyle, statBars, preloadTypeArt, preloadHeroFigures, heroKey, COLORS } from '../ui/widgets.js?v=30';

const BAR = { x: 60, y: 520, w: 600, h: 34 };

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
    if (r.pendingLearn) { this.scene.start('learn'); return; }
    if (r.training) { this.scene.start('training'); return; }
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

    if (r.cleared) {
      fitText(this.add.text(width / 2, 960, t('ladder.clear'), textStyle(40, COLORS.gold)).setOrigin(0.5), width - 60);
      button(this, width / 2, 1190, 460, 110, t('ladder.toTop'), () => this.scene.start('guide'), { size: 38 });
      return;
    }
    const foe = currentFoe(r);
    fitText(this.add.text(width / 2, 960, t('ladder.nextFoe', { name: foeLabel(foe), n: foe.index + 1 }), textStyle(32, COLORS.ink)).setOrigin(0.5), width - 60);
    button(this, width / 2, 1190, 460, 110, t('ladder.go'), () => this.scene.start('opponent'), { size: 38 });
  }
}
