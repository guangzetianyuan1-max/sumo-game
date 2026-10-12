// 稽古の応援と、稽古の画面の右下の助言（10/11 本人「女子は、ちゃんこと休みの際に応援。親方はそれ以外の稽古で応援」
// 「画面右下に親方また女子が現れ、アドバイスをする」）。who＝娘の id か部屋の id・key＝i18n の鍵
import { HEYA, heyaOfGuide } from '../data/heya.js?v=26';
import { TRAININGS, GAIN } from './career.js?v=26';

const DAUGHTER_KINDS = ['chanko', 'rest'];
const STATS = ['shin', 'gi', 'tai'];

// 稽古を押した後の応援の1行。count＝稽古の回数（奇数なら .1・偶数なら .2 で交互）。知らない娘・稽古は null
export function cheerKey(guide, kind, count) {
  const heya = heyaOfGuide(guide);
  if (!heya || !TRAININGS.includes(kind)) return null;
  const who = DAUGHTER_KINDS.includes(kind) ? guide : heya;
  const n = Math.abs(count) % 2 === 1 ? 1 : 2;
  return { who, key: `cheer.${who}.${kind}.${n}` };
}

// 一番低い値（同じなら 心 → 技 → 体）
export function lowestStat(stats) {
  let best = STATS[0];
  for (const s of STATS) if (stats[s] < stats[best]) best = s;
  return best;
}

// その値を一番伸ばす稽古（GAIN の表・同じなら稽古の並びの先）。部屋の得意がその値を伸ばすなら得意
export function bestTraining(stat, specialty) {
  if (GAIN[specialty] && GAIN[specialty][stat]) return specialty;
  let best = null;
  for (const kind of TRAININGS) {
    const g = GAIN[kind][stat] || 0;
    if (g > 0 && (best === null || g > GAIN[best][stat])) best = kind;
  }
  return best;
}

// 右下の助言：A 稽古を使い切った→親方「番付を見ろ」・B 疲れ7以上→娘「休もう」・C 疲れ4〜6→娘「疲れてきた」
// D それ以外→親方「一番低い値を、この稽古で」（params の stat・train は id。画面で stat.<id>・train.<id> の名前にする）
export function trainingAdvice(career) {
  const guide = career.guide;
  const heya = heyaOfGuide(guide);
  if (!heya) return null;
  if (career.trainingLeft <= 0) return { who: heya, key: `advise.${heya}.done`, params: {} };
  if (career.fatigue >= 7) return { who: guide, key: `advise.${guide}.tired`, params: {} };
  if (career.fatigue >= 4) return { who: guide, key: `advise.${guide}.tiring`, params: {} };
  const stat = lowestStat(career.stats);
  return { who: heya, key: `advise.${heya}.weak`, params: { stat, train: bestTraining(stat, HEYA[heya].specialty) } };
}
