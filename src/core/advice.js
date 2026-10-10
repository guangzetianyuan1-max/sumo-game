// src/core/advice.js — 相手の情報の吹き出しで、案内役が言う2行を選ぶ（純粋な関数・文は i18n の表）
// 10/11 本人「すずはイケイケコメント、琴音は慎重なコメント、千鶴は中間のコメントで」
// 1行目＝相手の弱み（弱みの無いバランス型は noweak）・2行目＝不調なら疲れの一言、そうでなければ力の比べ（取組の値の合計の比）
import { TYPES } from '../data/types.js?v=17';

export const GUIDE_ADVICE = ['chizuru', 'suzu', 'kotone'];
const STRONGER = 1.15; // 自分÷相手がこれ以上なら「こっちが上」
const WEAKER = 0.87; // これ以下なら「向こうが上」

// text＝1行目に差し込む文（type・weak・strong・moves）。画面の側で今の言葉にして渡す
export function adviceKeys(guide, { oppType, mySum, oppSum, condition, text } = {}) {
  const g = GUIDE_ADVICE.includes(guide) ? guide : 'chizuru';
  const first = { key: `advice.${g}.${TYPES[oppType]?.weak ? 'weak' : 'noweak'}`, params: text };
  let second;
  if (condition === 'poor') {
    second = 'tired';
  } else {
    const ratio = oppSum > 0 ? mySum / oppSum : 1;
    second = ratio >= STRONGER ? 'stronger' : ratio <= WEAKER ? 'weaker' : 'even';
  }
  return [first, { key: `advice.${g}.${second}` }];
}
