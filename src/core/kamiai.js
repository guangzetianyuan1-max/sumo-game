// 紙相撲の強さ：心技体→型紙の重さ・起き上がり・ゲージ・決め技／敵の順番→機械のたたき方（設計書 §4）
import { newBout, step, tap, fire, hold, gaugeLit, beatOffset, KAMI, KIMETE_REACH } from './kami.js?v=37';
import { makeRng } from './rng.js?v=37';
import { foeAt } from '../data/foes.js?v=37';
import { kimeteById, affinity } from '../data/kimete.js?v=37';
import { TYPES } from '../data/types.js?v=37';
import { foeStats } from './run.js?v=37';
import { tacticsFor, TACTICS } from './tactics.js?v=37';

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// 型の重さの倍率。20体版（10/13 Task 3 直し1）：重量 1.15→1.04・四つ 1.05→1.02・小兵 0.85→1（軽さは体の低い base だけで出す）。
// 前の幅では同じ心技体の和でも小兵は易しすぎ・重量は難しすぎ、10体目（小兵）と11体目（重量）の間に壁ができた
// 10/14（2つのボタン Task 3）：重量がいちばん重く・小兵がいちばん軽い（試験で守る）。重量 1.04→1.06・長身 0.95→0.98・小兵 1→0.95
export const TYPE_MASS = { heavy: 1.06, yotsu: 1.02, balance: 1, tall: 0.98, small: 0.95 };

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
  rate: [[0, 0], [8, 0.07], [9, 0.2], [10, 0.2], [18, 0.27], [19, 0.62]], // 速さが一番効く（重量型ほど効く）：10体目と大ボスで一段上がる（10/14：10・11体目 0.13→0.2・大ボス 0.51→0.62）
  acc: [[0, 0], [19, 0.5]], // 10/14：0.7→0.5（拍が正確すぎると高く跳ねて自分も崩れる＝少し外す方が強い。大ボスを最初の心技体で1割以下に）
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
  // counter 0＝敵は攻めに返さない（主人公は攻めを持たないので、敵が返す場面は無い）
  return { rate: lerp(2.5, 7, k('rate')), acc: lerp(0.3, 0.8, k('acc')), react: lerp(0.45, 0.15, k('react')), finisher, finisherPower: finisher ? cpuK(FOE_KIMETE_POWER, index) : 0, counter: 0 };
}

// 主人公の自動のたたき手の、攻めへの返しの正しさ（ふつう）
export const HERO_COUNTER = 0.7;
// 人の反応：合図（予告が出た・踏ん張りが解けた・組まれた）を見てから動くまでの秒（± ゆらぎ）
export const HERO_REACT = 0.3;
export const HERO_REACT_JITTER = 0.05;
export const KUMI_MASH = 6.5; // 組まれたら 1 秒にこの回数たたく（振りほどき）
const COUNTER_SEED = 0x2545f491;

// 機械のたたき手（主人公の自動の試しにも使う）
// counter（0〜1・既定 HERO_COUNTER）：相手の攻め1回ごとに crng() < counter で「返す」かを1回だけ決める。
// 返す時は、合図から 反応（HERO_REACT±ゆらぎ）の後に：
//   踏ん張り＝act はたたかず、解けた（after）のを見てから押す／はたき＝構え（act）の間は拍の上だけでたたく／
//   突っ張り＝予告を見て左を押してこらえ、act の後に離す／組み＝組まれた（act）のを見てから1秒6.5回たたく。
// crng は rng と別の流れ（返さない時は crng を使わない＝たたき方は counter に関わらず同じ）
// pressHold（秒・既定 0）：押し合いのたたきごとに、左をこの秒だけ押したままにする（画面の左ボタンと同じ：たたいてから押し続け、離す。
// 次のたたきの前には離す）。ゆっくり押す人の試し（10/14 Task 4 直し1：押したままの こらえが得にならないかを数える）
export function driver(p, rng, crng = makeRng(COUNTER_SEED)) {
  let next = 0, tapped = false, gaugeAt = -1, heldUntil = -Infinity;
  const pressHold = p.pressHold > 0 ? p.pressHold : 0;
  // 押し合いの左のたたき（pressHold があれば、離してからたたき、そのまま押し続ける）
  const press = (st, side) => {
    if (pressHold) hold(st, side, false);
    tap(st, side);
    if (pressHold) { hold(st, side, true); heldUntil = st.t + pressHold; }
  };
  let seen = null, respond = false, react = HERO_REACT, warnFrom = 0, pushedAfter = false, mashing = false;
  const counter = typeof p.counter === 'number' ? p.counter : HERO_COUNTER;
  // 今 返している相手の攻め（無い・返さない＝null）
  const answering = (st, side) => {
    const t = st.tactic;
    if (!t || t.side === side) return null;
    if (t !== seen) {
      seen = t; pushedAfter = false; mashing = false;
      warnFrom = t.phase === 'warn' ? t.from : st.t;
      respond = counter >= 1 ? true : counter <= 0 ? false : crng() < counter;
      if (respond) react = HERO_REACT + (2 * crng() - 1) * HERO_REACT_JITTER;
    }
    return respond ? t : null;
  };
  return {
    tick(st, side, dt) {
      const me = st.f[side];
      if (st.phase === 'ready') {
        if (!tapped && st.t >= st.signalAt + p.react) { tap(st, side); tapped = true; }
        return;
      }
      if (st.phase !== 'push') return;
      if (me.down) { hold(st, side, true); return; }
      const ans = answering(st, side);
      const sawWarn = ans && st.t >= warnFrom + react; // 予告を見て動ける
      // 突っ張り：予告を見たら左を押してこらえ、act の終わりまで（予告の間に押せば こらえた扱い）
      if (ans && ans.id === 'tsuppari' && (ans.phase === 'act' || (ans.phase === 'warn' && sawWarn))) { hold(st, side, true); return; }
      if (!(pressHold && st.t < heldUntil)) hold(st, side, false);
      if (gaugeLit(st, side) && p.finisher !== false) {
        if (gaugeAt < 0) gaugeAt = st.t + 0.15 + (1 - p.acc) * 0.5;
        if (st.t >= gaugeAt) { fire(st, side); gaugeAt = -1; }
        return;
      }
      gaugeAt = -1;
      if (ans && ans.id === 'fumbari') {
        if (ans.phase === 'act' && sawWarn) return; // 踏ん張りの間は待つ
        if (ans.phase === 'after' && !pushedAfter) {
          if (st.t < ans.from + react) return; // 解けたのを見るまで待つ
          pushedAfter = true; next = Math.min(next, st.t); // 見たら すぐ押す（あとは いつもの速さ）
        }
      }
      if (ans && ans.phase === 'act' && ans.id === 'kumi' && st.t >= ans.from + react) { // 組まれたのを見たら速く連打して振りほどく
        if (!mashing) { mashing = true; next = st.t; }
        if (st.t >= next) { next += 1 / KUMI_MASH; press(st, side); } // 刻みを足していく（コマの端数で遅れない）
        return;
      }
      if (ans && ans.phase === 'act' && ans.id === 'hataki' && sawWarn && st.t >= next && beatOffset(st) >= TACTICS.hataki.beat / 2) {
        next = Math.ceil(st.t / KAMI.BEAT) * KAMI.BEAT; // 拍を外しそうなら、次の拍まで待つ
        return;
      }
      if (st.t >= next) {
        const gap = (1 / p.rate) * (0.7 + 0.6 * rng());
        let at = st.t + gap;
        if (rng() < p.acc) at = Math.round(at / KAMI.BEAT) * KAMI.BEAT; // 拍に合わせる
        next = Math.max(st.t + 0.06, at);
        if (st.t > 0) press(st, side);
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

// 敵の攻めの組み合わせを選ぶ種：取組の種とは別に、敵の番号だけで決める（同じ敵はいつも同じ組み合わせ）
export const tacticSeedOf = (foeIndex) => (0x5eed7ac + Math.imul(foeIndex + 1, 0x9e3779b1)) >>> 0;
// index 番目の敵が持つ攻めの並び
export const foeTacticsAt = (foeIndex) => tacticsFor(foeAt(foeIndex).type, foeIndex, tacticSeedOf(foeIndex));

// 取組の2枚の型紙（東＝主人公・西＝index 番目の敵）。本番の画面（KamiScene）と自動（autoBout）が同じこれを使う
// heroKimete＝持っていく決め技の id（null＝決め技無し・ゲージは光らない）
export function boutParams({ heroStats, foeIndex, heroKimete }) {
  const foe = foeAt(foeIndex);
  return {
    east: { ...fighterParams(heroStats, 'balance'), kimete: heroKimeteFor(heroKimete, foe.type) },
    west: {
      ...fighterParams(foeStats(foe.type, foeIndex), foe.type), kimete: foeKimeteAt(foe.type, foeIndex),
      tactics: foeTacticsAt(foeIndex), tacticIndex: foeIndex, // 型ごとの攻め（主人公は持たない）
    },
  };
}

export function autoBout({ heroStats, foeIndex, hero, seed, heroKimete = 'samidare' }) {
  const { east, west } = boutParams({ heroStats, foeIndex, heroKimete });
  const st = newBout({ east, west, seed });
  const rng = makeRng(seed ^ 0x9e3779b9);
  const crng = makeRng((seed ^ 0x2545f491) + 0x51ed27); // 返すかどうかの乱数は別の流れ（返さない時の取組は counter に関わらず同じ）
  const de = driver({ counter: HERO_COUNTER, ...hero, finisher: true }, rng, crng), dw = driver(cpuParams(foeIndex), rng);
  const dt = 1 / 60;
  while (st.phase !== 'done' && st.t < 90) { de.tick(st, 'east', dt); dw.tick(st, 'west', dt); step(st, dt); }
  return { winner: st.winner, how: st.how, t: st.t };
}
