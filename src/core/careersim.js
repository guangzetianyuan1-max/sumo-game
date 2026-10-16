// 一生の通し（50体版の強さ合わせと試験用・設計書 2026-10-16 §7）。取組は紙相撲の自動（kamiai.autoBout）
// 勝てば次の敵へ・負けたら稽古（3コマ）：解禁していて覚えていない決め技があれば、ふつうの出来（6割＝ゲージ満タン）の1コマで覚え、残りは一番低い心技体を伸ばす。
// 取組ごとに、覚えた決め技の中から相手の情報の画面の勧め（kimetepick.recommendKimete：相性→敵の型に合う系統→相手ごとの種）を持っていく。
// 最初の決め技（v47 から風車投げ）が解禁済みでも、まだ覚えていない＝最初の稽古までは決め技無しで取る
import { newRun, currentFoe, recordResult, startTraining, trainStat, trainKimete, STATS } from './run.js?v=48';
import { autoBout } from './kamiai.js?v=48';
import { recommendKimete } from './kimetepick.js?v=48';
import { PLAY_COUNT } from './ladder.js?v=48';
import { drillMult, NORMAL_SCORE } from './drills.js?v=48';
import { GATE_INDEXES } from '../data/foes.js?v=48';

export const MAX_BOUTS = 600; // 50体ぶん

// 覚えた決め技から勧めの物（無ければ null）。相手の情報の画面の勧め（kimetepick.recommendKimete）と同じ（seed＝記録の種・foeIndex＝相手の番号）
export const bestKimete = (newKnown, foeType, seed = 0, foeIndex = 0) => recommendKimete({ newKnown, seed }, foeType, foeIndex);

// 稽古の遊び（稽古の3つの遊び）の出来は「ふつう」＝倍率 1.0 で回す（強さの目標は遊ばない人の床）。番付からの自分から入る稽古は回さない
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

// 稽古だけを積む人（設計書 2026-10-16 §7「天井の効き目」）：自分から稽古（3コマ・一番低い心技体・ふつうの出来）を、心技体が伸びなくなる（今の番付の天井に着く）まで繰り返す
export const GRIND_MAX = 60;
const sum3 = (s) => s.shin + s.gi + s.tai;
export function grindToCeiling(run) {
  let r = run;
  for (let n = 0; n < GRIND_MAX; n++) {
    const before = sum3(r.stats);
    r = startTraining(r, { voluntary: true });
    while (r.training) {
      const low = STATS.reduce((a, b) => (r.stats[b] < r.stats[a] ? b : a), STATS[0]);
      r = trainStat(r, low, SIM_DRILL_MULT);
    }
    if (sum3(r.stats) <= before + 1e-9) break;
  }
  return r;
}

// opts.grind＝関門の力士（5・10…45体目）の初挑戦の前に、天井まで稽古を積む人（天井の効き目の目標）
export function careerSim(seed, hero, opts = {}) {
  let run = newRun({ type: 'balance', seed });
  let bouts = 0, trainings = 0, long = 0; // long＝40秒を超えた番の数
  const firstTry = [], firstStats = []; // index ごとの初挑戦の勝ち負けと、その時の心技体
  const boutsAt = [], kimeWarnsAt = []; // index ごとの取組の数と、敵の必殺技の予告の数（Ruling 9 の目標）
  let barTries = 0, barOks = 0; // 押し始めたバーの数と成功の数（反応の遅い人の目標）
  for (let i = 0; i < PLAY_COUNT; i++) { firstTry.push(null); firstStats.push(null); boutsAt.push(0); kimeWarnsAt.push(0); }
  let foe;
  while ((foe = currentFoe(run)) && bouts < MAX_BOUTS) {
    if (opts && opts.grind && firstTry[foe.index] === null && GATE_INDEXES.indexOf(foe.index) >= 0) run = grindToCeiling(run); // 関門の力士の初挑戦の前に天井まで稽古
    const r = autoBout({ heroStats: run.stats, foeIndex: foe.index, hero, seed: seed + bouts, heroKimete: bestKimete(run.newKnown, foe.type, run.seed, foe.index) });
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
