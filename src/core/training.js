// 稽古の新技の札（10/13：新技が15になり、溜まると画面からはみ出す＝早い物から3枚まで・残りは数だけ）
import { newTechIds, NEW_TECH_AT } from '../data/heroes.js?v=51';
import { STATS, atCeiling } from './run.js?v=51';
import { STAT_DRILL } from './drills.js?v=51';

export const TECH_CARD_LIMIT = 3;

export function techCards(run, limit) {
  const ids = newTechIds(run.type);
  const open = ids.filter((id) => run.unlocked.includes(id) && !run.newKnown.includes(id));
  const nextAt = NEW_TECH_AT.find((n, k) => n > run.wins && !run.unlocked.includes(ids[k]));
  return { show: open.slice(0, limit), more: Math.max(0, open.length - limit), nextAt };
}

// 稽古の勧め（v47 本人「稽古のナビがまちまち（おすすめのナビがでない）」）：必ず何か1つ勧める。画面（TrainingScene）の★と親方の一言はこれで決める
// （前の weakStat は「画面の数で一番低いのが1つだけ」の時だけ名指しした＝主人公は 8.3×3 から3つ同じに伸び、天井で 13×3 に並び直すので、ほとんど何も勧めなかった）
//   1. 解禁済みでまだ覚えていない決め技（解禁の順で最初の物）＝{ kind: 'kimete', id }
//   2. そうでなければ、今の番付の天井に着いていない心技体のうち、画面の数（四捨五入）で一番低い物（同じなら 心→技→体）＝{ kind: 'stat', stat, drill }
//   3. 3つとも天井＝{ kind: 'ceiling' }（勧めなし）
export function trainingAdvice(run) {
  const learned = Array.isArray(run.newKnown) ? run.newKnown : [];
  const unlocked = Array.isArray(run.unlocked) ? run.unlocked : [];
  const tech = newTechIds(run.type).find((id) => unlocked.indexOf(id) >= 0 && learned.indexOf(id) < 0);
  if (tech) return { kind: 'kimete', id: tech };
  let best = null;
  for (const s of STATS) {
    if (atCeiling(run, s)) continue;
    const v = Math.round(Number(run.stats[s]) || 0);
    if (best === null || v < best.v) best = { s, v };
  }
  return best ? { kind: 'stat', stat: best.s, drill: STAT_DRILL[best.s] } : { kind: 'ceiling' };
}
