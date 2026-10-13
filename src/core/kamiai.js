// 紙相撲の強さ：心技体→型紙の重さ・起き上がり・ゲージ・決め技／敵の順番→機械のたたき方（設計書 §4）
import { newBout, step, tap, hold, gaugeLit, KAMI, KIMETE_REACH } from './kami.js?v=35';
import { makeRng } from './rng.js?v=35';
import { foeAt } from '../data/foes.js?v=35';
import { kimeteById, affinity } from '../data/kimete.js?v=35';
import { TYPES } from '../data/types.js?v=35';
import { foeStats } from './run.js?v=35';

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// 型の重さの倍率。20体版（10/13 Task 3 直し1）：重量 1.15→1.04・四つ 1.05→1.02・小兵 0.85→1（軽さは体の低い base だけで出す）。
// 前の幅では同じ心技体の和でも小兵は易しすぎ・重量は難しすぎ、10体目（小兵）と11体目（重量）の間に壁ができた
export const TYPE_MASS = { heavy: 1.04, yotsu: 1.02, balance: 1, tall: 0.95, small: 1 };

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

// 敵の順番→たたき方の難しさ k（0＝一番易しい・1＝一番難しい）。間は折れ線（単調に増える）。
// 20体版（10/13 Task 3）：index 0〜19。1体目は100体版の1体目と同じ・20体目（大ボス）は100体版の index 59〜79 くらい
// 間の点は一生の通し（careersim.js）と tools/kami_tune.mjs で機械で回して決めた（敵の心技体の和 FOE_TOTAL と組み）
// 拍の正確さ acc と反応 react は、上げても機械はあまり強くならない（正確な拍＝高く跳ねて自分も崩れる）ので、なだらかなまま
// rate＝たたく速さ・acc＝拍の正確さ・react＝立ち合いの反応、それぞれ別の折れ線
export const CPU_CURVE20 = {
  rate: [[0, 0], [8, 0.07], [9, 0.13], [10, 0.13], [18, 0.27], [19, 0.51]], // 速さが一番効く（重量型ほど効く）：大ボスで一段上がる
  acc: [[0, 0], [19, 0.7]],
  react: [[0, 0], [19, 0.6]],
};
export const FOE_FINISHER_AT = 10; // 敵の決め技は11体目（index 10）から
// 敵の決め技の強さの倍率（index → 倍率の折れ線）。持ち始めの数体は弱めから（10体目の関門の直後に、もう1つ壁を作らない）
export const FOE_KIMETE_POWER = [[10, 0.63], [13, 1]];

function cpuK(c, index) {
  if (index <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (index <= c[i][0]) { const [i0, k0] = c[i - 1], [i1, k1] = c[i]; return k0 + (k1 - k0) * (index - i0) / (i1 - i0); }
  }
  return c[c.length - 1][1];
}

export function cpuParams(index) {
  const k = (name) => clamp01(cpuK(CPU_CURVE20[name], index));
  const finisher = index >= FOE_FINISHER_AT;
  return { rate: lerp(2.5, 7, k('rate')), acc: lerp(0.3, 0.8, k('acc')), react: lerp(0.45, 0.15, k('react')), finisher, finisherPower: finisher ? cpuK(FOE_KIMETE_POWER, index) : 0 };
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

// 主人公の決め技（id）→ 紙相撲の kimete { arch, power }。覚えていない（null・知らない id）＝決め技無し
export function heroKimeteFor(id, foeType) {
  const k = id ? kimeteById(id) : null;
  return k ? { arch: k.arch, power: affinity(k.arch, foeType) } : null;
}

// 敵の決め技：型の得意（TYPES[type].strong）のうち、決め技の系統にある最初の1つ（無ければ突き）・倍率 1
// （brief は strong[0] だが、重量型の strong[0] は oshi で系統に無いので、系統にある最初の1つを取る）
export function foeKimeteFor(foeType) {
  const t = TYPES[foeType];
  const strong = t ? t.strong : [];
  for (const a of strong) if (Object.prototype.hasOwnProperty.call(KIMETE_REACH, a)) return { arch: a, power: 1 };
  return { arch: 'tsuki', power: 1 };
}

// index 番目の敵が持つ決め技（11体目から・強さは FOE_KIMETE_POWER の倍率）。持たない＝null
export function foeKimeteAt(foeType, index) {
  const c = cpuParams(index);
  if (!c.finisher) return null;
  const k = foeKimeteFor(foeType);
  return { arch: k.arch, power: k.power * c.finisherPower };
}

// 取組の2枚の型紙（東＝主人公・西＝index 番目の敵）。本番の画面（KamiScene）と自動（autoBout）が同じこれを使う
// heroKimete＝持っていく決め技の id（null＝決め技無し・ゲージは光らない）
export function boutParams({ heroStats, foeIndex, heroKimete }) {
  const foe = foeAt(foeIndex);
  return {
    east: { ...fighterParams(heroStats, 'balance'), kimete: heroKimeteFor(heroKimete, foe.type) },
    west: { ...fighterParams(foeStats(foe.type, foeIndex), foe.type), kimete: foeKimeteAt(foe.type, foeIndex) },
  };
}

export function autoBout({ heroStats, foeIndex, hero, seed, heroKimete = 'samidare' }) {
  const { east, west } = boutParams({ heroStats, foeIndex, heroKimete });
  const st = newBout({ east, west, seed });
  const rng = makeRng(seed ^ 0x9e3779b9);
  const de = driver({ ...hero, finisher: true }, rng), dw = driver(cpuParams(foeIndex), rng);
  const dt = 1 / 60;
  while (st.phase !== 'done' && st.t < 90) { de.tick(st, 'east', dt); dw.tick(st, 'west', dt); step(st, dt); }
  return { winner: st.winner, how: st.how, t: st.t };
}
