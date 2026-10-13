// src/core/recommend.js — 相手の情報から、お勧めの作戦表を機械で組む（純粋な関数・乱数なし）
import { KIMARITE, inGame } from '../data/kimarite.js?v=32';
import { TYPES } from '../data/types.js?v=32';
import { ARCH } from './tuning.js?v=32';
import { SCENES, ROW, canPlace, emptyStrategy, rank, scenesOf } from './strategy.js?v=32';

// 各場面の典型の組み方。弱みの when（apart 離れ／grip 組む）がこの場面で効くかを決める。mid は両方
const GRIP = { tachiai: 'apart', mid: null, edge: 'grip' };
const PUSHERS = ['oshi', 'tsuki', 'yori', 'tsuri'];

function weaknessApplies(opp, a, sc) {
  const wk = TYPES[opp]?.weak;
  if (!wk || !wk.arch.includes(a)) return false;
  if (!wk.when || sc === 'mid') return true;
  return wk.when === GRIP[sc];
}

// 今日の相手に効く手：その手の型が、手を使える場面のどれか1つで相手の弱みに当たる（作戦表の覚えた手を光らせる・10/11 本人）
export function effectiveAgainst(id, oppType) {
  const k = KIMARITE[id];
  if (!k || !inGame(id)) return false; // ゲームに無い手は光らせない
  return scenesOf(id).some((sc) => weaknessApplies(oppType, k.arch, sc));
}

function score(id, sc, myType, oppType) {
  const a = KIMARITE[id].arch;
  const kind = ARCH[a].kind;
  const oppStrong = TYPES[oppType]?.strong ?? [];
  let s = 0;
  if ((TYPES[myType]?.strong ?? []).includes(a)) s += 1.0;
  if (weaknessApplies(oppType, a, sc)) s += 1.5;
  if ((kind === 'pull' || a === 'hineri') && oppStrong.some((x) => PUSHERS.includes(x))) s += 0.8;
  if (kind === 'drive' && (oppStrong.includes('hiki') || oppStrong.includes('hineri'))) s -= 0.8;
  // 逆転は +3。先頭に据える pin と二重にしてある（pin だけでも先頭は動かない）
  if (sc === 'edge' && kind === 'reverse') s += 3;
  return s;
}

// known＝覚えた手の並び。点の高い順・同点は効き方の好みの順・それも同じなら覚えた順
export function recommendStrategy(known, myType, oppType) {
  const out = emptyStrategy();
  for (const sc of SCENES) {
    const cands = known
      .map((id, i) => ({ id, i }))
      .filter(({ id }) => canPlace(id, sc)) // canPlace＝ゲームの手（IN_GAME）で、その場面に置ける
      .map((c) => ({ ...c, s: score(c.id, sc, myType, oppType), pin: sc === 'edge' && ARCH[KIMARITE[c.id].arch].kind === 'reverse' ? 0 : 1 }));
    // 土俵際の逆転（うっちゃり）は +3 に加えて必ず先頭に据える（他の加点が重なると 3.3 まで届くため）
    cands.sort((x, y) => x.pin - y.pin || y.s - x.s || rank(sc, x.id) - rank(sc, y.id) || x.i - y.i);
    const seen = new Set();
    for (const c of cands) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out[sc].push(c.id);
      if (out[sc].length === ROW) break;
    }
  }
  return out;
}

// 女子のひとことに差し込む手：中の段、足りなければ立ち合いの段から重ならない2つ
export function recommendReason(strategy) {
  const moves = [];
  for (const id of [...strategy.mid, ...strategy.tachiai]) {
    if (!moves.includes(id)) moves.push(id);
    if (moves.length === 2) break;
  }
  return { moves };
}
