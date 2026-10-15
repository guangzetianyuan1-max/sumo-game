// src/ui/backdrop.js — 各画面の背景（10/15 本人「各画面の背景も見直してください。見やすいが淡泊」）
// その画面の場所の絵（bgkey.menuBgKey）を、少しぼかして・夜の藍で少し暗くし（場所がひと目で分かる濃さ・絵ごと）・和柄（青海波）を重ねた1枚にして画面いっぱいに敷く。
// 上下左右の端は藍へ溶かす（ページの余白の色とつながる）。見出しのある画面は上に墨の帯と和紙の色の二重の線・画面のふちに和紙の色の細い枠。
// 字は絵の上に直に置かず、墨の板（inkPanel・角の丸い・和紙の色の細い縁）の上に置く＝板の下がどんなに明るくても字は読める
// 新しい絵は描かない：ぼかしは「小さく描いて大きく戻す」（WebGL でも Canvas でも同じ・毎フレームの重さなし）・和柄と帯と枠は図形。
// 作った1枚は Phaser の絵の置き場に残し、次からは使い回す（多くても2枚だけ残す）。絵が読めない時は土俵・それも無ければ藍の地に和柄だけ（止めない）
import { bgPath, pickBackdrop, DOHYO_BG, BACKDROP_NAVY, menuDim, menuEdge, PANEL_ALPHA, BAND_ALPHA, WAVE_ALPHA } from '../core/bgkey.js?v=44';
import { roundPoints } from './widgets.js?v=44';

const W = 720;
const H = 1280;
const BLUR_DOWN = 4; // ぼかしの強さ（1/4 に縮めて戻す＝軽いぼかし）
const WASHI = 'rgb(232,220,192)'; // 和紙の色（#e8dcc0）
const WASHI_HEX = 0xe8dcc0;
const SUMI = 0x141a2e; // 帯の地（夜の藍＝墨）
const NAVY_RGB = '20,26,46';
const WAVE = { r: 40, rings: 4, alpha: WAVE_ALPHA }; // 青海波：半円の半径・輪の数・線の濃さ（暗くした後に重ねる）
const FADE = { tb: 150, side: 44 }; // 端を藍へ溶かす幅（上下・左右）
const KEEP = 2; // 残す背景の枚数
const made = []; // 作った背景の鍵（古い順）
let wavesCanvas = null;

// 読み込み：その画面の絵と、代わりの土俵（どちらも読み込み済みなら何もしない）。失敗しても Phaser は他の絵を読み続ける
export function preloadBackdrop(scene, key) {
  [key, DOHYO_BG].forEach((k) => {
    if (k && !scene.textures.exists(k)) scene.load.image(k, bgPath(k));
  });
}

// 敷く：key＝menuBgKey の鍵。band＝見出しの帯の下の端の y（0 なら帯なし）。一番後ろ（深さ -20〜-18）に置く
export function drawBackdrop(scene, key, { band = 0 } = {}) {
  const { width, height } = scene.scale;
  const src = pickBackdrop(key, (k) => scene.textures.exists(k));
  const tex = composite(scene, scene.textures.exists(src) ? src : null, menuDim(src));
  if (tex) scene.add.image(0, 0, tex).setOrigin(0, 0).setDisplaySize(width, height).setDepth(-20);
  else scene.add.rectangle(0, 0, width, height, SUMI, 1).setOrigin(0, 0).setDepth(-20);
  const g = scene.add.graphics().setDepth(-18);
  if (band > 0) headerBand(g, width, band);
  washiFrame(g, width, height);
  setPageEdge(scene, menuEdge());
}

// 字の後ろの墨の板：left,top,w,h。深さ -10（背景より前・字や札より後ろ）。角の丸い1枚の多角形で塗る（半透明でも継ぎ目が出ない）
export function inkPanel(scene, left, top, w, h, { radius = 24 } = {}) {
  const g = scene.add.graphics().setDepth(-10);
  g.fillStyle(SUMI, PANEL_ALPHA).fillPoints(roundPoints(left, top, w, h, radius), true);
  g.lineStyle(2, WASHI_HEX, 0.5).strokeRoundedRect(left, top, w, h, radius);
  return g;
}

// 取組と同じ箱の画面（クリア・懸賞旗）：絵は arena のまま、箱の下の藍の地に青海波を薄く・ふちに和紙の色の枠
export function drawWaUnder(scene, top) {
  const { width, height } = scene.scale;
  const key = 'wa-waves';
  if (!scene.textures.exists(key)) {
    try {
      const ct = scene.textures.createCanvas(key, W, H);
      const ctx = ct.getContext();
      ctx.globalAlpha = 0.8;
      ctx.drawImage(waves(), 0, 0);
      ct.refresh();
    } catch (e) { /* 描けない端末は和柄なし */ }
  }
  if (scene.textures.exists(key)) {
    const img = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(-18);
    img.setScale(width / W, height / H).setCrop(0, top * (H / height), W, H);
  }
  washiFrame(scene.add.graphics().setDepth(-18), width, height);
}

// 見出しの帯：墨の地（字の後ろはさらに暗い）・下の縁に和紙の色の太い線と細い線
function headerBand(g, width, band) {
  g.fillStyle(SUMI, BAND_ALPHA).fillRect(0, 0, width, band);
  g.fillStyle(WASHI_HEX, 0.55).fillRect(0, band, width, 3);
  g.fillStyle(WASHI_HEX, 0.28).fillRect(0, band + 7, width, 1.5);
}

// 画面のふちの和紙の色の細い二重の枠（ボタンや札より外＝ふちから 8 と 14）
function washiFrame(g, width, height) {
  g.lineStyle(2, WASHI_HEX, 0.3).strokeRect(8, 8, width - 16, height - 16);
  g.lineStyle(1, WASHI_HEX, 0.16).strokeRect(14, 14, width - 28, height - 28);
}

// ページの余白（画面の外）の色を背景の端の色に。出る時は元に戻す（arena.drawBackdrop と同じ）
// 同じ画面で何度描いても、元の色を覚えるのは最初の1回・戻す仕掛けも1つだけ（2回目に「変えた後の色」を元と取り違えない）
const pageEdgeOld = new WeakMap();
export function setPageEdge(scene, color) {
  if (typeof document === 'undefined') return;
  const els = [document.documentElement, document.body].filter(Boolean);
  if (!pageEdgeOld.has(scene)) {
    pageEdgeOld.set(scene, els.map((el) => el.style.background));
    scene.events.once('shutdown', () => {
      const old = pageEdgeOld.get(scene) || [];
      els.forEach((el, i) => { el.style.background = old[i] || ''; });
      pageEdgeOld.delete(scene);
    });
  }
  els.forEach((el) => { el.style.background = color; });
}

// 自前で絵を敷く画面（取組・懸賞旗・クリアの arena・表紙・稽古の遊び）の端を、各画面の背景と同じ帯（fadeEdges）で藍へ溶かす（v42 第2段）。
// ページの余白（藍）と絵の端の色の段差を消す。bottom＝絵の下の端（画面の y・取組は箱の上の面 GROUND＝下の帯は使わない）・depth＝絵のすぐ前。
// 帯の1枚（透明の地に藍の帯）は一度だけ作って使い回す。作れない端末は何もしない（止めない）
export const EDGE_FADE_KEY = 'edge-fade';
export function edgeFade(scene, { bottom = null, depth = -19 } = {}) {
  const { width, height } = scene.scale;
  setPageEdge(scene, BACKDROP_NAVY);
  try {
    if (!scene.textures.exists(EDGE_FADE_KEY)) {
      const ct = scene.textures.createCanvas(EDGE_FADE_KEY, W, H);
      if (!ct) return null;
      fadeEdges(ct.getContext());
      ct.refresh();
    }
    const img = scene.add.image(0, 0, EDGE_FADE_KEY).setOrigin(0, 0).setDisplaySize(width, height).setDepth(depth);
    if (bottom != null && bottom < height) img.setCrop(0, 0, W, bottom * (H / height));
    return img;
  } catch (e) {
    return null;
  }
}

// 背景の1枚を作る（作ってあれば使い回す）。src＝絵の鍵（null＝絵なし）・dim＝暗くする濃さ。作れなければ null
function composite(scene, src, dim) {
  const out = `menubg-${src || 'none'}`;
  if (scene.textures.exists(out)) return out;
  try {
    while (made.length >= KEEP) {
      const old = made.shift();
      if (scene.textures.exists(old)) scene.textures.remove(old);
    }
    const ct = scene.textures.createCanvas(out, W, H);
    if (!ct) return null;
    const ctx = ct.getContext();
    ctx.fillStyle = BACKDROP_NAVY;
    ctx.fillRect(0, 0, W, H);
    if (src) blurInto(ctx, scene.textures.get(src).getSourceImage());
    ctx.fillStyle = `rgba(${NAVY_RGB},${dim})`;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(waves(), 0, 0); // 和柄は暗くした後に（はっきり見える）。字は墨の板の上なので読みやすさは板が受け持つ
    fadeEdges(ctx);
    ct.refresh();
    made.push(out);
    return out;
  } catch (e) {
    if (scene.textures.exists(out)) scene.textures.remove(out);
    return null;
  }
}

// 絵を画面いっぱいに（はみ出す分は真ん中で切る）・1/BLUR_DOWN に縮めてから戻す＝軽いぼかし
function blurInto(ctx, img) {
  if (!img || !img.width || !img.height) return;
  const s = Math.max(W / img.width, H / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  const small = document.createElement('canvas');
  small.width = Math.ceil(W / BLUR_DOWN);
  small.height = Math.ceil(H / BLUR_DOWN);
  const sc = small.getContext('2d');
  sc.imageSmoothingEnabled = true;
  sc.drawImage(img, (W - dw) / 2 / BLUR_DOWN, (H - dh) / 2 / BLUR_DOWN, dw / BLUR_DOWN, dh / BLUR_DOWN);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, W, H);
}

// 上下左右の端を藍へ溶かす（端で不透明＝ページの余白の藍とつながる）
function fadeEdges(ctx) {
  const band = (x0, y0, x1, y1, rx, ry, rw, rh) => {
    const gr = ctx.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, `rgba(${NAVY_RGB},1)`);
    gr.addColorStop(1, `rgba(${NAVY_RGB},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(rx, ry, rw, rh);
  };
  band(0, 0, 0, FADE.tb, 0, 0, W, FADE.tb);
  band(0, H, 0, H - FADE.tb, 0, H - FADE.tb, W, FADE.tb);
  band(0, 0, FADE.side, 0, 0, 0, FADE.side, H);
  band(W, 0, W - FADE.side, 0, W - FADE.side, 0, FADE.side, H);
}

// 青海波（和紙の色の線・透明の地）：半円の鱗を上の段から順に、下の段が上の段の線を隠すように重ねる。一度だけ描いて使い回す
function waves() {
  if (wavesCanvas) return wavesCanvas;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const { r, rings, alpha } = WAVE;
  ctx.lineWidth = 2;
  ctx.strokeStyle = WASHI;
  for (let row = 0, y = 0; y < H + r; row += 1, y += r / 2) {
    const off = row % 2 ? r : 0;
    for (let x = -r + off; x < W + r; x += r * 2) {
      // 下の段の鱗の中の、上の段の線を消す（地は透明のまま）
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha;
      for (let k = 1; k <= rings; k++) {
        ctx.beginPath();
        ctx.arc(x, y, (r * k) / rings - 1, Math.PI, 0);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  wavesCanvas = c;
  return c;
}
