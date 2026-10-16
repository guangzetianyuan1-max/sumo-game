// src/core/whine.js — 「ギュイーン」（上がっていく機械の唸り）を、いつ・どの高さで鳴らすかだけを決める（音を作るのは src/ui/sfx.js の whine）
// v43 本人「一押しの〇が小さくなる時、長押しのゲージが上がる時に『ギュイーン』の音」：
//   一押しの〇（立ち合い・決め技・一押し稽古）＝縮みに合わせて音程が上がる（出てから重なる時まで 0→1・重なった後も少しだけ上がる＝over まで）・押したら止む
//   守りのバー（取組・長押し稽古）＝長押しで上がるバーの高さに合わせて音程が上がる（0→1）・離したら止む
// 返すのは進み p（0〜over）か null（鳴らさない）。画面は毎コマこれを sfx の whine(p) へ渡す（null＝止める）
export const WHINE = {
  over: 1.15, // 〇が的の輪に重なった後も、外れになるまで少しだけ上がる（重なる時＝1）
  lo: 160, // p＝0 の高さ（Hz）
  hi: 640, // p＝1 の高さ（Hz・2オクターブ上）
  peak: 0.06, // 音量の山（声 0.7・ほかの効果音 0.1〜0.3 より小さく・ずっと鳴る音なので控えめ）
  hang: 0.25, // 最後に whine(p) を呼んでから、この秒で自然に消える（画面が止まった・裏へ回った時に鳴り残らない）
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 進み p → 高さ（Hz）：2倍ずつ同じ間隔で上がる（耳には まっすぐ上がって聞こえる）
export function whineFreq(p) {
  const k = clamp(Number.isFinite(p) ? p : 0, 0, WHINE.over);
  return WHINE.lo * Math.pow(WHINE.hi / WHINE.lo, k);
}

// 〇の進み：出た時刻 from から重なる時刻 hitAt まで 0→1（同じ単位なら秒でも ms でもよい）
export function ringProgress(from, hitAt, now) {
  const span = hitAt - from;
  if (!(span > 0) || !Number.isFinite(now)) return null;
  return clamp((now - from) / span, 0, WHINE.over);
}

// 取組（kami.js の st）：主人公の〇が出ている間＝〇の進み（連打の技の〇＝鳴らさない・長押しの技の〇＝ためている間だけバーと同じ高さ）／守りのバーを長押しでためている間＝バーの高さ。ほか・終わり・倒れている間＝null
// barGauge は kami.js の barGauge（循環を作らないように呼ぶ側が渡す）
export function boutWhine(st, barGauge, side = 'east') {
  if (!st || st.phase === 'done' || !st.f || !st.f[side]) return null;
  const me = st.f[side];
  if (me.down || me.fell) return null;
  if (me.ring) {
    const r = me.ring;
    if (r.input === 'mash') return null; // 連打の技の〇は唸らない（回数の字と連打の音）
    if (r.input === 'hold') return r.heldFrom === null ? null : clamp((st.t - r.heldFrom) * 1000 / r.fillMs, 0, 1); // 長押しの技はバーと同じ
    return ringProgress(r.from, r.hitAt, st.t);
  }
  const b = st.bar;
  if (b && b.side === side && b.result === null && b.heldFrom !== null) return clamp(barGauge(st), 0, 1);
  return null;
}
