// 本番（取組）の背景（設計書 §6・§10）。v42 第2段（本人 10/15「背景は国技場統一に戻してください」）：20体とも土俵（国技館）の絵 dohyo.jpg。
// 5体ごとの本番の背景（茶の間・縁側・駄菓子屋・夏祭り＝bout1〜4）はやめた（元の絵は art_in/背景_本番1..4_*.jpg に残っている）
export const DOHYO_BG = 'dohyo-bg'; // 土俵の背景（表紙・取組・各画面）の鍵

// 敵の番号 → 取組の背景の鍵（呼ぶ側を変えずに済むよう関数は残す・どの番号でも土俵）
export function boutBgKey() {
  return DOHYO_BG;
}

// 画面の外の余白（縦長の画面の上下・横長の画面の左右）の色＝夜の藍。絵の側の端を藍へ溶かしてつなぐ（backdrop.js の fadeEdges・edgeFade）
export const BACKDROP_NAVY = '#141a2e';

// 読み込めた絵（has(鍵) が真）ならその鍵・無ければ土俵の背景
export function pickBackdrop(wanted, has) {
  return wanted && has(wanted) ? wanted : DOHYO_BG;
}

// ---- 各画面（番付・相手の情報・取組の後・稽古・記録・遊び方・クリア・懸賞旗）の背景（10/15 本人「各画面の背景も見直してください。見やすいが淡泊」）----
// 稽古＝稽古場・ほか（番付・相手の情報・取組の後・記録・遊び方・クリア・懸賞旗）＝土俵（v42 第2段：国技館に統一）。
// 注意書き・表紙・取組・遊びの画面は今のまま（null）
export const KEIKO_BG = 'keiko-bg'; // 稽古場の背景（DrillScene と同じ鍵＝読み込みを使い回す）
const BG_FILE = { [DOHYO_BG]: 'dohyo', [KEIKO_BG]: 'keiko' };
export const bgPath = (key) => `assets/bg/${Object.prototype.hasOwnProperty.call(BG_FILE, key) ? BG_FILE[key] : key}.jpg`;

export function menuBgKey(scene) { // 呼ぶ側は { foeIndex, cleared } も渡す（今はどれも土俵なので使わない）
  switch (scene) {
    case 'training': return KEIKO_BG;
    case 'ladder':
    case 'opponent':
    case 'after':
    case 'guide':
    case 'help':
    case 'clear':
    case 'collection':
    case 'kensho': return DOHYO_BG;
    default: return null;
  }
}

// 暗くする濃さ（絵ごと）：絵の上に夜の藍をこの不透明度で重ねる。場所がひと目で分かる明るさに（明るい絵は濃く・暗い絵は薄く）
// 字はこの上に直に置かず、墨の板（PANEL_ALPHA）の上に置く（10/15 見直し：0.82 で全体を暗くすると絵が見えず「淡泊」のままだった）
export const MENU_DIM = { [DOHYO_BG]: 0.5, [KEIKO_BG]: 0.42 };
export const MENU_DIM_DEFAULT = 0.5;
export const menuDim = (key) => (Object.prototype.hasOwnProperty.call(MENU_DIM, key) ? MENU_DIM[key] : MENU_DIM_DEFAULT);
// 青海波の線の濃さ（和紙の色・暗くした絵の上に重ねる）
export const WAVE_ALPHA = 0.14;
export const WASHI_RGB = [232 / 255, 220 / 255, 192 / 255];
// 字の後ろの墨の板（と見出しの帯）の不透明度：板の下が背景の一番明るい点（worstBackdrop）でも、小さな字（#b9b3a6）との明るさの比が 4.5 以上になる値
export const PANEL_ALPHA = 0.78;
export const BAND_ALPHA = 0.86;
// 画面の上下左右の端は藍へ溶かす＝ページの余白の色は藍のまま（どの絵でも同じ）
export const menuEdge = () => BACKDROP_NAVY;

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const luminance = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
// 色（'#rrggbb' か [r,g,b] 0〜1）2つの明るさの比（WCAG）
export function contrastRatio(a, b) {
  const la = luminance(typeof a === 'string' ? hexRgb(a) : a);
  const lb = luminance(typeof b === 'string' ? hexRgb(b) : b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
// 色 rgb（0〜1）に夜の藍を dim の濃さで重ねた色（Phaser・canvas と同じ、ガンマのままの混ぜ方）
export function dimmed(rgb, dim = PANEL_ALPHA) {
  const navy = hexRgb(BACKDROP_NAVY);
  return rgb.map((c, i) => c * (1 - dim) + navy[i] * dim);
}
// 背景の一番明るくなりうる点：絵の真っ白を一番薄い濃さ（全部の絵の中で）で暗くし、その上に青海波の線が重なった色
export function worstBackdrop() {
  const d = Math.min(MENU_DIM_DEFAULT, ...Object.keys(MENU_DIM).map((k) => MENU_DIM[k]));
  return dimmed([1, 1, 1], d).map((c, i) => c * (1 - WAVE_ALPHA) + WASHI_RGB[i] * WAVE_ALPHA);
}
