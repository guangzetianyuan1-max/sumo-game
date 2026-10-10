// src/main.js — 言葉を決めて Phaser を始める
import { SetupScene } from './scenes/SetupScene.js?v=4';
import { StrategyScene } from './scenes/StrategyScene.js?v=4';
import { BoutScene } from './scenes/BoutScene.js?v=4';
import { initLang } from './i18n/i18n.js?v=4';
import { storage } from './ui/widgets.js?v=4';

const lang = initLang(storage(), navigator.language);
document.documentElement.lang = lang;

function start() {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#141a2e',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 720, height: 1280 },
    scene: [SetupScene, StrategyScene, BoutScene],
  });
}

// 字体（太さ800と500）が読めてから始める（読めなくても始める）
(document.fonts
  ? Promise.all([document.fonts.load('800 32px "M PLUS Rounded 1c"'), document.fonts.load('500 24px "M PLUS Rounded 1c"')])
  : Promise.resolve()
).catch(() => {}).finally(start);
