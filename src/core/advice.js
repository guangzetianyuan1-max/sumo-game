// src/core/advice.js — 相手の情報の吹き出しで、案内役が言う2行を選ぶ（純粋な関数・文は i18n の表）
// 10/11 本人「すずはイケイケコメント、琴音は慎重なコメント、千鶴は中間のコメントで」
// 1行目＝相手の弱み（弱みの無いバランス型は noweak）・2行目＝不調なら疲れの一言、そうでなければ力の比べ（取組の値の合計の比）
import { TYPES } from '../data/types.js?v=20';
import { heyaOfGuide } from '../data/heya.js?v=20';
import { canPlace } from './strategy.js?v=20';
import { effectiveAgainst, recommendStrategy } from './recommend.js?v=20';

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

// 取組の後の右下の一言（10/11 本人「勝敗後、画面右下にコメントをつけてください。勝：女子に祝福される。負：親方の敗因分析。」
// 「負けたときの親方は、心技体の不足部分、技の選択ミスの指摘をする。」）
// 勝ち＝娘の1行（n＝何番目の取組か・奇数 .1／偶数 .2）。負け＝親方の2つ：
//  ① 心技体：my（自分は調子を掛けた値）と opp の差の一番大きい値（同じなら 心→技→体）→ stat・どれも負けていなければ even
//  ② 技の選び：log の最後（決めの一合）の場面と自分の手・相手の決まり手。お勧め＝覚えた手（known）のうち今日の相手に効き
//     その場面に置ける手（お勧めの作戦表の順が先）・無ければお勧めの作戦表のその場面の先頭。お勧めが出した手と同じ（か無い）なら keep
// params は id のまま（画面で stat.<id>・scene.<id>・手の名前にする）。知らない娘は null
const STATS = ['shin', 'gi', 'tai'];

function statPart(heya, my, opp) {
  let stat = null;
  let gap = 0;
  for (const s of STATS) {
    const d = opp[s] - my[s];
    if (d > gap) {
      gap = d;
      stat = s;
    }
  }
  return stat ? { key: `bout.lose.${heya}.stat`, params: { stat } } : { key: `bout.lose.${heya}.even`, params: {} };
}

function movePart(heya, last, kimarite, known, myType, oppType) {
  const scene = last.east.scene;
  const mine = last.east.id;
  const top = recommendStrategy(known, myType, oppType)[scene] || [];
  let good = null;
  for (const id of [...top, ...known]) {
    if (canPlace(id, scene) && effectiveAgainst(id, oppType)) {
      good = id;
      break;
    }
  }
  if (good === null && top.length) good = top[0];
  if (good === null || good === mine) return { key: `bout.lose.${heya}.keep`, params: { scene, mine } };
  return { key: `bout.lose.${heya}.move`, params: { scene, mine, theirs: kimarite, good } };
}

export function boutComment({ won, log, kimarite, my, opp, known = [], myType, oppType, guide, n }) {
  const heya = heyaOfGuide(guide);
  if (!heya) return null;
  if (won) return { who: guide, keys: [{ key: `bout.win.${guide}.${Math.abs(n) % 2 === 1 ? 1 : 2}`, params: {} }] };
  const keys = [statPart(heya, my, opp)];
  const last = Array.isArray(log) && log.length ? log[log.length - 1] : null;
  if (last && last.east) keys.push(movePart(heya, last, kimarite, known, myType, oppType));
  return { who: heya, keys };
}
