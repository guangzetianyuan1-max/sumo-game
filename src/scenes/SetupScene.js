// src/scenes/SetupScene.js — 入門：育てる自分のタイプを1つ選ぶ → しこ名へ（一代記の間、タイプは変わらない）
import { TYPE_IDS } from '../data/types.js?v=23';
import { t, getLang, setLang } from '../i18n/i18n.js?v=23';
import { session } from '../state.js?v=23';
import { button, backButton, fitText, roundBox, hitZone, textStyle, preloadTypeArt, COLORS, TOP_LEFT_FREE, storage } from '../ui/widgets.js?v=23';

export class SetupScene extends Phaser.Scene {
  constructor() {
    super('setup');
  }

  preload() {
    preloadTypeArt(this);
  }

  create() {
    const { width } = this.scale;
    backButton(this, () => this.scene.start('guidePick')); // 入門する部屋を選び直す
    fitText(this.add.text(TOP_LEFT_FREE, 55, t('title'), textStyle(60, COLORS.gold)).setOrigin(0, 0.5), width - 190 - 16 - TOP_LEFT_FREE);
    button(this, width - 105, 55, 170, 70, t('lang.toggle'), () => {
      setLang(getLang() === 'ja' ? 'en' : 'ja', storage());
      document.documentElement.lang = getLang();
      this.scene.restart();
    }, { size: 28, color: COLORS.buttonSub });
    this.add.text(40, 120, t('setup.you'), textStyle(40, COLORS.ink));
    TYPE_IDS.forEach((id, i) => this.card(id, 270 + i * 170));
    // session.you は札を押した時に決まっている → しこ名を選ぶ
    button(this, width / 2, 1190, 460, 110, t('setup.start'), () => this.scene.start('name'), { size: 38 });
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
    // 文字の始まり＝絵の左の余白70の中心から絵の右端 + 24
    const imgW = this.textures.exists(key) ? this.textures.get(key).getSourceImage().width * (138 / this.textures.get(key).getSourceImage().height) : 0;
    const tx = left + 70 + imgW / 2 + 24;
    const room = left + 640 - 16 - tx;
    const line = (dy, str, size, color, extra) => fitText(this.add.text(tx, y + dy, str, textStyle(size, color, extra)).setOrigin(0, 0.5), room);
    line(-44, t(`type.${id}.name`), 34, COLORS.ink);
    line(2, t(`type.${id}.strong`), 24, COLORS.ink, { fontStyle: '500' });
    line(40, t(`type.${id}.weak`), 24, COLORS.sub, { fontStyle: '500' });
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
