// 決め技を選ぶ（相手の情報の画面・20体版 Task 4）。画面から切り離した純粋な関数
// 覚えた決め技＝run.newKnown のうち KIMETE にある物。勧め＝recommendKimete（相性→敵の型に合う系統→相手ごとの種。v42）
// 一生の通し（careersim.bestKimete）も同じ勧めを使う＝試しと本番で同じ物を持っていく
import { KIMETE, affinity, typeFit } from '../data/kimete.js?v=46';
import { makeRng } from './rng.js?v=46';

const known = (run) => (run && Array.isArray(run.newKnown) ? run.newKnown : []);

// 覚えた決め技の id（解禁の順）
export function learnedKimete(run) {
  const nk = known(run);
  return KIMETE.filter((k) => nk.indexOf(k.id) >= 0).map((k) => k.id);
}

// 勧め（v42 本人「決め技のおすすめが五月雨突きに偏る」：前は同じ相性なら いつも解禁の早い物＝五月雨突き）。覚えていなければ null
//   1. 敵の型との相性（affinity）が一番良い物（ここは今まで通り・種で変わらない）
//   2. 相性が同じ物が並んだら、相手ごとの種（run.seed と相手の番号 foeIndex）で選ぶ。重み＝解禁の順（1・2・3・4・5：後で覚えた＝威力の高い物ほど選ばれやすい）
//      × 敵の型に合う系統なら 2（typeFit：弱みの系統か、それに近い系統。例 長身型→うっちゃり）
//   同じ記録・同じ相手なら いつも同じ物（相手の画面を開き直しても変わらない・一生の通し careersim と本番で同じ）
//   ⚠合う系統を「必ず」先にすると、長身の大ボスに いつもうっちゃりを勧め、反応の遅い人との差が kami_tune の目標（12点）を超えた＝重みにとどめた
export const pickSeed = (seed, foeIndex) => ((Math.imul(Number.isFinite(seed) ? seed | 0 : 0, 0x9e3779b1) ^ Math.imul((Number.isFinite(foeIndex) ? foeIndex | 0 : 0) + 1, 0x85ebca6b)) >>> 0);
export const pickWeight = (order, fit) => (order + 1) * (fit ? 2 : 1);
export function recommendKimete(run, foeType, foeIndex = 0) {
  const nk = known(run);
  const mine = KIMETE.map((k, order) => ({ k, order })).filter((x) => nk.indexOf(x.k.id) >= 0);
  if (!mine.length) return null;
  const aff = (x) => affinity(x.k.arch, foeType);
  const top = Math.max(...mine.map(aff));
  const ties = mine.filter((x) => aff(x) === top);
  if (ties.length === 1) return ties[0].k.id;
  const weight = (x) => pickWeight(x.order, typeFit(x.k.arch, foeType));
  const total = ties.reduce((a, x) => a + weight(x), 0);
  let r = makeRng(pickSeed(run && run.seed, foeIndex))() * total;
  for (const x of ties) { r -= weight(x); if (r < 0) return x.k.id; }
  return ties[ties.length - 1].k.id;
}

// 相手の情報の札5枚：state＝learned（覚えた・選べる）| learnable（解禁済み・稽古で覚えられる）| locked（まだ）。at＝解禁の勝ち数・aff＝相性の倍率
export function kimeteCards(run, foeType) {
  const nk = known(run);
  const unlocked = run && Array.isArray(run.unlocked) ? run.unlocked : [];
  const wins = run && Number.isFinite(run.wins) ? run.wins : 0;
  return KIMETE.map((k) => {
    const state = nk.indexOf(k.id) >= 0 ? 'learned' : unlocked.indexOf(k.id) >= 0 || wins >= k.at ? 'learnable' : 'locked';
    return { id: k.id, arch: k.arch, at: k.at, state, aff: affinity(k.arch, foeType) };
  });
}

// 取組で使う決め技：覚えている決め技の id ならそのまま・ほか（覚えていない・決め技でない・空）は null
export function chosenKimete(run, id) {
  return id && learnedKimete(run).indexOf(id) >= 0 ? id : null;
}

// 相手の画面のことねの一言（i18n の鍵と技の id）：選んだ札が勧めと違う＝選んだ技の名前（opp.picked）・勧めがある＝勧め（opp.recommend）・
// 覚えた技が無い＝稽古の案内（opp.noKimete）。10/15 バグ出し：別の札を選んでも勧めの技を語り続けた
export function coachAdvice(rec, pick) {
  if (pick && pick !== rec) return { key: 'opp.picked', tech: pick };
  if (rec) return { key: 'opp.recommend', tech: rec };
  return { key: 'opp.noKimete', tech: null };
}
