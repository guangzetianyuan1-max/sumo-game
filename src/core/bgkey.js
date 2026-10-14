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
