// 席（0＝一番上）⇄ 番付・次の場所の席・大関と横綱の条件（設計書 §1）
import { DIVISIONS, LADDER_SIZE } from '../data/ranks.js?v=9';

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

export function canBeOzeki(history, wins) {
  const last = history[history.length - 1];
  if (!last || divisionOf(last.pos).id !== 'sekiwake' && divisionOf(last.pos).id !== 'komusubi') return false;
  return last.wins >= 9 && wins >= 9 && last.wins + wins >= 21;
}

export function canBeYokozuna(history, yusho) {
  const last = history[history.length - 1];
  return !!(last && divisionOf(last.pos).id === 'ozeki' && last.yusho && yusho);
}

export function nextPos(pos, wins, losses, history, yusho = false) {
  const div = divisionOf(pos).id;
  if (div === 'yokozuna') return pos;
  if (div === 'ozeki') {
    if (canBeYokozuna(history, yusho)) return FIRST.yokozuna + 1;
    const last = history[history.length - 1];
    if (wins < losses && last && divisionOf(last.pos).id === 'ozeki' && last.wins < last.losses) return FIRST.sekiwake;
    return pos;
  }
  const step = divisionOf(pos).bouts === 7 ? 12 : 2;
  let next = clamp(pos - (wins - losses) * step);
  // 勝ち越しは東（偶数の席）・負け越しは西（奇数の席）に座る。step が偶数なので、これが無いと東西が入れ替わらない
  if (wins > losses && next % 2 === 1) next -= 1;
  if (wins < losses && next % 2 === 0) next = clamp(next + 1);
  if (div === 'sekiwake' && canBeOzeki(history, wins)) return FIRST.ozeki + 1;
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
    if (seen.has(o.pos)) continue;
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
    let row = rows.at(-1);
    if (!row || row.key !== key) rows.push((row = { key, east: null, west: null }));
    row[side] = e;
  }
  return rows;
}
