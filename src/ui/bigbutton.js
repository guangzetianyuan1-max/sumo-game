// src/ui/bigbutton.js — 立体の大きな丸ボタン（10/13 本人「ボタンは大きく立体に、押している感じが欲しい」・20体版 Task 5b）
// 取組（KamiScene）・稽古・相手の情報で同じ物を使えるよう、場面のことは知らない。色・字・脈打ちは setLook で渡してもらう
// 形：地面の影 → 側面（厚み THICK px・面の色を暗くした円柱）→ 上の面（上が明るく下が暗い）＋つやの白い弧。押すと面が SINK px 沈み、側面が薄くなり、影が縮む
// 押し：触れた瞬間に onDown → 音「カチッ」と振動 → 沈む／離すと SPRING_MS で少し行き過ぎて戻る。長押しの間は沈んだまま・連打は押すたびに沈んで戻る
// 深さの計算は src/core/pressdepth.js（node で試験できる純粋な関数）
import { pressDepth, SINK, MIN_HOLD_MS } from '../core/pressdepth.js?v=35';
import { playBout } from './sfx.js?v=35';
import { textStyle, fitText, COLORS } from './widgets.js?v=35';

export const THICK = 18; // 側面の厚み（押していない時）
const FACE_TEX = 'bigbtn-face'; // 上の面の下地（白→灰の縦のグラデーション・色は tint で掛ける）
const FACE_PX = 300; // 下地の絵の大きさ（d に合わせて拡縮）
const RING_GAP = 10; // 起き上がりの弧・虹の輪が面のふちから離れる距離
const RAINBOW_SEG = 7; // 虹の輪の色の数
const D2R = Math.PI / 180;

const r8 = (c) => (c >> 16) & 255, g8 = (c) => (c >> 8) & 255, b8 = (c) => c & 255;
const rgb = (r, g, b) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
const scaleColor = (c, k) => rgb(Math.min(255, r8(c) * k), Math.min(255, g8(c) * k), Math.min(255, b8(c) * k));

// 色相 h(0〜1) の鮮やかな色（Phaser を使わず自前で・虹の輪用）
function hsv(h, s, v) {
  const i = Math.floor(h * 6) % 6, f = h * 6 - Math.floor(h * 6);
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  return rgb(c[0] * 255, c[1] * 255, c[2] * 255);
}

// 振動できる端末だけ小さく震わせる（無い端末・拒まれた時は何もしない）
function buzz() {
  try {
    if (typeof navigator !== 'undefined' && navigator && typeof navigator.vibrate === 'function') navigator.vibrate(15);
  } catch (e) {
    // 震えなくても遊びは続ける
  }
}

// 面の下地の絵（一度だけ作る）：円の中を上=白・下=灰の縦グラデーション。tint で色が掛かる
function faceTexture(scene) {
  if (scene.textures.exists(FACE_TEX)) return FACE_TEX;
  const tex = scene.textures.createCanvas(FACE_TEX, FACE_PX, FACE_PX);
  const ctx = tex.getContext();
  const grad = ctx.createLinearGradient(0, 0, 0, FACE_PX);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.55, '#e4e4e4');
  grad.addColorStop(1, '#b8b8b8');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(FACE_PX / 2, FACE_PX / 2, FACE_PX / 2, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
  return FACE_TEX;
}

// opts：x・y（押していない時の面の中心）・d（面の直径）・onDown(pointer)（false を返すと押したことにしない＝沈まない・鳴らない）・onUp()
//       hit（たたける範囲の半径・既定 d/2+15）・depth（既定 5）・sound（既定 'press'・null で無音）・textSize（既定 d*0.18）
export function createBigButton(scene, opts) {
  const x = opts.x, y = opts.y, d = opts.d || 300;
  const R = d / 2;
  const hitR = opts.hit || R + 15;
  const depth = opts.depth === undefined ? 5 : opts.depth;
  const sound = opts.sound === undefined ? 'press' : opts.sound;

  const back = scene.add.graphics().setPosition(x, y).setDepth(depth); // 影・側面
  const face = scene.add.image(x, y, faceTexture(scene)).setDepth(depth + 0.1);
  face.setScale(d / FACE_PX);
  const front = scene.add.graphics().setPosition(x, y).setDepth(depth + 0.2); // つや・ふちの輪・起き上がりの弧・虹
  const label = scene.add.text(x, y, '', textStyle(opts.textSize || Math.round(d * 0.18), COLORS.ink, { stroke: '#141a2e', strokeThickness: 5 })).setOrigin(0.5).setDepth(depth + 0.3);

  let look = { color: 0x5a5f6e, label: '', pulse: 0, fill: 0, arc: false, dim: false, throb: false, rainbow: false, ink: null };
  let labelKey = null, labelBase = 1;
  let pressAt = -Infinity, releaseAt = null; // 押し始め・離した時（ms）。releaseAt が null ＝ 押している最中
  let ids = []; // 今ボタンを押している指

  const now = () => scene.time.now;
  const inside = (p) => Math.hypot(p.x - x, p.y - y) <= hitR;

  const pointerDown = (p) => {
    if (!inside(p)) return;
    if (opts.onDown && opts.onDown(p) === false) return;
    if (ids.length === 0 || releaseAt !== null) pressAt = now();
    releaseAt = null;
    if (ids.indexOf(p.id) < 0) ids.push(p.id);
    if (sound) playBout(sound);
    buzz();
  };
  const pointerUp = (p) => {
    const i = ids.indexOf(p.id);
    if (i < 0) return; // ボタンを押していなかった指
    ids.splice(i, 1);
    if (ids.length === 0) releaseAt = Math.max(now(), pressAt + MIN_HOLD_MS); // 一瞬のたたきも底まで沈んでから戻す
    if (opts.onUp) opts.onUp(p);
  };
  scene.input.on('pointerdown', pointerDown);
  scene.input.on('pointerup', pointerUp);
  scene.input.on('pointerupoutside', pointerUp);

  const api = {
    x, y, d,
    // 指がボタンの範囲に入っているか（ボタンの外の指の処理の判断用）
    contains: inside,
    // 場面ごとの見た目：color（面の色 0xRRGGBB）・label（字・翻訳済み）・pulse（0〜1・ふちの輪が太く明るい）・fill（0〜1・起き上がりの弧）・
    // arc（弧の黒い溝を出す）・dim（薄く）・throb（脈打つ）・rainbow（外に虹の輪を回す）・ink（{color,stroke} 字の色）
    setLook(next) {
      look = { ...look, ...next };
    },
    // 画面が描き直す時に毎コマ呼ぶ
    update() {
      const t = now();
      const held = releaseAt === null ? t - pressAt : releaseAt - pressAt;
      const rel = releaseAt === null ? null : t - releaseAt;
      const pd = pressDepth(held, rel);
      const off = pd.depth - pd.over; // 面のずれ（正＝下）
      const k = Math.max(0, Math.min(1, pd.depth / SINK));
      const throb = look.throb ? 1 + 0.06 * Math.sin((t / 1000) * 14) : 1;
      const col = look.color;
      const a = look.dim ? 0.7 : 1;

      back.setScale(throb);
      front.setScale(throb);
      face.setScale((d / FACE_PX) * throb).setPosition(x, y + off * throb).setTint(scaleColor(col, 1.12)).setAlpha(a);
      label.setPosition(x, y + off * throb);

      // 影（地面）・側面：押すと影は縮んで薄く、側面は面が沈んだ分だけ薄くなる
      back.clear();
      const sy = THICK + 8 - 4 * k;
      back.fillStyle(0x000000, 0.16 - 0.05 * k).fillCircle(0, sy, R + 9 - 5 * k);
      back.fillStyle(0x000000, 0.26 - 0.08 * k).fillCircle(0, sy, R + 3 - 3 * k);
      back.fillStyle(scaleColor(col, 0.5), a).fillRect(-R + 0.5, 0, 2 * R - 1, THICK).fillCircle(0, THICK, R);
      back.fillStyle(0x000000, 0.18 * a).fillRect(-R + 0.5, THICK * 0.55, 2 * R - 1, THICK * 0.45); // 側面の下の方を少し暗く

      // 面の上：縁取り・ふちの輪（拍に近いほど太く明るい）・つやの白い弧
      front.clear();
      front.lineStyle(3, 0x000000, 0.3 * a).strokeCircle(0, off, R - 1.5);
      const pulse = look.pulse || 0;
      front.lineStyle(6 + 12 * pulse, 0xfff0c0, 0.35 + 0.65 * pulse).strokeCircle(0, off, R - 12);
      // つや：面の上の方に、両端へ細くなる三日月
      const gr = R * 0.78, wMax = R * 0.1, from = -158 * D2R, to = -22 * D2R, N = 16;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const th = from + ((to - from) * i) / N;
        pts.push({ x: gr * Math.cos(th), y: off + gr * Math.sin(th) });
      }
      for (let i = N; i >= 0; i--) {
        const th = from + ((to - from) * i) / N, w = wMax * Math.sin((i / N) * Math.PI);
        pts.push({ x: (gr - w) * Math.cos(th), y: off + (gr - w) * Math.sin(th) });
      }
      front.fillStyle(0xffffff, 0.42 * a).fillPoints(pts, true);
      // 虹の輪・起き上がりの弧：沈まない外側（面と側面の真ん中を中心にする）
      const rr = R + RING_GAP, cy = THICK / 2;
      if (look.rainbow) {
        const spin = t / 400;
        for (let i = 0; i < RAINBOW_SEG; i++) {
          const a0 = spin + (i / RAINBOW_SEG) * Math.PI * 2;
          front.lineStyle(12, hsv(i / RAINBOW_SEG, 0.75, 1), 1).beginPath().arc(0, cy, rr, a0, a0 + (Math.PI * 2) / RAINBOW_SEG, false).strokePath();
        }
      }
      if (look.arc || look.fill > 0) {
        front.lineStyle(12, 0x000000, 0.4).strokeCircle(0, cy, rr);
        if (look.fill > 0) front.lineStyle(12, 0x9cf0b4, 1).beginPath().arc(0, cy, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, look.fill), false).strokePath();
      }

      // 字
      if (look.label !== labelKey) {
        labelKey = look.label;
        label.setScale(1).setText(look.label || '');
        fitText(label, d - 44);
        labelBase = label.scaleX;
      }
      label.setScale(labelBase * throb);
      if (look.ink) label.setColor(look.ink.color).setStroke(look.ink.stroke, 5);
    },
    // 今押されているか（画面の確かめ用）
    get pressed() {
      return releaseAt === null && pressAt > -Infinity;
    },
    // 指が全部離れた扱いにする（画面が裏へ回った時など）。onUp は呼ばない（呼ぶ側が自分で離す）
    releaseAll() {
      if (ids.length === 0) return;
      ids = [];
      releaseAt = Math.max(now(), pressAt + MIN_HOLD_MS);
    },
    // 指が触れた・離れたのと同じ道を通す（音・振動・沈む）：画面の確かめ用
    simulateDown(p) {
      pointerDown(p || { x, y, id: -1 });
    },
    simulateUp(p) {
      pointerUp(p || { x, y, id: -1 });
    },
    destroy() {
      scene.input.off('pointerdown', pointerDown);
      scene.input.off('pointerup', pointerUp);
      scene.input.off('pointerupoutside', pointerUp);
      back.destroy();
      face.destroy();
      front.destroy();
      label.destroy();
    },
  };
  return api;
}
