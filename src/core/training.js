// 稽古の新技の札（10/13：新技が15になり、溜まると画面からはみ出す＝早い物から3枚まで・残りは数だけ）
import { newTechIds, NEW_TECH_AT } from '../data/heroes.js?v=34';

export const TECH_CARD_LIMIT = 3;

export function techCards(run, limit) {
  const ids = newTechIds(run.type);
  const open = ids.filter((id) => run.unlocked.includes(id) && !run.newKnown.includes(id));
  const nextAt = NEW_TECH_AT.find((n, k) => n > run.wins && !run.unlocked.includes(ids[k]));
  return { show: open.slice(0, limit), more: Math.max(0, open.length - limit), nextAt };
}
