// 言葉の切り替えと文の引き方。画面の文字は全部ここを通す。
import ja from './ja.js';
import en from './en.js';
import { KIMARITE } from '../data/kimarite.js';

export const TABLES = { ja, en };
export const LANGS = ['ja', 'en'];
const KEY = 'sumo.lang';
let lang = 'ja';

export const getLang = () => lang;

export function detectLang(navLang) {
  return String(navLang ?? '').toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function loadLang(storage) {
  try {
    const v = storage?.getItem(KEY);
    return LANGS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

export function setLang(l, storage) {
  if (!LANGS.includes(l)) return;
  lang = l;
  try {
    storage?.setItem(KEY, l);
  } catch {
    // 保存できない端末でも、切り替えそのものは効かせる
  }
}

export function initLang(storage, navLang) {
  lang = loadLang(storage) ?? detectLang(navLang);
  return lang;
}

export function t(key, vars = {}, l = lang) {
  const s = TABLES[l]?.[key] ?? TABLES.ja[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

// 手の名前：82手は表から（日本語は漢字・英語はローマ字）、既定の動きと技でない決まり方は文の表から
export function techLabel(id, l = lang) {
  const k = KIMARITE[id];
  if (k) return l === 'ja' ? k.ja : k.id;
  return t(`tech.${id}`, {}, l);
}

export function missingKeys(tables) {
  const all = new Set(Object.values(tables).flatMap((tb) => Object.keys(tb)));
  const out = [];
  for (const [l, tb] of Object.entries(tables)) for (const k of all) if (!(k in tb)) out.push(`${l}:${k}`);
  return out;
}

// 幅の数え方：半角（0x00〜0xff）は1・それ以外は2
export function textUnits(str) {
  let u = 0;
  for (const ch of str) u += ch.codePointAt(0) <= 0xff ? 1 : 2;
  return u;
}

// 注釈（// と /* */）を除いたコードに、ひらがな・カタカナ・漢字・全角記号があるか
export function hasJapanese(code) {
  const stripped = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return /[\u3000-\u30ff\u4e00-\u9fff\uff00-\uffef]/.test(stripped);
}
