// 節目で技を覚える（10/12 作り直し・本人「節目で1つ覚える」）。従来の技は 勝ち越し・十両昇進・幕内昇進 で3つから1つ選ぶ
import { IN_GAME, KIMARITE } from '../data/kimarite.js?v=30';
import { TYPES } from '../data/types.js?v=30';
import { divisionOf } from './banzuke.js?v=30';

const JURYO = 5; // divisionOf の段の番号（0＝横綱・4＝前頭・5＝十両）＝ basho.js の LEVEL と同じ
const MAKUUCHI = 4;

// 場所の締めの節目：初めて十両・幕内に上がった時はその節目、それ以外で勝ち越したら勝ち越し。負け越しは無し
export function milestone(fromPos, toPos, wins, losses, history = []) {
  const to = divisionOf(toPos).index;
  const best = Math.min(divisionOf(fromPos).index, ...history.map((h) => divisionOf(h.pos).index));
  if (to <= MAKUUCHI && best > MAKUUCHI) return 'makuuchi';
  if (to <= JURYO && best > JURYO) return 'juryo';
  return wins > losses ? 'kachikoshi' : null;
}

// 覚える候補：覚えていないゲームの手から最大3つ。タイプの見本の手と同じ系統（group）を先に2つまで、残りは全体から種で選ぶ
export function learnChoices(career, rng) {
  const left = IN_GAME.filter((id) => !career.known.includes(id));
  const groups = new Set(TYPES[career.type].sample.map((id) => KIMARITE[id].group));
  const near = left.filter((id) => groups.has(KIMARITE[id].group));
  const far = left.filter((id) => !groups.has(KIMARITE[id].group));
  const pick = (arr, n) => {
    const a = [...arr];
    const out = [];
    while (a.length && out.length < n) out.push(a.splice(Math.floor(rng() * a.length), 1)[0]);
    return out;
  };
  const first = pick(near, 2);
  return [...first, ...pick([...near.filter((id) => !first.includes(id)), ...far], 3 - first.length)];
}

// 候補の手を覚える（候補に無い手は何もしない＝同じ物を返す）
export function learnMove(career, id) {
  if (!Array.isArray(career.pendingLearn) || !career.pendingLearn.includes(id)) return career;
  return { ...career, known: [...career.known, id], pendingLearn: null, learnKind: null };
}
