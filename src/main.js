// src/main.js — 言葉を決めて Phaser を始める
import { SetupScene } from './scenes/SetupScene.js?v=3';
import { StrategyScene } from './scenes/StrategyScene.js?v=3';
import { BoutScene } from './scenes/BoutScene.js?v=3';
import { initLang } from './i18n/i18n.js?v=3';
import { storage } from './ui/widgets.js?v=3';

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

// 字体が読めてから始める（読めなくても始める）
(document.fonts ? document.fonts.load('32px "DotGothic16"') : Promise.resolve()).catch(() => {}).finally(start);
