// 取組の計算（設計書 §2）。画面には触らない。state は毎回 新しい物を返す（元を書き換えない）。
// 位置 pos：0＝真ん中・東の俵が −100・西の俵が +100。東が押すと + へ動く。
import { KIMARITE, NON_TECH } from '../data/kimarite.js?v=8';
import {
  ARCH, DEFAULT_MOVES, NOISE, EDGE_AT, OUT_AT, TURN_LIMIT, RECOVER, OKURI_BELOW, NON_TECH_P,
  COUNTER_BONUS, PUSH_RATIO_EXP,
} from './tuning.js?v=8';
import { strongBonus, weakBonus } from './wrestler.js?v=8';
import { makeRng } from './rng.js?v=8';

const other = (side) => (side === 'east' ? 'west' : 'east');
const dirOf = (side) => (side === 'east' ? 1 : -1);
const clampBal = (v) => Math.max(0, Math.min(100, v));

export function sceneFor(state, side) {
  if (state.turn === 0) return 'tachiai';
  const atEdge = side === 'east' ? state.pos <= -EDGE_AT : state.pos >= EDGE_AT;
  return atEdge ? 'edge' : 'mid';
}

export function moveOf(id) {
  return DEFAULT_MOVES[id] ?? ARCH[KIMARITE[id].arch];
}

export function usable(state, side, id) {
  const m = moveOf(id);
  if (m.kind === 'behind') return state[other(side)].bal < OKURI_BELOW;
  if (m.needs === 'apart') return state.grip === 'apart';
  if (m.needs === 'grip') return state.grip === 'grip' || !!m.reach;
  return true;
}

export function pickMove(state, side) {
  const scene = sceneFor(state, side);
  const row = state[side].strategy?.[scene] ?? [];
  for (const id of row) if (KIMARITE[id] && usable(state, side, id)) return { id, scene };
  return { id: state.grip === 'grip' ? '_shake' : '_press', scene };
}

// 読み合い：この手が引き（pull）・いなし（hineri）で、相手の手が押しに来る手（drive）なら true。
// 離れた所から組みに行くだけの手（reach）は押しではないので除く
function counters(state, id, oppId) {
  const m = moveOf(id);
  if (!(m.kind === 'pull' || KIMARITE[id]?.arch === 'hineri') || !oppId) return false;
  const o = moveOf(oppId);
  const reach = o.needs === 'grip' && state.grip === 'apart';
  return o.kind === 'drive' && !reach;
}

function score(state, side, id, rng, oppId) {
  const me = state[side];
  const opp = state[other(side)];
  const m = moveOf(id);
  const w = me.w;
  const base = m.w.shin * w.shin + m.w.gi * w.gi + m.w.tai * w.tai;
  const arch = KIMARITE[id]?.arch;
  const typeMult = 1 + (arch ? strongBonus(w, arch) + weakBonus(opp.w, arch, state.grip) : 0);
  const counter = counters(state, id, oppId) ? 1 + COUNTER_BONUS : 1;
  const mastery = 1 + 0.03 * (arch ? (w.mastery?.[id] ?? 0) : 0);
  const diff = 1 - (KIMARITE[id]?.diff ?? 0);
  const weak = m.weak ?? 1;
  const balF = 0.6 + 0.4 * (me.bal / 100);
  const noise = 1 - NOISE / 2 + rng() * NOISE;
  return base * typeMult * counter * mastery * diff * weak * balF * noise;
}

// 押し出された側の相手の決まり手（引いて自分が出たときなど）
const outKimarite = (pick, grip) => {
  const m = moveOf(pick.id);
  if (KIMARITE[pick.id] && m.kind === 'drive') return pick.id;
  return grip === 'grip' ? 'yorikiri' : 'oshidashi';
};

export function createBout(east, west) {
  return {
    turn: 0, pos: 0, grip: 'apart', done: false, winner: null, kimarite: null,
    east: { w: east.wrestler, strategy: east.strategy, bal: 100 },
    west: { w: west.wrestler, strategy: west.strategy, bal: 100 },
    log: [],
  };
}

export function stepBout(state, rng) {
  if (state.done) return state;
  const gripBefore = state.grip;
  const s = { ...state, east: { ...state.east }, west: { ...state.west } };
  const picks = { east: pickMove(s, 'east'), west: pickMove(s, 'west') };
  // 東を先に計算する（乱数の順を変えない）
  const scEast = score(s, 'east', picks.east.id, rng, picks.west.id);
  const scWest = score(s, 'west', picks.west.id, rng, picks.east.id);
  const sc = { east: scEast, west: scWest };
  const W = sc.east >= sc.west ? 'east' : 'west';
  const L = other(W);
  const margin = (sc[W] - sc[L]) / Math.max(sc[W], 1e-9);
  const dir = dirOf(W);
  const wid = picks[W].id;
  const m = moveOf(wid);
  const entry = { turn: s.turn, east: picks.east, west: picks.west, winner: W, kind: m.kind };
  let end = null;

  switch (m.kind) {
    case 'drive': {
      if (m.needs === 'grip' && s.grip === 'apart') {
        s.grip = 'grip';
        s.pos += dir * 8;
        entry.kind = 'reach';
        break;
      }
      const ratio = Math.pow(s[W].w.tai / Math.max(1, s[L].w.tai), PUSH_RATIO_EXP);
      s.pos += dir * m.push * (0.6 + margin) * ratio;
      s[L].bal = clampBal(s[L].bal - m.bal);
      s.grip = m.after;
      if (Math.abs(s.pos) >= OUT_AT) end = { winner: W, kimarite: m.outAs ?? wid };
      break;
    }
    case 'fell':
      s[L].bal = clampBal(s[L].bal - m.bal * (0.6 + margin));
      s.pos += dir * 5;
      if (s[L].bal <= m.finish) end = { winner: W, kimarite: wid };
      break;
    case 'pull':
      s[L].bal = clampBal(s[L].bal - m.bal * (0.6 + margin));
      s.pos -= dir * m.recoil;
      s.grip = 'apart';
      if (s[L].bal <= m.finish) end = { winner: W, kimarite: wid };
      else if (Math.abs(s.pos) >= OUT_AT) end = { winner: L, kimarite: outKimarite(picks[L], gripBefore) };
      break;
    case 'behind':
    case 'reverse':
      end = { winner: W, kimarite: wid };
      break;
    case 'shake':
      s.grip = 'apart';
      s[L].bal = clampBal(s[L].bal - 5);
      break;
    default:
      throw new Error(`unknown kind: ${m.kind}`);
  }

  // 引いて負けた側は呼び込んでしまう
  if (!end && moveOf(picks[L].id).kind === 'pull') {
    s.pos += dir * 10;
    s[L].bal = clampBal(s[L].bal - 8);
    if (Math.abs(s.pos) >= OUT_AT) end = { winner: W, kimarite: outKimarite(picks[W], s.grip) };
  }

  // どの手で動いても、100を越えたら出たことになる（設計書 §2）。位置の符号で出た側が決まる
  if (!end && Math.abs(s.pos) >= OUT_AT) {
    const winner = s.pos > 0 ? 'east' : 'west';
    end = { winner, kimarite: outKimarite(picks[winner], gripBefore) };
  }

  // 技でない決まり方（まれ）：体勢の低い側が負ける
  if (!end && rng() < NON_TECH_P) {
    const loser = s.east.bal === s.west.bal ? L : s.east.bal < s.west.bal ? 'east' : 'west';
    end = { winner: other(loser), kimarite: NON_TECH[Math.floor(rng() * NON_TECH.length)] };
  }

  if (!end) {
    s.east.bal = clampBal(s.east.bal + RECOVER);
    s.west.bal = clampBal(s.west.bal + RECOVER);
  }
  s.turn += 1;

  if (!end && s.turn >= TURN_LIMIT) {
    const winner = s.pos > 0 ? 'east' : s.pos < 0 ? 'west' : s.east.bal >= s.west.bal ? 'east' : 'west';
    end = { winner, kimarite: s.grip === 'grip' ? 'yorikiri' : 'oshidashi' };
    s.pos = winner === 'east' ? OUT_AT : -OUT_AT; // 上限での勝ちは、負けた側が縁の外へ押し出された形で見せる（勝ち負けは変えない）
  }

  if (end) s.pos = Math.max(-OUT_AT, Math.min(OUT_AT, s.pos));
  entry.pos = s.pos;
  entry.grip = s.grip;
  entry.bal = { east: s.east.bal, west: s.west.bal };
  if (end) {
    entry.end = end;
    s.done = true;
    s.winner = end.winner;
    s.kimarite = end.kimarite;
  }
  s.log = [...state.log, entry];
  return s;
}

export function runBout(east, west, seed) {
  const rng = makeRng(seed);
  let s = createBout(east, west);
  while (!s.done) s = stepBout(s, rng);
  return s;
}
