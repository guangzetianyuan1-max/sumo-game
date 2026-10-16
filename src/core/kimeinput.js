// 取組の決め技の出し方（設計書 2026-10-16-sumo-50-foes-design.md §6・Ruling R1〜R4）：技ごとに 連打（mash・左）・長押し（hold・右で緑で離す）・一押し（tap・右で〇）。
// 難しさは敵の番号 0〜49 でなだらかに（連打の回数は増え・長押しの緑と一押しの〇の当たりの幅は狭く）。数は強さ合わせ（tools/kami_tune.mjs）で動かしてよい
// 判定の段は今の〇と同じ（2＝◎・1＝○・0＝×）。画面と Phaser から切り離した純粋な関数
import { ipponJudge } from './drills.js?v=46';
import { BAR } from './tactics.js?v=46';

export const KIME_INPUTS = ['tap', 'mash', 'hold'];
export const KIME_INPUT = {
  last: 49, // 50体目の番号（ladder.js の PLAY_COUNT − 1・試験で確かめる）
  // 連打：window 秒の内に need 回（1体目→50体目）・窓の good の割合までに届けば ◎（Ruling R2）
  // Task 7（強さ合わせ）：need [5, 10]→[4, 8]。人の速さ（見てから0.3秒・1秒6.5回）では 9回目が 1.53 秒＝◎（1.5 秒）に届かず、37体目からは ○ だけ。
  // ○ の押す決め技は重い敵を押し出せず、取組の40秒超が 14%（目標 5%以下）・四つの敵（40・42・46体目）が壁だった（tests/kimeinput.test.js の「人の速さで ◎ に届く」）
  mash: { window: 2.0, need: [4, 8], good: 0.75 },
  // 長押し：fillMs で満タン・緑＝center ± half×scale（1体目→50体目）・その中の half×core の内＝◎・limit 秒 押さなければ消える（Ruling R1・R3・R4）
  hold: { fillMs: 1500, center: 0.75, half: BAR.half[0], scale: [1, 0.7], core: 0.5, limit: 3.0 },
  // 一押し：今の〇の当たりの幅（◎±70ms・○±170ms）に掛ける倍率（1体目→50体目）
  tap: { scale: [1, 0.7] },
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, k) => a + (b - a) * k;

// 敵の番号 → 0〜1（範囲の外は端・数でない値は 0）
export function kimeK(foeIndex) {
  const i = Number(foeIndex);
  return Number.isFinite(i) ? clamp01(i / KIME_INPUT.last) : 0;
}

// 出し方と敵の番号 → その取組の数。知らない出し方は一押し
export function kimeInputSpec(input, foeIndex) {
  const k = kimeK(foeIndex);
  if (input === 'mash') {
    const m = KIME_INPUT.mash;
    return { input: 'mash', window: m.window, need: Math.round(lerp(m.need[0], m.need[1], k)), good: m.good };
  }
  if (input === 'hold') {
    const h = KIME_INPUT.hold;
    return { input: 'hold', fillMs: h.fillMs, center: h.center, half: h.half * lerp(h.scale[0], h.scale[1], k), core: h.core, limit: h.limit };
  }
  return { input: 'tap', scale: lerp(KIME_INPUT.tap.scale[0], KIME_INPUT.tap.scale[1], k) };
}

// 一押し：ずれ（ms）を幅の倍率で割ってから今の判定（倍率 1 なら今と同じ・壊れた倍率は 1）
export const tapJudge = (offsetMs, scale) => ipponJudge(offsetMs / (scale > 0 ? scale : 1));

// 連打：count 回目が光ってから elapsed 秒で届いた時の判定
export function mashJudge(count, need, elapsed, window, good) {
  if (!(count >= need) || !(elapsed <= window + 1e-9)) return 0;
  return elapsed <= window * good + 1e-9 ? 2 : 1;
}

// 長押し：離した時のゲージ g（0〜1）の判定。満タン（1 以上）と数でない値は 0
export function holdJudge(g, center, half, core) {
  if (!Number.isFinite(g) || g >= 1) return 0;
  const d = Math.abs(g - center);
  if (d <= half * core + 1e-9) return 2;
  return d <= half + 1e-9 ? 1 : 0;
}
