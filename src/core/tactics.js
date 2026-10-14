// 相手の型ごとの攻め（設計書 2026-10-14-sumo-two-buttons-and-foe-tactics-design.md §3）
// 攻めは敵（西）だけが持つ。どれも 予告 warn → 実行 act → 後始末 after → 間 gap → 次の予告。一度に1つ。
// 数字は Task 3 で強さを合わせる時に動かすので、全部ここに並べる。画面の字は i18n（tactic.<id>）。
import { makeRng } from './rng.js?v=37';
import { ON_BEAT } from './beat.js?v=37';

export const TACTIC_IDS = ['fumbari', 'hataki', 'tsuppari', 'kumi'];
export const TACTIC_START = 2.5;   // 押し合いが始まってから、最初の予告まで（秒）
export const TACTIC_MIN_WARN = 0.6; // 予告の最短（秒）＝画面を見ている人が返せる長さ
export const TACTIC_MIN_GAP = 3;    // 攻めの終わりから次の予告までの最短（秒）
export const TACTIC_LAST = 19;      // この番号（20体目＝大ボス）は4つ全部
// 体の番号で動く3つ：[1体目, 20体目]（間は直線）
// 間 gap は 10/14 Task 3 の強さ合わせで [6, 3]→[4.5, 3]（10体目のはたきが1取組に2回ほど来る＝返さない人は10体目で ふつうの人より15ポイント以上負ける）
export const TACTIC_CURVE = { warn: [0.9, 0.6], gap: [4.5, 3], power: [0.6, 1] };

// 攻めごと：warn＝予告の最短（tacticTiming の warn と大きい方）・act＝実行の秒・after＝後始末の秒・ほか＝強さの元の数
export const TACTICS = {
  // 踏ん張り：act の間は重さ×mass。くっついて（間 ≤ reach）たたくと跳ね返されてよろける。解けた後 after 秒は重さ×afterMass（act の間に跳ね返されなかった時だけ＝待った褒美）
  // mass は brief の 2.5 だと act の間の連打で 24〜77px 押せ、たたき続ける方が得だった（設計書「押されても動かない」）ので 50。afterMass は 0.6 だと種によって待つ得が 2% しかなかったので 0.5
  // 10/14 Task 3（機械に人の反応 0.3 秒）：afterMass 0.5→0.25・recoilVx 150→700。待つ得・連打の損が小さく、一生の通しでは稽古を多く積んだ返さない人の方が
  // 後ろの重量（13・18体目）に勝ちやすかった（設計書 §4：踏ん張りの敵では どれも ふつうの人が勝ちやすい）
  // 10/14 最終点検：跳ね返しの速さ recoilVx は ×強さ（1体目 0.6 倍＝420・20体目 700）。1体目で連打する人が倒れすぎていた
  fumbari: { warn: TACTIC_MIN_WARN, act: 2, after: 0.8, mass: 50, afterMass: 0.25, reach: 100, recoilVx: 700, recoilVa: 0.03 },
  // はたき：act＝構え。くっついて（間 ≤ reach）拍を外して（beatOffset ≥ beat）たたくと前へ倒され、足もとは slide×強さ÷重さ の速さで自分の後ろへ滑る・敵は back px 下がる
  // reach は 10/14 最終点検で 110→120（踏ん張りの跳ね返しを強さに比例させ、倒れた主人公への突っ張りを止めた分の強さ合わせ。返さない人が10体目で ふつうの人より15ポイント以上負ける、の余裕を戻す）
  // beat＝拍に合う幅（取組の「カン」と同じ ON_BEAT）。滑るのは slideFrom 番（10体目）から＝はたかれると、ほぼ箱の外まで滑る（本物のはたき込み）。それまでは倒れて起き上がる
  hataki: { warn: TACTIC_MIN_WARN, act: 1.2, after: 0.3, reach: 120, beat: ON_BEAT, back: 30, fallA: -1.5, slide: 4000, slideFrom: 9 },
  // 突っ張り：予告の終わりに、間 ≤ reach なら一突き（遠ければ突き損ね）＝速さ push×強さ÷重さ・浮き lift・後ろへ反る va。こらえていれば braced÷（重さ×こらえの倍率）だけ
  // push は 10/14 Task 3 で 520→1100（520 では押し戻されても困らず、予告で こらえて たたけない方が損だった）
  tsuppari: { warn: TACTIC_MIN_WARN, act: 0.3, after: 0.4, reach: 150, push: 1100, lift: 200, va: 0.05, braced: 60 },
  // 組んで寄る：間 ≤ start で予告。act の間は間 keep のまま、主人公を背中側へ carry×強さ px/秒 運ぶ（act の始めに間 > miss なら組み損ね）
  // 直近 window 秒に taps 回たたくと振りほどける・敵は stun 秒すき。10/14 Task 3：taps 5→6（ふつうの1秒4回では解けない＝速い連打が要る）・stun 0.4→0.8（振りほどいた得）
  kumi: { warn: TACTIC_MIN_WARN, act: 1.5, after: 0.4, start: 100, keep: 90, miss: 110, carry: 90, taps: 6, window: 1.2, stun: 0.8 },
};

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export const isTactic = (id) => typeof id === 'string' && has(TACTICS, id);

// 型→攻めの並び。バランスは種で4つを並べ替えて先頭2つ・20体目は4つ全部
const BY_TYPE = { heavy: 'fumbari', small: 'hataki', tall: 'tsuppari', yotsu: 'kumi' };
export function tacticsFor(type, index, seed) {
  if (index >= TACTIC_LAST) return TACTIC_IDS.slice();
  if (has(BY_TYPE, type)) return [BY_TYPE[type]];
  if (type !== 'balance') return [];
  const rng = makeRng(seed);
  const a = TACTIC_IDS.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a.slice(0, 2);
}

// 体の番号 → 予告の秒・次の攻めまでの間の秒・強さ
export function tacticTiming(index) {
  const k = clamp01((Number(index) || 0) / TACTIC_LAST);
  return {
    warn: Math.max(TACTIC_MIN_WARN, lerp(TACTIC_CURVE.warn[0], TACTIC_CURVE.warn[1], k)),
    gap: Math.max(TACTIC_MIN_GAP, lerp(TACTIC_CURVE.gap[0], TACTIC_CURVE.gap[1], k)),
    power: lerp(TACTIC_CURVE.power[0], TACTIC_CURVE.power[1], k),
  };
}
