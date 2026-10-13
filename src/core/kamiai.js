// 紙相撲の強さ：心技体→型紙の重さ・起き上がり・ゲージ・決め技／敵の順番→機械のたたき方（設計書 §4）
import { newBout, step, tap, hold, gaugeLit, KAMI } from './kami.js?v=31';
import { makeRng } from './rng.js?v=31';
import { foeAt } from '../data/foes.js?v=31';
import { foeStats } from './run.js?v=31';

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const TYPE_MASS = { heavy: 1.15, yotsu: 1.05, balance: 1, tall: 0.95, small: 0.85 };

export function fighterParams(stats, type) {
  const tai = clamp01(stats.tai / 100), shin = clamp01(stats.shin / 100), gi = clamp01(stats.gi / 100);
  const tm = Object.prototype.hasOwnProperty.call(TYPE_MASS, type) ? TYPE_MASS[type] : 1;
  return {
    mass: lerp(0.8, 1.4, tai) * tm,
    right: lerp(0.002, 0.005, shin),
    standTime: lerp(1.5, 0.6, shin),
    gaugeTime: lerp(0.6, 1.4, gi),
    finisher: lerp(1.0, 2.0, gi),
    w: 90,
  };
}

// 敵の順番→たたき方の難しさ k（0＝1体目の値・1＝100体目の値）。間は折れ線（単調に増える）。
// 10/13 Ruling 5：中盤をなだらかに。両端は固定・間の点は tools/kami_tune.mjs で機械で回して決めた
// 10/13 最終の直し：決め技を参号（40体目）からに正したので、序盤の敵が弱くなった分を rate・react の点で戻した
// rate＝たたく速さ・acc＝拍の正確さ・react＝立ち合いの反応、それぞれ別の折れ線（速さが一番効くので、速さは後半まで上げない）
export const CPU_CURVE = {
  rate: [[0, 0], [19, 0.22], [39, 0.25], [59, 0.3], [79, 0.65], [99, 1]],
  acc: [[0, 0], [19, 0.1], [39, 0.15], [59, 0.49], [79, 0.93], [99, 1]],
  react: [[0, 0], [19, 0.15], [39, 0.2], [59, 0.4], [79, 0.85], [99, 1]],
};

function cpuK(c, index) {
  if (index <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (index <= c[i][0]) { const [i0, k0] = c[i - 1], [i1, k1] = c[i]; return k0 + (k1 - k0) * (index - i0) / (i1 - i0); }
  }
  return c[c.length - 1][1];
}

export function cpuParams(index) {
  const k = (name) => clamp01(cpuK(CPU_CURVE[name], index));
  return { rate: lerp(2.5, 7, k('rate')), acc: lerp(0.3, 0.8, k('acc')), react: lerp(0.45, 0.15, k('react')), finisher: index >= 40 };
}

// 機械のたたき手（主人公の自動の試しにも使う）
export function driver(p, rng) {
  let next = 0, tapped = false, gaugeAt = -1;
  return {
    tick(st, side, dt) {
      const me = st.f[side];
      if (st.phase === 'ready') {
        if (!tapped && st.t >= st.signalAt + p.react) { tap(st, side); tapped = true; }
        return;
      }
      if (st.phase !== 'push') return;
      if (me.down) { hold(st, side, true); return; }
      hold(st, side, false);
      if (gaugeLit(st, side) && p.finisher !== false) {
        if (gaugeAt < 0) gaugeAt = st.t + 0.15 + (1 - p.acc) * 0.5;
        if (st.t >= gaugeAt) { tap(st, side); gaugeAt = -1; }
        return;
      }
      gaugeAt = -1;
      if (st.t >= next) {
        const gap = (1 / p.rate) * (0.7 + 0.6 * rng());
        let at = st.t + gap;
        if (rng() < p.acc) at = Math.round(at / KAMI.BEAT) * KAMI.BEAT; // 拍に合わせる
        next = Math.max(st.t + 0.06, at);
        if (st.t > 0) tap(st, side);
      }
    },
  };
}

export function autoBout({ heroStats, foeIndex, hero, seed }) {
  const foe = foeAt(foeIndex);
  const st = newBout({ east: fighterParams(heroStats, 'balance'), west: { ...fighterParams(foeStats(foe.type, foeIndex), foe.type), canFinish: cpuParams(foeIndex).finisher }, seed });
  const rng = makeRng(seed ^ 0x9e3779b9);
  const de = driver({ ...hero, finisher: true }, rng), dw = driver(cpuParams(foeIndex), rng);
  const dt = 1 / 60;
  while (st.phase !== 'done' && st.t < 90) { de.tick(st, 'east', dt); dw.tick(st, 'west', dt); step(st, dt); }
  return { winner: st.winner, how: st.how, t: st.t };
}
