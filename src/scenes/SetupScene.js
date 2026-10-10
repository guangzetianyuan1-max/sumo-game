// src/scenes/SetupScene.js — 自分と相手のタイプを選ぶ（第1段の入口・入門の画面は第3段）
import { TYPE_IDS } from '../data/types.js';
import { t, getLang, setLang } from '../i18n/i18n.js';
import { session } from '../state.js';
import { button, fitText, FONT, COLORS, storage } from '../ui/widgets.js';

export class SetupScene extends Phaser.Scene {
  constructor() {
    super('setup');
  }

  create() {
    const { width } = this.scale;
    fitText(this.add.text(40, 55, t('title'), { fontFamily: FONT, fontSize: 60, color: COLORS.gold }).setOrigin(0, 0.5), width - 280);
    button(this, width - 105, 55, 170, 70, t('lang.toggle'), () => {
      setLang(getLang() === 'ja' ? 'en' : 'ja', storage());
      document.documentElement.lang = getLang();
      this.scene.restart();
    }, { size: 28, color: COLORS.buttonSub });
    // 5つ×2組を 720×1280 に収めるため、札は高さ84・間隔92（題の字と札が重ならない並び）
    this.picker(115, 'setup.you', 'you');
    this.picker(630, 'setup.opp', 'opp');
    button(this, width / 2, 1215, 460, 100, t('setup.next'), () => {
      // 自分のタイプを変えたときだけ自分の作戦表を、相手のタイプを変えたときだけ相手の作戦表を、見本から組み直す
      const plan = session.planFor;
      if (!plan || plan.you !== session.you) session.strategy = null;
      if (!plan || plan.opp !== session.opp) session.oppStrategy = null;
      session.planFor = { you: session.you, opp: session.opp };
      this.scene.start('strategy');
    }, { size: 38 });
  }

  picker(top, labelKey, field) {
    const { width } = this.scale;
    this.add.text(40, top, t(labelKey), { fontFamily: FONT, fontSize: 40, color: COLORS.ink });
    TYPE_IDS.forEach((id, i) => {
      const y = top + 90 + i * 92;
      const on = session[field] === id;
      button(this, width / 2, y, 640, 84, t(`type.${id}.name`), () => {
        session[field] = id;
        this.scene.restart();
      }, { color: on ? COLORS.panelOn : COLORS.panel, size: 34, sub: t(`type.${id}.strong`), subSize: 22 });
    });
  }
}
