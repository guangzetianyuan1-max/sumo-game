// src/core/gaugetier.js — 決め技のゲージの色の段（20体版 Task 5・10/13）。画面から切り離した純粋な関数
// 段：1＝青・2＝赤・3＝金・4＝虹。光ってすぐ（litFrac < 0.3）が一番高く、時間がたつほど下がる
// 相性：1.5倍（よく効く）は1段上・0.7倍（効きにくい）は1段下。虹は「1.5倍かつ光ってすぐ」だけ
export const TIER_EARLY = 0.3; // ここまでが「光ってすぐ」
export const TIER_MID = 0.6; // ここまでが「まだ間に合う」

export function gaugeTier(power, litFrac) {
  const f = Number.isFinite(litFrac) ? litFrac : 1;
  const p = Number.isFinite(power) ? power : 1;
  let k = f < TIER_EARLY ? 3 : f < TIER_MID ? 2 : 1;
  if (p > 1) k += 1;
  else if (p < 1) k -= 1;
  return Math.max(1, Math.min(4, k));
}

// 段の色（帯とボタン）：4＝虹は画面の側で色を回す
export const TIER_COLOR = { 1: 0x3d8fe0, 2: 0xd9443a, 3: 0xe3c27a };
