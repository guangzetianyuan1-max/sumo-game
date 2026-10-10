// src/scenes/OpponentScene.js — 今日の相手の情報（タイプの絵・得意・弱み・よく使う手）。作戦表の前に見せる
import { TYPES } from '../data/types.js?v=5';
import { defaultStrategy, SCENES } from '../core/strategy.js?v=5';
import { t, techLabel } from '../i18n/i18n.js?v=5';
import { session } from '../state.js?v=5';
import { button, fitText, roundBox, textStyle, preloadTypeArt, COLORS } from '../ui/widgets.js?v=5';

const ART_H = 420;

export class OpponentScene extends Phaser.Scene {
  constructor() {
    super('opponent');
  }

  preload() {
    preloadTypeArt(this);
  }

  create() {
    const { width } = this.scale;
    const opp = session.opp;
    // 相手の作戦表はここで組み、作戦表の画面と取組で同じものを使う
    session.oppStrategy ??= defaultStrategy(TYPES[opp].sample, opp);

    fitText(this.add.text(width / 2, 75, t('opp.title'), textStyle(60, COLORS.gold)).setOrigin(0.5), width - 80);
    roundBox(this, width / 2, 500, 640, 560, COLORS.panel, { radius: 36, stroke: COLORS.frame });
    this.add.circle(width / 2, 500, 215, 0x2a3456);
    const key = `type-${opp}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(width / 2, 500, key);
      img.setScale(ART_H / img.height);
      img.setFlipX(true); // 自分のほうを向く
    }

    const line = (y, str, size, color, extra) => fitText(this.add.text(width / 2, y, str, textStyle(size, color, extra)).setOrigin(0.5), width - 80);
    line(850, t(`type.${opp}.name`), 56, COLORS.ink);
    line(920, t('opp.strong', { x: t(`type.${opp}.strong`) }), 30, COLORS.ink, { fontStyle: '500' });
    line(966, t('strat.oppWeak', { weak: t(`type.${opp}.weak`) }), 30, COLORS.sub, { fontStyle: '500' });
    line(1030, t('opp.moves', { moves: this.favourites().map((id) => techLabel(id)).join(' / ') }), 30, COLORS.gold, { fontStyle: '500' });

    button(this, width / 2, 1190, 460, 110, t('opp.go'), () => this.scene.start('strategy'), { size: 38 });
  }

  // 相手の作戦表を 立ち合い → 中 → 土俵際 の順に見て、重ならない手を3つ
  favourites() {
    const out = [];
    for (const sc of SCENES) {
      for (const id of session.oppStrategy[sc]) {
        if (id && !out.includes(id)) out.push(id);
        if (out.length === 3) return out;
      }
    }
    return out;
  }
}
