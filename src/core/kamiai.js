// 紙相撲の強さ：心技体→型紙の重さ・起き上がり・ゲージ・決め技／敵の順番→機械のたたき方（設計書 §4）
import { newBout, step, press, hold, mash, KAMI } from './kami.js?v=49';
import { kimeInputSpec } from './kimeinput.js?v=49';
import { makeRng } from './rng.js?v=49';
import { foeAt } from '../data/foes.js?v=49';
import { kimeteById, affinity } from '../data/kimete.js?v=49';
import { FOE_KIMETE } from '../data/foekimete.js?v=49';
import { foeStats } from './run.js?v=49';
import { tacticsFor, FOE_KIME_ID } from './tactics.js?v=49';

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// 型の重さの倍率。20体版（10/13 Task 3 直し1）：重量 1.15→1.04・四つ 1.05→1.02・小兵 0.85→1（軽さは体の低い base だけで出す）。
// 前の幅では同じ心技体の和でも小兵は易しすぎ・重量は難しすぎ、10体目（小兵）と11体目（重量）の間に壁ができた
// 10/14（2つのボタン Task 3）：重量がいちばん重く・小兵がいちばん軽い（試験で守る）。重量 1.04→1.06・長身 0.95→0.98・小兵 1→0.95
// v42 第2段：長身 0.98→1（大ボスの必殺技を倒さない強さに下げた分、最初の心技体の大ボスが 10% の線の上に出た＝長身の大ボスを少し重く。長身は 3・9・20体目）
// 50体版（2026-10-16 Task 7）：長身 1→0.96（長身の敵＝29・31・35・39体目で押す決め技の取組が延び、一生の40秒超が 5.6%（一生40 6.1%）＝押し出しやすく。
//   0.92・小兵 0.9 も試した＝40秒超は 4.1% まで下がるが、小兵の 3〜5体目が早く終わり必殺技の予告が 1番 0.64 回に減った＝小兵は 0.95 のまま・長身は小兵より重く）
export const TYPE_MASS = { heavy: 1.06, yotsu: 1.02, balance: 1, tall: 0.96, small: 0.95 };

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
// rate＝たたく速さ・acc＝拍の正確さ（〇とバーのずれにも使う）・react＝立ち合いの反応、それぞれ別の折れ線
// react は紙相撲の driver ではもう使っていない（ボタン1つ Task 1 から立ち合いは〇の判定）。記録と試験の値として残す
// 20体版の経緯：速さが一番効く（重量型ほど効く）：11体目と大ボスで一段上がる（10/14：10・11体目 0.13→0.2・大ボス 0.51→0.62／ボタン1つ Task 2：10体目 0.2→0.1・大ボス 0.62→0.5／Task 2b 直し：10体目 0.1→0.12・大ボス 0.5→0.44→0.38（直し2）＝必殺技が攻めの順番に入って、大ボスの初挑戦が下がった分）
//   v42：大ボス 0.38→0.41（勧めが種で変わり、うっちゃりの届く所 edgeU を広げた分、最初の心技体で大ボスに 11.7% 勝てた＝10%以下へ戻す・kami_tune 8%）
//   v42 第2段：大ボス 0.41→0.43（七つの海うっちゃりを倒さない強さ 0.45 倍にした分、最初の心技体の大ボスを 10% 以下に保つ・長身の重さと組み）
// 50体版（2026-10-16）：20体版の折れ線を番号 0〜49 へ伸ばした始めの値（10体目の段＝25体目・大ボス＝50体目）
// 50体版（2026-10-16 Task 7）：rate の大ボス [49, 0.43]→[49, 1]（1秒7回・上限）。大ボス（重量）には落雷はたき（引き＝当たれば倒す）が相性 1.5 で、
//   心技体に関わらず初挑戦 70% だった（敵の和 FOE_TOTAL は飽和・必殺技の強さ oni 0.8／1.0 は 68%）。0.6→65%・0.8→62%・1→54%（さらに TACTIC_CURVE.power）
export const CPU_CURVE = {
  rate: [[0, 0], [23, 0.07], [24, 0.12], [25, 0.2], [48, 0.27], [49, 1]],
  acc: [[0, 0], [49, 0.5]],
  react: [[0, 0], [49, 0.6]],
};
// 敵の必殺技（ボタン1つ Task 2b・設計書 §4.5・Ruling 9/10）：50体すべてが持ち（50体版）、攻めの順番で（攻め・必殺技・攻め…）予告＋バーで来て、失敗すると決まる
// FOE_KIMETE_POWER＝強さの倍率（index → 折れ線・1〜4体目は弱い＝失敗しても たいてい負けない）
// FOE_KIME_GAP＝必殺技どうしの最短の間（秒・index → 折れ線・大ボスだけ。ほかは順番の並びが間になる）
// FOE_KIME_POWER_MUL＝敵ごとの強さの倍率（農家のうっちゃりは大ボスでないので弱め）
// v42 第2段（本人「海賊が勝てない」）：大ボスの七つの海うっちゃりも 0.45 倍＝FOE_KIME.downMin（0.5）の下＝決まっても倒さない（押すだけ）。
//   決まれば ほぼ必ず負けだった＝人（返し5割）は中央の心技体で 7%。今は 15%（返し7割なら 23%）・kami_tune の初挑戦 34%→52%
// 直し2：5〜10体目 0.5〜0.63→0.6〜0.7（返さない人が8体目で ふつうの人より勝ちやすかった）
// 50体版の始めの値：1〜4体目は弱い（倒さない・0.35〜0.45）のまま・強くなる所は 20体版の割合で 0〜49 へ伸ばした。中ボス（海賊）は倒さない強さ 0.45・大ボス（鬼）は倒す強さ 0.6（Ruling R8・10/16 決め直し）
export const FOE_KIMETE_POWER = [[0, 0.35], [3, 0.45], [4, 0.6], [25, 0.7], [33, 1]];
export const FOE_KIME_GAP = [[48, 0], [49, 3.5]];
export const FOE_KIME_POWER_MUL = { farmer: 0.6, pirate: 0.45, oni: 0.6 };

function cpuK(c, index) {
  if (index <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (index <= c[i][0]) { const [i0, k0] = c[i - 1], [i1, k1] = c[i]; return k0 + (k1 - k0) * (index - i0) / (i1 - i0); }
  }
  return c[c.length - 1][1];
}

export function cpuParams(index) {
  const k = (name) => clamp01(cpuK(CPU_CURVE[name], index));
  // counter 0＝敵は攻めに返さない（主人公は攻めを持たないので、敵が返す場面は無い）。敵の必殺技は攻めの順番で来る（kami.js）＝機械が決め技の〇を押すことは無い
  return { rate: lerp(2.5, 7, k('rate')), acc: lerp(0.3, 0.8, k('acc')), react: lerp(0.45, 0.15, k('react')), counter: 0 };
}

// 主人公の自動のたたき手の、攻めへの返しの正しさ（ふつう）
export const HERO_COUNTER = 0.7;
// 人の反応：合図（予告が出た・踏ん張りが解けた・組まれた）を見てから動くまでの秒（± ゆらぎ）
export const HERO_REACT = 0.3;
export const HERO_REACT_JITTER = 0.05;
export const KUMI_MASH = 6.5; // 組まれたら 1 秒にこの回数たたく（振りほどき）
export const HERO_MASH = 6.5; // 連打の技の人の速さ（1秒の回数・組みの振りほどきと同じ・Ruling R15）
export const MASH_TAP = 0.08; // 連打の人の一押しの長さ（秒）
const COUNTER_SEED = 0x2545f491;
const RING_SEED = 0x6a09e667;
const BAR_SEED = 0x510e527f;

// 〇のずれの乱数（取組の種と側ごとに別の流れ・自動の取組と本番の画面で同じ）
export const ringRngFor = (seed, side) => makeRng((seed ^ RING_SEED) + (side === 'east' ? 0x3c6ef372 : 0x1f83d9ab));
// バーを離す時刻のずれの乱数（〇とも返す・返さないとも別の流れ）
export const barRngFor = (seed, side) => makeRng((seed ^ BAR_SEED) + (side === 'east' ? 0x9b05688c : 0x5be0cd19));

// 機械が〇を押す時刻のずれ（秒・早い＝負）。拍の正確さ acc の割合で ◎ の帯（±0.06）・残りの 6割で ○ の帯（0.08〜0.16）・ほかは外れ（0.19〜0.4）
// acc 0.5 で ◎ 5割・○ 3割・× 2割（設計書 §7 のふつうの人の目安）。rng は〇専用の流れ
// 外れ（×）は RING_EARLY の割合で早押し（Ruling 3：連打の流れで押す人は早く押して外し、一瞬すきになる。遅い外れは〇が消えるだけ＝すきが無い）
export const RING_EARLY = 0.8;
export function ringError(acc, rng) {
  const a = clamp01(acc), u = rng(), s = rng(), v = rng();
  if (u < a) return (s < 0.5 ? -1 : 1) * 0.06 * v;
  if (u < a + 0.6 * (1 - a)) return (s < 0.5 ? -1 : 1) * (0.08 + 0.08 * v);
  return (s < RING_EARLY ? -1 : 1) * (0.19 + 0.21 * v);
}

// 機械がバーを離す時刻のずれ（秒・早い＝負）：緑の真ん中を狙い、ずれは正規分布（標準偏差 BAR_SD を acc で直線に）。rng はバー専用の流れ
// acc 0.5（ふつう）で 0.12 秒。設計書 §7 の目安は成功 約6割（brief の帯 0.12→0.07 で 10体目 約6割）。強さ合わせで帯を広げた今は 10体目 約8割・後ろの小兵 約7割
export const BAR_SD = [0.18, 0.06]; // [acc 0, acc 1]
export function barError(acc, rng) {
  const u = Math.max(1e-12, rng()), v = rng();
  return lerp(BAR_SD[0], BAR_SD[1], clamp01(acc)) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// 機械のたたき手（主人公の自動の試しにも使う）
// counter（0〜1・既定 HERO_COUNTER）：相手の攻め1回ごとに crng() < counter で「返す」かを1回だけ決める。
// 返す時は：予告（バー）が出てから 反応（HERO_REACT±ゆらぎ）の後に押し始め、緑の真ん中＋barError(acc) の時刻に離す（守りは4つともバー）。
//   バーに失敗した後も：踏ん張り＝act はたたかず、解けた（after）のを見てから押す／組み＝組まれた（act）のを見てから1秒6.5回たたく。
// 返さない時はバーを押さない（バーの間は押しても跳ねないので、押さずに待つ）。
// crng は rng と別の流れ（返さない時は crng を使わない＝たたき方は counter に関わらず同じ）
// 〇（立ち合い・決め技）が出たら、hitAt＋ringError(acc) の時刻に1回だけ押す（〇の間はほかに押さない）。rrng＝〇のずれ・brng＝バーのずれの別の流れ
// pressHold（秒・既定 0）：押し合いのたたきごとに、ボタンをこの秒だけ押したままにする（画面と同じ：たたいてから押し続け、離す。
// 次のたたきの前には離す）。ゆっくり押す人の試し（ボタン1つ Task 2：押したままの指はバーをためない・得も損もしないことを数える）
// reaction（秒・既定 HERO_REACT）：見てから動くまでの秒（± ゆらぎ）。反応の遅い人の試し（最終点検の直し 2：0.8 秒でも押し始めた押しは緑に届く）
// masher（既定 false）：連打の人＝バーを気にせず、予告の間もいつもの速さでたたき続ける（一押しは MASH_TAP 秒押して離す）。返さない人（counter 0）と同じく負けやすいことを数える（Ruling 5）
export function driver(p, rng, crng = makeRng(COUNTER_SEED), rrng = makeRng(RING_SEED), brng = makeRng(BAR_SEED)) {
  let next = 0, heldUntil = -Infinity, ringSeen = null, ringAt = Infinity, barFrom = null, barAt = Infinity;
  let mashNext = Infinity, mashStart = false, holdAt = Infinity, releaseAt = null; // 決め技の出し方（連打の次の一打・数える連打に入ったか・長押しの押し始めと離す時刻）
  const reaction = typeof p.reaction === 'number' ? p.reaction : HERO_REACT;
  const mashRate = p.mashRate > 0 ? p.mashRate : HERO_MASH; // 連打の技の速さ（連打の人 masher も人の速さ＝p.rate は使わない）
  const pressHold = p.pressHold > 0 ? p.pressHold : p.masher ? MASH_TAP : 0;
  // 押し合いのたたき（pressHold があれば、離してからたたき、そのまま押し続ける）
  const hit = (st, side) => {
    if (pressHold) hold(st, side, false);
    press(st, side);
    if (pressHold) { hold(st, side, true); heldUntil = st.t + pressHold; }
  };
  // 〇が出ていれば true。一押し＝押す時刻に1回・連打の技＝反応の後に人の速さで数える・長押しの技＝反応の後に押し始め、緑の真ん中＋ずれで離す（Ruling R15）
  const onRing = (st, side) => {
    const r = st.f[side].ring;
    if (!r) return false;
    if (r !== ringSeen) {
      ringSeen = r; ringAt = r.hitAt + ringError(p.acc, rrng);
      mashNext = r.from + reaction; mashStart = false; holdAt = r.from + reaction; releaseAt = null;
    }
    if (r.kind === 'kime' && p.finisher === false) return true; // 決め技を使わない＝〇は見送る
    if (r.input === 'mash') {
      // v47 直し1（点検）：人の真似＝光ったのに気づくまで（reaction）は いつもの速さで たたき続け（数えない）、気づいたら rearm 秒止めてから数える連打に入る
      if (st.t < r.from + reaction) {
        if (st.t >= next) { mash(st, side); next = st.t + 1 / p.rate; }
        return true;
      }
      if (!mashStart) { mashStart = true; mashNext = Math.max(st.t, st.f[side].tapAt) + (r.rearm || 0); } // 気づいた時（と最後のたたき）から rearm 秒止める
      if (st.t >= mashNext - 1e-9) { mash(st, side); mashNext += 1 / mashRate; } // 刻みを足していく（コマの端数で遅れない）
      return true;
    }
    if (r.input === 'hold') {
      if (r.heldFrom === null) { if (st.t >= holdAt) { hold(st, side, false); hold(st, side, true); } } // 押したままの指は一度離して押し直す
      else {
        if (releaseAt === null) releaseAt = r.heldFrom + r.fillMs * r.center / 1000 + barError(p.acc, brng);
        if (st.t >= releaseAt) hold(st, side, false);
      }
      return true;
    }
    if (st.t >= ringAt) press(st, side);
    return true;
  };
  let seen = null, respond = false, react = HERO_REACT, pushedAfter = false, mashing = false;
  const counter = typeof p.counter === 'number' ? p.counter : HERO_COUNTER;
  // 今 返している相手の攻め（無い・返さない＝null）
  const answering = (st, side) => {
    const t = st.tactic;
    if (!t || t.side === side) return null;
    if (t !== seen) {
      seen = t; pushedAfter = false; mashing = false;
      respond = counter >= 1 ? true : counter <= 0 ? false : crng() < counter;
      if (respond) react = reaction + (2 * crng() - 1) * HERO_REACT_JITTER;
    }
    return respond ? t : null;
  };
  return {
    tick(st, side, dt) {
      const me = st.f[side];
      if (st.phase === 'ready') { onRing(st, side); return; } // 立ち合い＝〇だけ（合図の前は押さない）
      if (st.phase !== 'push') return;
      if (me.down) { hold(st, side, true); return; }
      const ans = answering(st, side);
      const b = st.bar;
      if (b && b.side === side && b.result === null && !(p.masher && !ans)) { // 守りのバー（相手の攻めの予告の間）。連打の人は気にせず たたき続ける
        if (ans && b.heldFrom === null && st.t >= b.from + react) { // 見てから押し始める（押したままの指は一度離す）
          hold(st, side, false); hold(st, side, true); // 予告から BAR.react 秒より前の押しは数えられない＝次のコマで押し直す
        } else if (ans && b.heldFrom !== null) {
          if (b.heldFrom !== barFrom) { barFrom = b.heldFrom; barAt = b.heldFrom + b.fillMs * b.center / 1000 + barError(p.acc, brng); } // 押せた時に離す時刻を決める
          if (st.t >= barAt) hold(st, side, false); // 緑の真ん中（＋ずれ）で離す
        }
        else if (!ans && !(pressHold && st.t < heldUntil)) hold(st, side, false);
        return; // バーの間は押しても跳ねない＝ほかに押さない
      }
      if (me.ring && me.ring.input === 'hold') { onRing(st, side); return; } // 長押しの技の〇：ためている指を毎コマ離さない（下の離す行より先）
      if (!(pressHold && st.t < heldUntil)) hold(st, side, false);
      if (onRing(st, side)) return; // 決め技の〇の間は、ほかに押さない（押すと〇の判定になる）
      if (ans && ans.id === 'fumbari') {
        if (ans.phase === 'act') return; // バーに失敗した踏ん張りの間は待つ（跳ね返される）
        if (ans.phase === 'after' && !pushedAfter) {
          if (st.t < ans.from + react) return; // 解けたのを見るまで待つ
          pushedAfter = true; next = Math.min(next, st.t); // 見たら すぐ押す（あとは いつもの速さ）
        }
      }
      if (ans && ans.phase === 'act' && ans.id === 'kumi' && st.t >= ans.from + react) { // 組まれたのを見たら速く連打して振りほどく
        if (!mashing) { mashing = true; next = st.t; }
        if (st.t >= next) { next += 1 / KUMI_MASH; hit(st, side); } // 刻みを足していく（コマの端数で遅れない）
        return;
      }
      if (st.t >= next) {
        const gap = (1 / p.rate) * (0.7 + 0.6 * rng());
        let at = st.t + gap;
        if (rng() < p.acc) at = Math.round(at / KAMI.BEAT) * KAMI.BEAT; // 拍に合わせる
        next = Math.max(st.t + 0.06, at);
        if (st.t > 0) hit(st, side);
      }
    },
  };
}

// 主人公の決め技（id）→ 紙相撲の kimete { arch, power, input }。input＝その取組の出し方の数（敵の番号で厳しく・src/core/kimeinput.js）。覚えていない（null・知らない id）＝決め技無し
export function heroKimeteFor(id, foeType, foeIndex = 0) {
  const k = id ? kimeteById(id) : null;
  return k ? { arch: k.arch, power: affinity(k.arch, foeType), input: kimeInputSpec(k.input, foeIndex) } : null;
}

// index 番目の敵の必殺技 { id, arch, power, gap }：名前と系統は data/foekimete.js・強さと間は番号の折れ線（50体すべて）
export function foeKimeteAt(index) {
  const foe = foeAt(index), k = FOE_KIMETE[foe.id];
  const mul = Object.prototype.hasOwnProperty.call(FOE_KIME_POWER_MUL, foe.id) ? FOE_KIME_POWER_MUL[foe.id] : 1;
  return { id: k.id, arch: k.arch, power: cpuK(FOE_KIMETE_POWER, index) * mul, gap: cpuK(FOE_KIME_GAP, index) };
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
    east: { ...fighterParams(heroStats, 'balance'), kimete: heroKimeteFor(heroKimete, foe.type, foeIndex) },
    west: {
      ...fighterParams(foeStats(foe.type, foeIndex), foe.type), kimete: foeKimeteAt(foeIndex),
      tactics: foeTacticsAt(foeIndex), tacticIndex: foeIndex, // 型ごとの攻め（主人公は持たない）
    },
  };
}

export function autoBout({ heroStats, foeIndex, hero, seed, heroKimete = 'samidare' }) {
  const { east, west } = boutParams({ heroStats, foeIndex, heroKimete });
  const st = newBout({ east, west, seed });
  const rng = makeRng(seed ^ 0x9e3779b9);
  const crng = makeRng((seed ^ 0x2545f491) + 0x51ed27); // 返すかどうかの乱数は別の流れ（返さない時の取組は counter に関わらず同じ）
  // 〇のずれも別の流れ（主人公と敵で別）
  const de = driver({ counter: HERO_COUNTER, ...hero, finisher: true }, rng, crng, ringRngFor(seed, 'east'), barRngFor(seed, 'east'));
  const dw = driver(cpuParams(foeIndex), rng, undefined, ringRngFor(seed, 'west'), barRngFor(seed, 'west'));
  const dt = 1 / 60;
  let kimeWarns = 0, seen = null; // 敵の必殺技の予告の数（強さ合わせの目標：どの敵も1番に0.7回以上・Ruling 9）
  let barTries = 0, barOks = 0, barSeen = null; // 主人公が押し始めたバーの数と、その成功の数（反応の遅い人の目標・最終点検の直し 2）
  while (st.phase !== 'done' && st.t < 90) {
    de.tick(st, 'east', dt); dw.tick(st, 'west', dt); step(st, dt);
    if (st.tactic && st.tactic !== seen && st.tactic.id === FOE_KIME_ID) { seen = st.tactic; kimeWarns++; }
    const b = st.bar;
    if (b && b !== barSeen && b.side === 'east' && b.result !== null) { barSeen = b; if (b.heldFrom !== null) { barTries++; if (b.result === 'ok') barOks++; } }
  }
  return { winner: st.winner, how: st.how, t: st.t, kimeWarns, barTries, barOks };
}
