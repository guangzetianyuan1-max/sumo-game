// 本番（取組）の背景の選び方（設計書 §6・§10）：敵の番号 0〜4=bout1・5〜9=bout2・10〜14=bout3・15〜19=bout4。表紙は dohyo のまま
// 絵は tools/prep_bg.py が assets/bg/bout1.jpg〜bout4.jpg に置く。無い・読めない時は土俵の背景 dohyo-bg に戻る（取組を止めない）
export const BOUT_BG_COUNT = 4; // 本番の背景の枚数
export const BOUT_BG_SPAN = 5; // 何体ごとに替わるか
export const DOHYO_BG = 'dohyo-bg'; // 土俵の背景（表紙・結果・代わり）の鍵

export function boutBgKey(foeIndex) {
  const n = Number.isFinite(foeIndex) ? Math.floor(foeIndex / BOUT_BG_SPAN) : 0;
  return `bout${Math.min(BOUT_BG_COUNT, Math.max(1, n + 1))}`;
}

export const boutBgPath = (key) => `assets/bg/${key}.jpg`;

// 画面の外の余白（縦長の画面の上下）の色：上半分＝その背景の絵の一番上の色に夜の藍（0x141a2e・0.45）を重ねた色・下半分＝藍（最終点検の直し 5）
// 色は tools/prep_bg.py の後に絵の一番上の6行の平均から出した値（絵を替えたら出し直す）
export const BACKDROP_NAVY = '#141a2e';
export const BACKDROP_TOP = { [DOHYO_BG]: '#271e26', bout1: '#333134', bout2: '#12131a', bout3: '#13161f', bout4: '#0e1424' };
export function backdropEdge(key) {
  const top = Object.prototype.hasOwnProperty.call(BACKDROP_TOP, key) ? BACKDROP_TOP[key] : BACKDROP_TOP[DOHYO_BG];
  return `linear-gradient(${top} 50%, ${BACKDROP_NAVY} 50%)`;
}

// 読み込めた絵（has(鍵) が真）ならその鍵・無ければ土俵の背景
export function pickBackdrop(wanted, has) {
  return wanted && has(wanted) ? wanted : DOHYO_BG;
}

// ---- 各画面（番付・相手の情報・取組の後・稽古・記録・遊び方・クリア・懸賞旗）の背景（10/15 本人「各画面の背景も見直してください。見やすいが淡泊」）----
// 番付＝その時の場所（今の相手の bout1〜4・クリアした後は土俵）・相手の情報と取組の後＝その相手の場所・稽古＝稽古場・記録／遊び方／クリア／懸賞旗＝土俵。
// 注意書き・表紙・取組・遊びの画面は今のまま（null）
export const KEIKO_BG = 'keiko-bg'; // 稽古場の背景（DrillScene と同じ鍵＝読み込みを使い回す）
const BG_FILE = { [DOHYO_BG]: 'dohyo', [KEIKO_BG]: 'keiko' };
export const bgPath = (key) => `assets/bg/${Object.prototype.hasOwnProperty.call(BG_FILE, key) ? BG_FILE[key] : key}.jpg`;

export function menuBgKey(scene, { foeIndex = null, cleared = false } = {}) {
  switch (scene) {
    case 'ladder': return cleared ? DOHYO_BG : boutBgKey(foeIndex);
    case 'opponent':
    case 'after': return boutBgKey(foeIndex);
    case 'training': return KEIKO_BG;
    case 'guide':
    case 'help':
    case 'clear':
    case 'kensho': return DOHYO_BG;
    default: return null;
  }
}

// 暗くする濃さ（絵ごと）：絵の上に夜の藍をこの不透明度で重ねる。場所がひと目で分かる明るさに（明るい絵は濃く・暗い絵は薄く）
// 字はこの上に直に置かず、墨の板（PANEL_ALPHA）の上に置く（10/15 見直し：0.82 で全体を暗くすると絵が見えず「淡泊」のままだった）
export const MENU_DIM = { [DOHYO_BG]: 0.5, [KEIKO_BG]: 0.42, bout1: 0.55, bout2: 0.55, bout3: 0.45, bout4: 0.38 };
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
