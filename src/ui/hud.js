// src/ui/hud.js — 一発の〇と守りの長押しバーの置き場所と描き方（10/14 ボタン1つ Task 3・設計書 2026-10-14-sumo-one-button-ring-bar-design.md §3・§4）
// 本番（KamiScene）と稽古（DrillScene・Task 4）は、ここの HUD だけを読む＝稽古と本番で場所が同じ（Review Focus #4）
// 〇＝中央上：白い的の輪に、外から金の輪が縮んでくる（一押し稽古と同じ絵・同じ大きさ IPPON.startR→targetR）
// バー＝左端の縦長：下から上へたまり、上の方に緑の帯（center±half）。満タンは押しすぎ
// 形の計算（ringShape・barShape）は Phaser を使わない純粋な関数（node で試験する）。描くのは graphics を渡す drawRing・drawBar
import { IPPON, ipponRadius } from '../core/drills.js?v=52';

export const HUD = { ring: { x: 360, y: 260 }, bar: { x: 70, top: 300, h: 460, w: 46 } };
// 〇とバーそのものをさわっても、下のボタンと同じ押し・長押しになる所（最終点検の直し 1）：バー＝左端の縦長の帯（枠より広め）・〇＝中央上の円（縮み始めの金の輪より少し広め）
export const HUD_HIT = { bar: { l: 0, r: 170, top: 280, bottom: 790 }, ringR: 240 };
// 〇の中の「合」（v42 本人：一押しが ◎＝ぴったりの時だけ、〇の中に大きく一瞬。○・× では出さない・本番と一押し稽古の両方）
// size＝字の大きさ・w＝字の幅の上限（白い的の輪（半径 IPPON.targetR・線の太さ 5）の内側に余白を残して収まる幅）・ms＝出ている長さ
export const HIT_MARK = { size: 110, w: 2 * (IPPON.targetR - 14), ms: 700 };
// 縮めた〇（遊び方の見本・k 倍）の中の「合」：字は 28 より小さくしない・幅の上限も k 倍
// 連打の技の残りの回数（中央上の〇の中・v47 本人「連打の必殺技の合図が、ふだんと見分けがつかない」：前の 110 より大きく）
export const MASH_COUNT = { size: 160 };
export const hitMarkFit = (k = 1) => ({ size: Math.max(28, Math.round(HIT_MARK.size * k)), w: HIT_MARK.w * k });

// 指 p（画面の座標）が、今出ている〇かバーの上なら 'ring'・'bar'・どちらでもなければ null。出ていない〇・バー（結果が出た後・倒れている間）は さわれない
// 画面（KamiScene）はこれが null でない指を、下のボタンと同じ道（押す・長押し・離す）へ渡す
export function hudTouch(st, p, side = 'east') {
  if (!st || !p || st.phase === 'done') return null;
  const me = st.f[side];
  if (me.ring && me.ring.input !== 'mash' && Math.hypot(p.x - HUD.ring.x, p.y - HUD.ring.y) <= HUD_HIT.ringR) return 'ring'; // 連打の技の〇は左のボタンだけ
  const b = st.bar, B = HUD_HIT.bar;
  if (b && b.side === side && b.result === null && !me.down && p.x >= B.l && p.x <= B.r && p.y >= B.top && p.y <= B.bottom) return 'bar';
  return null;
}

const RING_TARGET = 0xffffff; // 的の輪（白）
const RING_GOLD = 0xe3b23c; // 縮む金の輪
const BAR_BACK = 0x141a2e;
const BAR_BAND = 0x6fcf7f; // 緑の帯
const BAR_FILL = 0xe3b23c; // たまり（金）
const BAR_FRAME = 0xe3c27a;

// 〇の形：ring＝{ from, hitAt }（計算の秒）・t＝今の秒。無ければ null
// at・k は遊び方の小さな見本だけが使う（置き場所と縮める倍率）。本番と稽古は HUD.ring・等倍
export function ringShape(ring, t, at = HUD.ring, k = 1) {
  if (!ring) return null;
  const hitMs = Math.max(1, (ring.hitAt - ring.from) * 1000);
  return { x: at.x, y: at.y, target: IPPON.targetR * k, r: ipponRadius((t - ring.from) * 1000, hitMs) * k };
}

// バーの形：bar＝{ center, half }・gauge＝今のたまり 0〜1。y は画面の座標（下の端が 0・上の端が 1）
// box は遊び方の小さな見本だけが使う。本番と稽古は HUD.bar
export function barShape(bar, gauge, box = HUD.bar) {
  if (!bar) return null;
  const { x, top, h, w } = box;
  const at = (p) => top + h * (1 - p);
  const v = Math.max(0, Math.min(1, gauge || 0));
  return { x, top, h, w, v, bandTop: at(bar.center + bar.half), bandBottom: at(bar.center - bar.half), mid: at(bar.center), fillTop: at(v) };
}

// 〇を描く（稽古の一押しと同じ線の太さと色。s.r が null なら的の輪だけ）
export function drawRing(g, s) {
  if (!s) return;
  g.lineStyle(20, RING_TARGET, 0.18).strokeCircle(s.x, s.y, s.target);
  g.lineStyle(5, RING_TARGET, 0.95).strokeCircle(s.x, s.y, s.target);
  if (s.r !== null) g.lineStyle(10, RING_GOLD, 1).strokeCircle(s.x, s.y, Math.max(2, s.r)); // r が null＝的だけ（稽古の輪と輪の間）
}

// バーを描く（稽古の長押しのゲージと同じ形：暗い下地・緑の帯・帯の真ん中の白い線・金のたまり・金の枠・今の高さの白い矢印）
export function drawBar(g, s) {
  if (!s) return;
  const { x, top, h, w } = s;
  const y0 = top + h;
  g.fillStyle(BAR_BACK, 0.85).fillRoundedRect(x - w / 2 - 6, top - 6, w + 12, h + 12, 14);
  g.fillStyle(BAR_BAND, 0.9).fillRect(x - w / 2, s.bandTop, w, s.bandBottom - s.bandTop);
  g.fillStyle(0xffffff, 0.9).fillRect(x - w / 2, s.mid - 1, w, 2);
  if (s.v > 0) g.fillStyle(BAR_FILL, 0.85).fillRect(x - w / 2 + 8, s.fillTop, w - 16, y0 - s.fillTop);
  g.lineStyle(4, BAR_FRAME, 1).strokeRoundedRect(x - w / 2 - 6, top - 6, w + 12, h + 12, 14);
  g.fillStyle(0xffffff, 1).fillTriangle(x + w / 2 + 22, s.fillTop - 10, x + w / 2 + 22, s.fillTop + 10, x + w / 2 + 6, s.fillTop); // 矢印は右側（左端は画面の外）
}

// ---- 50体版：決め技の出し方の〇（設計書 2026-10-16 §6）。〇と同じ中央上に描く（本番だけ） ----
// 連打の技：白い的の輪と、窓の残りの金の弧（上から時計回りに減る）。真ん中の残りの回数の字は画面（KamiScene）が描く
export function mashShape(ring, t, at = HUD.ring) {
  if (!ring) return null;
  const left = Math.max(0, Math.min(1, 1 - (t - ring.from) / ring.window));
  return { x: at.x, y: at.y, r: IPPON.targetR, left, n: Math.max(0, ring.need - ring.count) };
}

// 長押しの技：円いゲージ（上から時計回りにたまる）・緑の帯 band（○）・その中の濃い緑 core（◎）
export function kimeHoldShape(ring, gauge, at = HUD.ring) {
  if (!ring) return null;
  const v = Math.max(0, Math.min(1, gauge || 0));
  return { x: at.x, y: at.y, r: IPPON.targetR, v, band: [ring.center - ring.half, ring.center + ring.half], core: [ring.center - ring.half * ring.core, ring.center + ring.half * ring.core] };
}

const ARC0 = -Math.PI / 2;
const arcAt = (p) => ARC0 + 2 * Math.PI * p;
const CORE_GREEN = 0x2f9e44;

export function drawMash(g, s) {
  if (!s) return;
  g.lineStyle(20, RING_TARGET, 0.18).strokeCircle(s.x, s.y, s.r);
  g.lineStyle(5, RING_TARGET, 0.95).strokeCircle(s.x, s.y, s.r);
  if (s.left > 0) { g.lineStyle(12, RING_GOLD, 1); g.beginPath(); g.arc(s.x, s.y, s.r + 18, ARC0, arcAt(s.left), false); g.strokePath(); }
}

export function drawKimeHold(g, s) {
  if (!s) return;
  const seg = (a, b, w, color, alpha) => { g.lineStyle(w, color, alpha); g.beginPath(); g.arc(s.x, s.y, s.r, arcAt(a), arcAt(b), false); g.strokePath(); };
  g.lineStyle(22, BAR_BACK, 0.85).strokeCircle(s.x, s.y, s.r);
  seg(s.band[0], s.band[1], 22, BAR_BAND, 0.9);
  seg(s.core[0], s.core[1], 22, CORE_GREEN, 1);
  if (s.v > 0) seg(0, s.v, 10, BAR_FILL, 1);
  g.lineStyle(4, BAR_FRAME, 1).strokeCircle(s.x, s.y, s.r + 13);
}
