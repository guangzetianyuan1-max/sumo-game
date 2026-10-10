// 押す（1つ上へ）と長押し（外す）の判定。1回の押しはどちらか1つだけになる。
export const LONG_PRESS_MS = 500;
export const classifyPress = (ms) => (ms >= LONG_PRESS_MS ? 'long' : 'tap');
