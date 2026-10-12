// 勝ち抜きの試運転（強さ合わせと試験用）。取組は自動（お勧めの作戦表）
// train: true＝負けたら毎回稽古（3コマとも一番低い値）してから挑み直す／false＝稽古なしで挑み直す（同じ相手に MAX_TRIES 回負けたら行き詰まり）
import { newRun, currentFoe, recordResult, startTraining, trainStat, STATS } from './run.js?v=30';
import { makeWrestler } from './wrestler.js?v=30';
import { runBout } from './bout.js?v=30';
import { recommendStrategy } from './recommend.js?v=30';
import { defaultStrategy } from './strategy.js?v=30';
import { TYPES } from '../data/types.js?v=30';
import { learnMove } from './learn.js?v=30';
import { makeRng } from './rng.js?v=30';

const MAX_TRIES = 10;
const MAX_BOUTS = 2000;

export function autoplayRun(seed, type, { train }) {
  let r = newRun({ guide: 'kotone', type, seed });
  const rng = makeRng(seed);
  let bouts = 0;
  let trainings = 0;
  let foe;
  while ((foe = currentFoe(r)) && bouts < MAX_BOUTS) {
    const me = makeWrestler(r.type, { ...r.stats, known: r.known });
    const them = makeWrestler(foe.type, foe.stats);
    const res = runBout({ wrestler: me, strategy: recommendStrategy(r.known, r.type, foe.type) },
      { wrestler: them, strategy: defaultStrategy(TYPES[foe.type].sample, foe.type) }, Math.floor(rng() * 1e9));
    bouts++;
    r = recordResult(r, res.winner === 'east').run;
    if (r.pendingLearn) r = learnMove(r, r.pendingLearn[0]);
    if (r.streak > 0) {
      if (!train && r.streak >= MAX_TRIES) return { cleared: false, bouts, trainings, stuckAt: r.wins };
      if (train) {
        r = startTraining(r);
        trainings++;
        while (r.training) {
          const low = STATS.reduce((a, b) => (r.stats[b] < r.stats[a] ? b : a), STATS[0]);
          r = trainStat(r, low);
        }
      }
    }
  }
  return { cleared: r.cleared, bouts, trainings, stuckAt: r.wins };
}
