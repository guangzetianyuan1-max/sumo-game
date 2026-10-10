// src/main.js — 言葉を決めて Phaser を始める
import { GuideScene } from './scenes/GuideScene.js?v=9';
import { SetupScene } from './scenes/SetupScene.js?v=9';
import { OpponentScene } from './scenes/OpponentScene.js?v=9';
import { StrategyScene } from './scenes/StrategyScene.js?v=9';
import { BoutScene } from './scenes/BoutScene.js?v=9';
import { NameScene } from './scenes/NameScene.js?v=9';
import { TrainingScene } from './scenes/TrainingScene.js?v=9';
import { BanzukeScene } from './scenes/BanzukeScene.js?v=9';
import { ScheduleScene } from './scenes/ScheduleScene.js?v=9';
import { ResultScene } from './scenes/ResultScene.js?v=9';
import { initLang } from './i18n/i18n.js?v=9';
import { storage } from './ui/widgets.js?v=9';

const lang = initLang(storage(), navigator.language);
document.documentElement.lang = lang;

function start() {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#141a2e',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 720, height: 1280 },
    scene: [GuideScene, SetupScene, NameScene, TrainingScene, BanzukeScene, ScheduleScene, OpponentScene, StrategyScene, BoutScene, ResultScene],
  });
}

// 字体（太さ800と500）が読めてから始める（読めなくても始める）
(document.fonts
  ? Promise.all([document.fonts.load('800 32px "M PLUS Rounded 1c"'), document.fonts.load('500 24px "M PLUS Rounded 1c"')])
  : Promise.resolve()
).catch(() => {}).finally(start);
