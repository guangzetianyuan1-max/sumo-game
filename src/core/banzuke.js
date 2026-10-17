// 席（0＝一番上）⇄ 番付・次の場所の席・大関と横綱の条件（設計書 §1）
import { DIVISIONS, LADDER_SIZE } from '../data/ranks.js?v=52';

const FIRST = {};
{
  let s = 0;
  for (const d of DIVISIONS) { FIRST[d.id] = s; s += d.slots; }
}

export function divisionOf(pos) {
  let s = 0;
  for (let i = 0; i < DIVISIONS.length; i++) {
    const d = DIVISIONS[i];
    if (pos < s + d.slots) return { id: d.id, index: i, firstPos: s, bouts: d.bouts };
    s += d.slots;
  }
  throw new Error(`pos out of ladder: ${pos}`);
}

export function rankParts(pos) {
  const d = divisionOf(pos);
  const k = pos - d.firstPos;
  return { division: d.id, number: Math.floor(k / 2) + 1, side: k % 2 === 0 ? 'east' : 'west' };
}

const clamp = (p) => Math.max(0, Math.min(LADDER_SIZE - 1, p));

const SANYAKU = ['sekiwake', 'komusubi'];
const inSanyaku = (pos) => SANYAKU.includes(divisionOf(pos).id);

// 大関：三役（関脇・小結）で直近3場所33勝（10/11 本物の目安に合わせた）。pos＝今の場所の席
export function canBeOzeki(history, wins, pos) {
  const n = history.length;
  if (n < 2 || !inSanyaku(pos)) return false;
  const a = history[n - 2];
  const b = history[n - 1];
  return inSanyaku(a.pos) && inSanyaku(b.pos) && a.wins + b.wins + wins >= 33;
}

export function canBeYokozuna(history, yusho) {
  const last = history[history.length - 1];
  return !!(last && divisionOf(last.pos).id === 'ozeki' && last.yusho && yusho);
}

// 大関から落ちた直後の場所（関脇）＝前の場所が大関
export const justFellFromOzeki = (pos, history) => {
  const last = history[history.length - 1];
  return divisionOf(pos).id === 'sekiwake' && !!last && divisionOf(last.pos).id === 'ozeki';
};

// 7番の段から上がる時の着地の上限＝その段の真ん中（下半分の一番上・東）
const middleOf = (d) => FIRST[d.id] + 2 * Math.floor(d.slots / 4);
const ZENSHO_UP = ['sandanme', 'jonidan', 'jonokuchi'];

export function nextPos(pos, wins, losses, history, yusho = false) {
  const here = divisionOf(pos);
  const div = here.id;
  if (div === 'yokozuna') return pos;
  if (div === 'ozeki') {
    if (canBeYokozuna(history, yusho)) return FIRST.yokozuna + 1;
    const last = history[history.length - 1];
    if (wins < losses && last && divisionOf(last.pos).id === 'ozeki' && last.wins < last.losses) return FIRST.sekiwake;
    return pos;
  }
  // 大関から落ちた直後の場所で10勝なら返り咲き（本物の決まり）
  if (justFellFromOzeki(pos, history) && wins >= 10) return FIRST.ozeki + 1;
  const seven = here.bouts === 7;
  const step = seven ? 12 : 2;
  let next = clamp(pos - (wins - losses) * step);
  const up = DIVISIONS[here.index - 1];
  if (up && seven) {
    // 7番の段から上がる時は、上の段の真ん中より上へは行かない（10/11 本人：幕下筆頭の全勝は十両8枚目の東まで）
    if (next < middleOf(up)) next = middleOf(up);
    // 三段目以下の全勝は1つ上の段へ（同じ段に残る時は上の段の一番下の枚目の東）
    if (wins === 7 && losses === 0 && ZENSHO_UP.includes(div) && next >= FIRST[up.id] + up.slots) next = FIRST[up.id] + up.slots - 2;
  } else if (up && next < FIRST[up.id]) {
    // 15番の段は1場所で1つ上の段まで（これが無いと十両の全勝で関脇まで飛んだ）
    next = FIRST[up.id];
  }
  // 勝ち越しは東（偶数の席）・負け越しは西（奇数の席）に座る。step が偶数なので、これが無いと東西が入れ替わらない
  if (wins > losses && next % 2 === 1) next -= 1;
  if (wins < losses && next % 2 === 0) next = clamp(next + 1);
  if (canBeOzeki(history, wins, pos)) return FIRST.ozeki + 1;
  // 関脇より上へは条件を満たした時だけ
  if (next < FIRST.sekiwake) next = FIRST.sekiwake;
  return next;
}

// 番付の画面の行：自分＋場所の相手から上下5人ずつ（席が近い順・同じ席の相手は1人だけ）。
// 席の順に並べ、同じ番付（地位と枚目）の東西を1行 { key, east, west } にまとめる
export function neighbourRows(career) {
  const seen = new Set([career.pos]);
  const others = [];
  for (const o of career.basho.opponents) {
    if (!o || seen.has(o.pos)) continue; // まだ決まっていない相手（幕下以下の2番目から）は出さない
    seen.add(o.pos);
    others.push(o);
  }
  const near = (list) => list.sort((a, b) => Math.abs(a.pos - career.pos) - Math.abs(b.pos - career.pos)).slice(0, 5);
  const above = near(others.filter((o) => o.pos < career.pos));
  const below = near(others.filter((o) => o.pos > career.pos));
  const me = { pos: career.pos, name: career.name, type: career.type, you: true };
  const entries = [...above, me, ...below].sort((a, b) => a.pos - b.pos);
  const rows = [];
  for (const e of entries) {
    const { division, number, side } = rankParts(e.pos);
    const key = `${division}:${number}`;
    let row = rows[rows.length - 1];
    if (!row || row.key !== key) rows.push((row = { key, east: null, west: null }));
    row[side] = e;
  }
  return rows;
}
