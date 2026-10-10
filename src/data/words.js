// src/data/words.js — 稽古の絵に重ねる「アニメの効果文字」（10/11 本人「ぶつかるときもアニメの挿絵『バチーン！』など」）
// 絵＝assets/words/<id>.png（目録 assets/words/index.json）。無い時は言葉の表の字（word.<id>）を太い字で代わりに出す。
// 稽古の声＝assets/voice/train_<kind>.mp3（目録 assets/voice/index.json）。ここは画面を使わない部分（node で試せる）。
import { TRAININGS } from '../core/career.js?v=16';

export const WORD_IDS = ['dosun', 'bashi', 'bachiin', 'doon', 'gottsan', 'gui', 'zuzaza', 'guugu'];

// 稽古 → 出す文字（ぶつかり稽古だけ2つ：1つ目のあと 250ms で2つ目）
const WORDS = {
  shiko: ['dosun'],
  teppo: ['bashi'],
  chanko: ['gottsan'],
  waza: ['gui'],
  butsukari: ['bachiin', 'doon'],
  moushiai: ['zuzaza'],
  rest: ['guugu'],
};

// 絵が無い時の字の色（明るい色・濃い縁取りと合わせる）
export const WORD_COLOR = {
  dosun: '#ffb347', bashi: '#ffe14d', bachiin: '#ff6b57', doon: '#ff9f43',
  gottsan: '#ffd966', gui: '#7fe0a5', zuzaza: '#6fd3ff', guugu: '#b7a6ff',
};

// kind の効果文字の id の並び。n を渡すと先頭から n 個まで。知らない稽古は空（毎回新しい配列を返す）
export function wordsFor(kind, n) {
  const list = Object.prototype.hasOwnProperty.call(WORDS, kind) ? WORDS[kind] : [];
  return typeof n === 'number' ? list.slice(0, Math.max(0, n)) : list.slice();
}

// 絵の中心からの置き場（dx＝絵の幅の割合・dy＝絵の高さの割合・rot＝傾き度）。右上と左上の2か所
// 1つ目は右上・2つ目は左のやや下（同じ高さに並べると「ドーン！バチーン！」がぶつかった＝10/11 ブラウザで見た）
export const WORD_SPOTS = [
  { dx: 0.24, dy: -0.36, rot: 6 },
  { dx: -0.24, dy: 0.02, rot: -7 },
];

// i 番目の文字の置き場。稽古ごとに1つ目の側を変える（同じ稽古なら毎回同じ）
export function wordSpot(kind, i) {
  const k = Math.max(0, TRAININGS.indexOf(kind));
  return WORD_SPOTS[(k + i) % WORD_SPOTS.length];
}

// 目録（JSON の中身）から、知っている物だけを重複なく拾う。配列でない・空・壊れた中身は []
export function listedWords(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((id, i) => typeof id === 'string' && WORD_IDS.includes(id) && list.indexOf(id) === i);
}

// 声の目録：'train_shiko' でも 'shiko' でもよい。知っている稽古だけを kind で返す
export function listedVoiceKinds(list) {
  if (!Array.isArray(list)) return [];
  const kinds = list.filter((s) => typeof s === 'string').map((s) => s.replace(/^train_/, ''));
  return kinds.filter((k, i) => TRAININGS.includes(k) && kinds.indexOf(k) === i);
}
