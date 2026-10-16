// 稽古の新技の札（10/13：新技が15になり、溜まると画面からはみ出す＝早い物から3枚まで・残りは数だけ）
import { newTechIds, NEW_TECH_AT } from '../data/heroes.js?v=46';

export const TECH_CARD_LIMIT = 3;

export function techCards(run, limit) {
  const ids = newTechIds(run.type);
  const open = ids.filter((id) => run.unlocked.includes(id) && !run.newKnown.includes(id));
  const nextAt = NEW_TECH_AT.find((n, k) => n > run.wins && !run.unlocked.includes(ids[k]));
  return { show: open.slice(0, limit), more: Math.max(0, open.length - limit), nextAt };
}

// 親方が名指しする弱い所（v45b・バグ出し2：心技体が画面で 9/9/9 なのに「心が足りん！」）：画面と同じ四捨五入の値で、
// ほかの2つより低い物が1つだけある時だけ、その鍵（shin・gi・tai）。全部同じ・一番低いのが2つ並ぶ＝null（名指ししない）
export function weakStat(stats, keys = ['shin', 'gi', 'tai']) {
  const shown = keys.map((k) => Math.round(Number(stats && stats[k]) || 0));
  const low = Math.min(...shown);
  const at = shown.filter((v) => v === low);
  return at.length === 1 ? keys[shown.indexOf(low)] : null;
}
