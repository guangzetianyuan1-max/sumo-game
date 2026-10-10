// src/scenes/SetupScene.js — 入門：育てる自分のタイプを1つ選ぶ（相手は取組ごとに引く・入門の長い画面は第3段）
import { TYPE_IDS } from '../data/types.js?v=3';
import { t, getLang, setLang } from '../i18n/i18n.js?v=3';
import { session, nextOpponent } from '../state.js?v=3';
import { button, fitText, roundBox, hitZone, textStyle, COLORS, storage } from '../ui/widgets.js?v=3';

export class SetupScene extends Phaser.Scene {
  constructor() {
    super('setup');
  }

  preload() {
    TYPE_IDS.forEach((id) => this.load.image(`type-${id}`, `assets/types/${id}.png`));
  }

  create() {
    const { width } = this.scale;
    fitText(this.add.text(40, 55, t('title'), textStyle(60, COLORS.gold)).setOrigin(0, 0.5), width - 280);
    button(this, width - 105, 55, 170, 70, t('lang.toggle'), () => {
      setLang(getLang() === 'ja' ? 'en' : 'ja', storage());
      document.documentElement.lang = getLang();
      this.scene.restart();
    }, { size: 28, color: COLORS.buttonSub });
    this.add.text(40, 120, t('setup.you'), textStyle(40, COLORS.ink));
    TYPE_IDS.forEach((id, i) => this.card(id, 270 + i * 170));
    button(this, width / 2, 1190, 460, 110, t('setup.start'), () => {
      // 自分のタイプを変えたときだけ自分の作戦表を見本から組み直す。相手は取組ごとに引く
      if (!session.planFor || session.planFor.you !== session.you) session.strategy = null;
      session.planFor = { you: session.you };
      nextOpponent();
      this.scene.start('strategy');
    }, { size: 38 });
  }

  // 名前・得意・弱みの3行の札
  card(id, y) {
    const { width } = this.scale;
    const x = width / 2;
    const on = session.you === id;
    const gfx = roundBox(this, x, y, 640, 150, on ? COLORS.panelOn : COLORS.panel, { radius: 28, stroke: COLORS.frame });
    // 左に力士の絵（札の高さより12だけ低く・縦横比のまま）、右に3行（左そろえ）
    const left = x - 320;
    const key = `type-${id}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(left + 70, y, key);
      img.setScale(138 / img.height);
    }
    const tx = left + 140;
    const room = 640 - 140 - 16;
    const line = (dy, str, size, color) => fitText(this.add.text(tx, y + dy, str, textStyle(size, color)).setOrigin(0, 0.5), room);
    line(-44, t(`type.${id}.name`), 36, COLORS.ink);
    line(2, t(`type.${id}.strong`), 24, COLORS.ink);
    line(40, t(`type.${id}.weak`), 24, COLORS.sub);
    const zone = hitZone(this, x, y, 640, 150);
    zone.on('pointerdown', () => gfx.setAlpha(0.8));
    zone.on('pointerout', () => gfx.setAlpha(1));
    zone.on('pointerup', () => {
      gfx.setAlpha(1);
      session.you = id;
      this.scene.restart();
    });
  }
}
