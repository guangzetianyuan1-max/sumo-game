// src/platform.js — どこで動いているか（10/17 本人「B」＝YouTube Playables 版）
// Playables 版（tools/build_playables.py が作る一式）は index.html で window.SUMO_PLAYABLES = true と YouTube の SDK（ytgame）を先に読む。
// それ以外（GitHub Pages の公開版・手元の確かめ）は今まで通り＝この部品は何もしない。
// Playables の認定の条件（vault 1_Inbox/2026-10-17-提案-相撲ゲームをYouTubeプレイアブルズへ.md）に合わせて切り替える物：
//   記録＝SDK の saveData／loadData だけ（ほかの保存の仕方は不可）・音＝YouTube の消音に従う（ゲームの ♪ は出さない）・
//   一時停止＝onPause／onResume（visibilitychange は使わない）・言葉＝getLanguage（navigator.language は使わない・言葉は記録に残さない）・
//   同意書を出さない・振動を使わない・読み込み中に firstFrameReady・遊べるようになったら gameReady
import { TERMS_KEY } from './core/terms.js?v=61';

const sdk = () => (typeof ytgame !== 'undefined' && ytgame ? ytgame : null);
export const isPlayables = () => typeof window !== 'undefined' && window.SUMO_PLAYABLES === true;

// ---- 記録（クラウド）：localStorage と同じ形（getItem・setItem・removeItem）の memory の箱。中身は1つの JSON にまとめて saveData へ ----
// 残さない鍵：言葉（YouTube が毎回教える・記録に残すのは不可）・♪の消音（YouTube の消音に従う）・同意書（出さない）
const NOT_SAVED = new Set(['sumo.lang', 'sumo.music', TERMS_KEY]);
export const SAVE_LIMIT = 3 * 1024 * 1024; // 3MiB（認定の MUST）
const SAVE_DELAY_MS = 400; // 続けて書いた時はまとめて1回送る

export function makeCloudStore(send, delay = SAVE_DELAY_MS) {
  const data = {};
  let timer = null;
  const flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    const text = JSON.stringify(data);
    if (text.length * 2 > SAVE_LIMIT) return Promise.resolve(false); // 3MiB を超える記録は送らない（ふつうは数 KB）
    return Promise.resolve(send(text)).then(() => true, () => false);
  };
  const later = () => { if (timer) clearTimeout(timer); timer = setTimeout(flush, delay); };
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { if (NOT_SAVED.has(k)) return; data[k] = String(v); later(); },
    removeItem: (k) => { if (!Object.prototype.hasOwnProperty.call(data, k)) return; delete data[k]; later(); },
    load: (text) => {
      let o = null;
      try { o = text ? JSON.parse(text) : null; } catch { o = null; } // 壊れた記録・前の版の記録で落ちない（MUST）
      if (o && typeof o === 'object') Object.keys(o).forEach((k) => { if (!NOT_SAVED.has(k) && typeof o[k] === 'string') data[k] = o[k]; });
    },
    flush,
  };
}

let cloud = null;
// 記録の置き場：Playables 版はクラウドの箱・ほかは localStorage（読めない端末は null）
export function platformStore() {
  if (isPlayables()) return cloud;
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } // ブラウザでは window.localStorage と同じ（試験は作り物を置ける）
}

// ---- 言葉（Playables 版だけ）：SDK の BCP-47（"ja-JP"・"en-US"）→ 'ja' か 'en' ----
let ytLang = null;
export const playablesLang = () => ytLang;
export const toGameLang = (tag) => (typeof tag === 'string' && /^ja\b/i.test(tag) ? 'ja' : 'en');

// ---- 始める前（main.js が Phaser を作る前に待つ）：記録と言葉を読む。SDK が返事をしない（手元の確かめ）時も WAIT_MS で先へ ----
const WAIT_MS = 2500;
const within = (p, ms, fallback) => Promise.race([Promise.resolve(p).catch(() => fallback), new Promise((r) => setTimeout(() => r(fallback), ms))]);
let loaded = false;
export function initPlatform() {
  if (!isPlayables()) return Promise.resolve();
  const y = sdk();
  cloud = makeCloudStore((text) => {
    if (!loaded || !y || !y.game || !y.game.saveData) return Promise.resolve(); // loadData が済む前は送らない（MUST）
    return y.game.saveData(text);
  });
  const load = y && y.game && y.game.loadData ? within(y.game.loadData(), WAIT_MS, null) : Promise.resolve(null);
  const lang = y && y.system && y.system.getLanguage ? within(y.system.getLanguage(), WAIT_MS, 'en-US') : Promise.resolve('en-US');
  return Promise.all([load, lang]).then(([text, tag]) => {
    cloud.load(text);
    loaded = true;
    ytLang = toGameLang(tag);
  });
}

// ---- YouTube への合図 ----
let firstSent = false, readySent = false;
export function signalFirstFrame() {
  if (!isPlayables() || firstSent) return;
  firstSent = true;
  try { const y = sdk(); if (y && y.game && y.game.firstFrameReady) y.game.firstFrameReady(); } catch { /* 合図が送れなくても遊べる */ }
}
export function signalGameReady() {
  if (!isPlayables() || readySent) return;
  signalFirstFrame(); // firstFrameReady は必ず先（MUST）
  readySent = true;
  try { const y = sdk(); if (y && y.game && y.game.gameReady) y.game.gameReady(); } catch { /* 同上 */ }
}

// ---- 音：YouTube の消音（初めの値と変わった時） ----
export function ytAudioEnabled() {
  try { const y = sdk(); return y && y.system && y.system.isAudioEnabled ? !!y.system.isAudioEnabled() : true; } catch { return true; }
}
export function onYtAudioChange(fn) {
  try { const y = sdk(); if (y && y.system && y.system.onAudioEnabledChange) y.system.onAudioEnabledChange((on) => fn(!!on)); } catch { /* 無ければ初めの値のまま */ }
}

// ---- 一時停止：onPause で止めて記録を送る・onResume で戻す ----
export function onYtPause(pause, resume) {
  try {
    const y = sdk();
    if (!y || !y.system) return;
    if (y.system.onPause) y.system.onPause(() => { pause(); if (cloud) cloud.flush(); });
    if (y.system.onResume) y.system.onResume(() => resume());
  } catch { /* 無ければ何もしない */ }
}

// 振動を使ってよいか（Playables 版は入り切りの設定を置かないので使わない）
export const vibrateAllowed = () => !isPlayables();
