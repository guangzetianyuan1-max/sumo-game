// 稽古と場所の自動（10/11 本人「稽古、及び場所において、自動モードをつけてください」）
// 稽古＝親方の助言どおり（右下の助言 D と同じ選び・疲れ4以上は休み）・場所＝止めるまで1番ずつ取る
import { HEYA, heyaOfGuide } from '../data/heya.js?v=21';
import { lowestStat, bestTraining } from './cheer.js?v=21';

export const AUTO_REST_AT = 4; // 疲れがこれ以上なら休む（調子が「普通」に落ちる所）

// 次のおまかせの稽古（稽古が残っていなければ null）
export function autoTrainingChoice(career) {
  if (!career || career.trainingLeft <= 0) return null;
  if (career.fatigue >= AUTO_REST_AT) return 'rest';
  const heya = heyaOfGuide(career.guide);
  const stat = lowestStat(career.stats);
  return bestTraining(stat, heya ? HEYA[heya].specialty : null);
}

// 場所の自動の次の一歩：自動が入っていて、休場でない場所に取組が残っていれば 'bout'・ほかは 'stop'
export function nextAutoStep(career, autoFlag) {
  const b = career?.basho;
  if (!autoFlag || !b || b.kyujo === true) return 'stop';
  return b.day < b.days.length ? 'bout' : 'stop';
}
