// src/scenes/SetupScene.js — 入門：主人公を5人から1人選ぶ → 番付表へ（勝ち抜きの間、主人公は変わらない）
import { TYPE_IDS } from '../data/types.js?v=52';
import { t, getLang, setLang, heroName } from '../i18n/i18n.js?v=52';
import { session, startRun } from '../state.js?v=52';
import { button, backButton, fitText, roundBox, hitZone, textStyle, preloadTypeArt, preloadHeroFigures, heroKey, COLORS, TOP_LEFT_FREE, storage } from '../ui/widgets.js?v=52';

export class SetupScene extends Phaser.Scene {
  constructor() {
    super('setup');
  }

  preload() {
    preloadTypeArt(this);
    preloadHeroFigures(this);
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
    this.add.text(40, 120, t('setup.hero'), textStyle(40, COLORS.ink));
    TYPE_IDS.forEach((id, i) => this.card(id, 270 + i * 170));
    // session.you は札を押した時に決まっている → 入門して番付表へ（しこ名の画面は無い）
    button(this, width / 2, 1190, 460, 110, t('setup.start'), () => {
      startRun({ guide: session.guide ?? 'chizuru', type: session.you, seed: Date.now() % 1000000 });
      this.scene.start('ladder');
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
    const key = heroKey(this, id); // フィギュア風（無ければドット）
    if (this.textures.exists(key)) {
      const img = this.add.image(left + 70, y, key);
      img.setScale(138 / img.height);
    }
    // 文字の始まり＝絵の左の余白70の中心から絵の右端 + 24
    const imgW = this.textures.exists(key) ? this.textures.get(key).getSourceImage().width * (138 / this.textures.get(key).getSourceImage().height) : 0;
    const tx = left + 70 + imgW / 2 + 24;
    const room = left + 640 - 16 - tx;
    const line = (dy, str, size, color, extra) => fitText(this.add.text(tx, y + dy, str, textStyle(size, color, extra)).setOrigin(0, 0.5), room);
    line(-44, heroName(id), 34, COLORS.ink);
    line(2, t('setup.heroLine', { type: t(`type.${id}.name`), trait: t(`hero.${id}.trait`) }), 24, COLORS.ink, { fontStyle: '500' });
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
