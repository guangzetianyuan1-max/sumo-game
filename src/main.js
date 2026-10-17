// src/main.js — 言葉を決めて Phaser を始める
import { CautionScene } from './scenes/CautionScene.js?v=54';
import { CoverScene } from './scenes/CoverScene.js?v=54';
import { GuideScene } from './scenes/GuideScene.js?v=54';
import { LadderScene } from './scenes/LadderScene.js?v=54';
import { OpponentScene } from './scenes/OpponentScene.js?v=54';
import { AfterScene } from './scenes/AfterScene.js?v=54';
import { TrainingScene } from './scenes/TrainingScene.js?v=54';
import { DrillScene } from './scenes/DrillScene.js?v=54';
import { KamiScene } from './scenes/KamiScene.js?v=54';
import { HelpScene } from './scenes/HelpScene.js?v=54';
import { KenshoScene } from './scenes/KenshoScene.js?v=54';
import { ClearScene } from './scenes/ClearScene.js?v=54';
import { CollectionScene } from './scenes/CollectionScene.js?v=54';
import { initLang, t } from './i18n/i18n.js?v=54';
import { storage } from './ui/widgets.js?v=54';
import { session, lastSlot, onSaveFail } from './state.js?v=54';
import { setScene, setMuted, isMuted, unlockOnGesture, musicHidden } from './ui/music.js?v=54';
import { sfxHidden, sfxWake } from './ui/sfx.js?v=54';
import { askTerms, askTermsPlain } from './ui/terms.js?v=54';
import { showNotice } from './ui/notice.js?v=54';

const lang = initLang(storage(), navigator.language);
document.documentElement.lang = lang;
session.slot = lastSlot(storage()); // 前に使った記録（初めの画面で札を押すと決め直す）
onSaveFail(() => showNotice(t('save.cannot'))); // v44：記録を残せない端末では一度だけ知らせる（記録の画面は memory の勝ち抜きを出す）

// 音楽：画面が始まるたびにその画面の曲へ（同じ曲なら流し続ける）・最初に触れた時に鳴り始める・右下の札で消す／鳴らす（覚えておく）
function hookMusic(game) {
  game.events.once('ready', () => {
    game.scene.scenes.forEach((s) => s.events.on('create', () => setScene(s.scene.key)));
  });
  unlockOnGesture(window);
  // v44：曲と効果音は Phaser と別の音（AudioContext）＝裏へ回っても止まらなかった。隠れたら止め、戻ったら（消音でなければ）起こす。
  // 触れるたびに効果音の音も起こす（iPhone の 'interrupted' から戻す）
  document.addEventListener('visibilitychange', () => { const h = !!document.hidden; musicHidden(h); sfxHidden(h); });
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) => window.addEventListener(ev, sfxWake, { passive: true }));
  const btn = document.getElementById('music');
  if (!btn) return;
  const paint = () => { btn.textContent = isMuted() ? '♪×' : '♪'; btn.style.opacity = isMuted() ? '0.45' : '0.85'; };
  btn.addEventListener('click', (e) => { e.stopPropagation(); setMuted(!isMuted()); paint(); });
  // 置き場所：遊ぶ画面（720×1280）の外の空き（下・右）があればそこへ。無ければ画面の右下の一番すみ
  // ⛔画面の右下の角から 70 の所に置くと、稽古の画面の「番付を見る」の札の右端に重なった（10/13）
  const place = () => {
    const cv = document.querySelector('#game canvas');
    if (!cv) return;
    const r = cv.getBoundingClientRect(), k = r.width / 720;
    const size = Math.max(36, 56 * k), W = window.innerWidth, H = window.innerHeight;
    let x, y;
    if (H - r.bottom >= size + 8) { x = r.right - size - 8; y = r.bottom + (H - r.bottom - size) / 2; }
    else if (W - r.right >= size + 8) { x = r.right + (W - r.right - size) / 2; y = r.bottom - size - 8; }
    else { x = r.right - size - 4; y = r.bottom - size - 4; }
    btn.style.left = x + 'px';
    btn.style.top = y + 'px';
    btn.style.width = btn.style.height = size + 'px';
    btn.style.fontSize = (size / 2) + 'px';
    btn.style.display = 'block';
  };
  paint();
  game.scale.on('resize', place);
  window.addEventListener('resize', place);
  game.events.once('ready', place);
  setTimeout(place, 300);
}

function start() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#141a2e',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 720, height: 1280 },
    input: { activePointers: 3 }, // 指は3本まで（既定は1本＝2本目の親指が落ちる。取組は左右の2つのボタンを両手で押す）
    scene: [CautionScene, CoverScene, GuideScene, HelpScene, LadderScene, OpponentScene, KenshoScene, KamiScene, AfterScene, ClearScene, TrainingScene, DrillScene, CollectionScene],
  });
  hookMusic(game);
}

// 字体（太さ800と500）が読めてから、遊ぶ前の同意書（初めてと版が変わった時だけ・src/ui/terms.js）→ 同意したら始める（注意書きの札 → 表紙）。
// 字体が読めなくても進む。同意書の画面が出せない時は、短い文と「同意する」だけの代わりの画面（askTermsPlain）＝同意なしでは始めない（v42 第2段 D1）。
// 代わりの画面も出せない時は始めない（画面の部品が作れない端末では遊びも動かない）
// 字体の読み込みは FONT_WAIT_MS で先へ進む（v44・バグ探し L5：電波が弱いと読み込みが止まり、藍の画面のまま何も出なかった）
const FONT_WAIT_MS = 3000;
const fontsReady = document.fonts
  ? Promise.all([document.fonts.load('800 32px "M PLUS Rounded 1c"'), document.fonts.load('500 24px "M PLUS Rounded 1c"')])
  : Promise.resolve();
Promise.race([fontsReady, new Promise((r) => setTimeout(r, FONT_WAIT_MS))])
  .catch(() => {}).then(() => askTerms()).catch(() => askTermsPlain()).then(start, () => {});
