// src/core/pressdepth.js — 立体の大きなボタンの「押した深さ」（10/13 本人「押している感じが欲しい」・20体版 Task 5b）
// 画面から切り離した純粋な関数。押している間は SINK px 沈んだまま・離すと SPRING_MS で戻る（少し行き過ぎて戻る）
export const SINK = 14; // 沈む深さ（px・上の面が下へ）
export const DOWN_MS = 30; // 押してから底までの時間（ほぼ一瞬）
export const SPRING_MS = 80; // 離してから元の高さに戻るまでの時間
export const OVER_MAX = 3; // 戻る時に元の高さより上へ行き過ぎる大きさ（px・底まで沈んだ時）
export const MIN_HOLD_MS = 50; // ごく短いたたきでも、これだけは沈んでから戻す（画面側が使う・一瞬では見えない）
const OVER_AT = 0.6; // 戻りの時間のうち、行き過ぎの頂点に着くまでの割合

const easeOut = (s) => 1 - (1 - s) * (1 - s) * (1 - s);
const smooth = (s) => s * s * (3 - 2 * s);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// 押し始めから heldMs たった時の沈み（0〜SINK）
export function sinkAt(heldMs) {
  const h = num(heldMs);
  if (h === null || h <= 0) return 0;
  return SINK * easeOut(Math.min(1, h / DOWN_MS));
}

// heldMs ＝ 押していた長さ（押している最中は今までの長さ・離した後は離すまでの長さ）
// releasedMs ＝ 離してからの時間（まだ押している・数字でない・負の時は「押している」）
// 返す物：{ depth: 沈み 0〜SINK, over: 元の高さより上へ行き過ぎた量 0〜OVER_MAX }。描く位置のずれは depth − over（正が下）
export function pressDepth(heldMs, releasedMs) {
  const d0 = sinkAt(heldMs);
  const r = num(releasedMs);
  if (r === null || r < 0) return { depth: d0, over: 0 };
  const u = r / SPRING_MS;
  if (u >= 1 || d0 === 0) return { depth: 0, over: 0 };
  const overMax = OVER_MAX * (d0 / SINK); // 浅くしか沈まなかったたきは、行き過ぎも小さい
  const pos = u < OVER_AT
    ? d0 + (-overMax - d0) * easeOut(u / OVER_AT) // 沈みから行き過ぎの頂点へ
    : -overMax + overMax * smooth((u - OVER_AT) / (1 - OVER_AT)); // 頂点から元の高さへ
  return { depth: Math.max(0, pos), over: Math.max(0, -pos) };
}
