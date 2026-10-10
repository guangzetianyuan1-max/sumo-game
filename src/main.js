// src/main.js — 言葉を決めて Phaser を始める
import { SetupScene } from './scenes/SetupScene.js';
import { StrategyScene } from './scenes/StrategyScene.js';
import { BoutScene } from './scenes/BoutScene.js';
import { initLang } from './i18n/i18n.js';
import { storage } from './ui/widgets.js';

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
