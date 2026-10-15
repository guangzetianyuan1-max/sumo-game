// 一生の通し（20体版の強さ合わせと試験用・設計書 §5）。取組は紙相撲の自動（kamiai.autoBout）
// 勝てば次の敵へ・負けたら稽古（3コマ）：解禁していて覚えていない決め技があれば、ふつうの出来（6割＝ゲージ満タン）の1コマで覚え、残りは一番低い心技体を伸ばす。
// 取組ごとに、覚えた決め技の中から敵の型との相性（affinity）が一番良い物を持っていく（同じなら解禁の早い物）。
// 最初は五月雨突きが解禁済みでも、まだ覚えていない＝最初の稽古までは決め技無しで取る
import { newRun, currentFoe, recordResult, startTraining, trainStat, trainKimete, STATS } from './run.js?v=41';
import { autoBout } from './kamiai.js?v=41';
import { recommendKimete } from './kimetepick.js?v=41';
import { PLAY_COUNT } from './ladder.js?v=41';
import { drillMult, NORMAL_SCORE } from './drills.js?v=41';

export const MAX_BOUTS = 300;

// 覚えた決め技から、相性が一番良い物（無ければ null）。相手の情報の画面の勧め（kimetepick.recommendKimete）と同じ
export const bestKimete = (newKnown, foeType) => recommendKimete({ newKnown }, foeType);

// 稽古の遊び（20体版 Task 6）の出来は「ふつう」＝倍率 1.0 で回す（強さの目標は遊ばない人の床）。番付からの自分から入る稽古は回さない
export const SIM_DRILL_MULT = drillMult(NORMAL_SCORE);

// 負けた後の稽古（3コマ）：解禁していて覚えていない決め技を先に1コマずつ覚え、残りは一番低い心技体
export function trainAfterLoss(run) {
  let r = startTraining(run);
  while (r.training) {
    const learn = r.unlocked.find((id) => r.newKnown.indexOf(id) < 0);
    if (learn) { r = trainKimete(r, learn, NORMAL_SCORE).run; continue; } // 6割の出来＝1コマで習得（10/14 の習得ゲージの前と同じ結果）
    const low = STATS.reduce((a, b) => (r.stats[b] < r.stats[a] ? b : a), STATS[0]);
    r = trainStat(r, low, SIM_DRILL_MULT);
  }
  return r;
}

export function careerSim(seed, hero) {
  let run = newRun({ type: 'balance', seed });
  let bouts = 0, trainings = 0, long = 0; // long＝40秒を超えた番の数
  const firstTry = [], firstStats = []; // index ごとの初挑戦の勝ち負けと、その時の心技体
  const boutsAt = [], kimeWarnsAt = []; // index ごとの取組の数と、敵の必殺技の予告の数（Ruling 9 の目標）
  let barTries = 0, barOks = 0; // 押し始めたバーの数と成功の数（反応の遅い人の目標）
  for (let i = 0; i < PLAY_COUNT; i++) { firstTry.push(null); firstStats.push(null); boutsAt.push(0); kimeWarnsAt.push(0); }
  let foe;
  while ((foe = currentFoe(run)) && bouts < MAX_BOUTS) {
    const r = autoBout({ heroStats: run.stats, foeIndex: foe.index, hero, seed: seed + bouts, heroKimete: bestKimete(run.newKnown, foe.type) });
    bouts++;
    boutsAt[foe.index]++; kimeWarnsAt[foe.index] += r.kimeWarns || 0;
    barTries += r.barTries || 0; barOks += r.barOks || 0;
    if (r.t > 40) long++;
    const won = r.winner === 'east';
    if (firstTry[foe.index] === null) { firstTry[foe.index] = won; firstStats[foe.index] = run.stats; }
    run = recordResult(run, won).run;
    if (!won) { run = trainAfterLoss(run); trainings++; }
  }
  return { bouts, trainings, long, firstTry, firstStats, boutsAt, kimeWarnsAt, barTries, barOks, cleared: run.cleared, stats: run.stats };
}
