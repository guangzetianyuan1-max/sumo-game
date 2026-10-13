// 決め技を選ぶ（相手の情報の画面・20体版 Task 4）。画面から切り離した純粋な関数
// 覚えた決め技＝run.newKnown のうち KIMETE にある物。勧め＝その中で敵の型との相性（affinity）が一番良い物・同じなら解禁の早い物
// 一生の通し（careersim.bestKimete）も同じ勧めを使う＝試しと本番で同じ物を持っていく
import { KIMETE, affinity } from '../data/kimete.js?v=34';

const known = (run) => (run && Array.isArray(run.newKnown) ? run.newKnown : []);

// 覚えた決め技の id（解禁の順）
export function learnedKimete(run) {
  const nk = known(run);
  return KIMETE.filter((k) => nk.indexOf(k.id) >= 0).map((k) => k.id);
}

// 覚えた中で相性が一番良い物（同じなら解禁が早い物）。覚えていなければ null
export function recommendKimete(run, foeType) {
  let best = null, bestA = -1;
  for (const k of KIMETE) {
    if (known(run).indexOf(k.id) < 0) continue;
    const a = affinity(k.arch, foeType);
    if (a > bestA) { best = k.id; bestA = a; }
  }
  return best;
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
