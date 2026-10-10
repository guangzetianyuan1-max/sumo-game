// 押す（図解を開く）と長押し（持ち上げて動かす）の判定。1回の押しはどちらか1つだけになる。
export const LONG_PRESS_MS = 500;
export const classifyPress = (ms) => (ms >= LONG_PRESS_MS ? 'long' : 'tap');

// 長押しの時間が来る前に指（マウス）がこれより動いたら、押しを取りやめる（数 px のぶれは押しのまま）
export const MOVE_CANCEL_PX = 24;
export const movedTooFar = (dx, dy) => dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX;

// 消す前の2度押し：1度目は知らせるだけ。2度目はこれ以上あとに押した時だけ数える（指1本の二重発火は数えない）
export const CONFIRM_GAP_MS = 350;
export const secondPress = (armedAt, now) => armedAt !== null && armedAt !== undefined && now - armedAt >= CONFIRM_GAP_MS;
