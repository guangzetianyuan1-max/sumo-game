// しこ名を作る（上の字＋自然の字・200通り）。同じ名前を2度出さない
import { PRE, SUF, REAL_NAMES } from '../data/shikona_parts.js?v=40';

export function makeShikona(rng, taken) {
  const total = PRE.length * SUF.length;
  let k = Math.floor(rng() * total);
  for (let tries = 0; tries < total; tries++, k = (k + 7) % total) {
    const p = PRE[Math.floor(k / SUF.length)];
    const s = SUF[k % SUF.length];
    const ja = p.ja + s.ja;
    if (!taken.has(ja) && !REAL_NAMES.includes(ja)) {
      taken.add(ja);
      return { ja, en: p.en + s.en };
    }
  }
  throw new Error('no shikona left');
}

export function shikonaCandidates(rng, n, taken) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(makeShikona(rng, taken));
  return out;
}
