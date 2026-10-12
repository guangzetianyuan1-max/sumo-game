// src/data/words.js — 稽古の絵に重ねる「アニメの効果文字」（10/11 本人「ぶつかるときもアニメの挿絵『バチーン！』など」）
// 絵＝assets/words/<id>.png（目録 assets/words/index.json）。無い時は言葉の表の字（word.<id>）を太い字で代わりに出す。
// 稽古の声＝assets/voice/<言葉>/<タイプ>/train_<kind>.mp3（目録 assets/voice/index.json）。英語の絵＝assets/words/en/<id>.png（目録 en/index.json）。ここは画面を使わない部分（node で試せる）。
import { TRAININGS } from '../core/career.js?v=28';
import { TYPE_IDS } from './types.js?v=28';

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

// 声の組（言葉/タイプ）：目録 assets/voice/index.json は ["ja/balance", "en/heavy", ...]。壊れた中身・知らない組は読み飛ばす
const LANGS = ['ja', 'en'];
const validSet = (s) => {
  if (typeof s !== 'string') return false;
  const p = s.split('/');
  return p.length === 2 && LANGS.includes(p[0]) && TYPE_IDS.includes(p[1]);
};

// 使う声の組。lang/type → lang/balance → ja/type → ja/balance → null（声なし）。知らない言葉・タイプは日本語の標準へ
export function voiceSet(sets, lang, type) {
  if (!Array.isArray(sets)) return null;
  const have = sets.filter(validSet);
  const l = LANGS.includes(lang) ? lang : 'ja';
  const ty = TYPE_IDS.includes(type) ? type : 'balance';
  const order = [`${l}/${ty}`, `${l}/balance`, `ja/${ty}`, 'ja/balance'];
  const hit = order.find((k) => have.includes(k));
  return hit === undefined ? null : hit;
}

// 声の音の鍵（組に言葉とタイプが入る＝言葉やタイプが替わっても取り違えない）と、ファイルの場所
export const voiceKey = (set, kind) => `voice-${set.replace('/', '-')}-${kind}`;
export const voicePath = (set, kind) => `assets/voice/${set}/train_${kind}.mp3`;

// 言葉の絵の鍵。言葉ごと
export const wordKey = (lang, id) => `word-${lang}-${id}`;

// 効果文字の絵の選び：英語は英語の絵（assets/words/en）→日本語の絵→なし（字で代える）／日本語は日本語の絵→なし
// jaList・enList は目録（JSON の中身そのまま）
export function wordArt(lang, id, jaList, enList) {
  if (!WORD_IDS.includes(id)) return null;
  if (lang === 'en' && listedWords(enList).includes(id)) return { lang: 'en', key: wordKey('en', id), path: `assets/words/en/${id}.png` };
  if (listedWords(jaList).includes(id)) return { lang: 'ja', key: wordKey('ja', id), path: `assets/words/${id}.png` };
  return null;
}
