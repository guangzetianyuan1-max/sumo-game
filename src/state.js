// src/state.js — 場面をまたぐ選び。strategy は自分の作戦表（新しい相手ごとにお勧めで組む）
// career は一代記（入門を終えるまで null）。一代記の移り変わりはここの関数で行い、そのたびに保存する
import { TYPE_IDS, TYPES } from './data/types.js?v=16';
import { recommendStrategy } from './core/recommend.js?v=16';
import { defaultStrategy } from './core/strategy.js?v=16';
import { newCareer, train, saveCareer, loadCareer, CAREER_KEY } from './core/career.js?v=16';
import { startBasho, currentOpponent, decideOpponent, recordBout, finishBasho } from './core/basho.js?v=16';
import { makeRng } from './core/rng.js?v=16';

export const session = {
  you: 'heavy',
  opp: 'tall',
  strategy: null,
  oppStrategy: null,
  guide: null, // 案内役 'chizuru' | 'suzu' | 'kotone'（選ぶまで null）
  speed: 'normal',
  seed: Date.now() % 100000,
  career: null, // 一代記（入門を終えるまで null）
  oppKey: null, // 作戦表を組んだ相手（場所の番号:日）。同じ相手なら組み直さない
  lastResult: null, // 締めた場所の結果（場所の結果の画面が読む）
  slot: 1, // 記録①〜③のどれで遊んでいるか（セーブも読み直しもここ）
};

// 次の相手を引く（5タイプから一様・自分と同じタイプもあり）。画面の層の選びなので Math.random でよい（取組の計算の乱数とは別）
// 一代記では使わない（相手は currentOpponent(session.career)）
export function nextOpponent(rand = Math.random) {
  session.opp = TYPE_IDS[Math.min(TYPE_IDS.length - 1, Math.floor(rand() * TYPE_IDS.length))];
  session.oppStrategy = null;
  // 自分の作戦表は、新しい相手ごとにお勧めへ組み直す（もう一番では触らないので、手直しは持ち越される）
  session.strategy = recommendStrategy(TYPES[session.you].sample, session.you, session.opp);
  return session.opp;
}

// 端末の保存先（使えない端末では null）。node の試験では保存先を引数で渡す
export function localStore() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

// 記録①〜③（10/11 本人「昔話と同じように最大3つの四股名ですすめられるように」）。①は記録が1つだった頃の鍵＝今の記録はそのまま①
export const SLOT_COUNT = 3;
export const slotKey = (n) => (n > 1 ? `${CAREER_KEY}.${n}` : CAREER_KEY);
const LAST_SLOT_KEY = 'sumo.slot';
const validSlot = (n) => Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT;

// 前に使った記録の番号（無い・壊れた・読めない時は①）
export function lastSlot(store = localStore()) {
  try {
    const n = Number(store ? store.getItem(LAST_SLOT_KEY) : null);
    return validSlot(n) ? n : 1;
  } catch {
    return 1;
  }
}

// この記録で遊ぶ（session.slot）と決め、前に使った記録として覚える（書けない端末でも選びは効く）
export function rememberSlot(n, store = localStore()) {
  session.slot = n;
  try { if (store) store.setItem(LAST_SLOT_KEY, String(n)); } catch { /* 覚えられなくても遊べる */ }
}

// はじめから：その記録だけ消す
export function clearSlot(n, store = localStore()) {
  try { if (store) store.removeItem(slotKey(n)); } catch { /* 消せない端末では、入門を終えた時に上書きされる */ }
}

// 初めの画面の札：しこ名・番付の席・タイプ（空きは null）
export function slotSummary(career) {
  if (!career) return null;
  return { name: career.name, rankPos: career.pos, type: career.type };
}

// 今の記録（session.slot）へ書く。書けたら true・一代記が無い／保存先が無い／投げる端末は false
export function saveNow(store = localStore()) {
  if (!session.career) return false;
  return saveCareer(store, session.career, slotKey(session.slot));
}

export function loadSaved(store = localStore(), n = session.slot) {
  return loadCareer(store, slotKey(n));
}

// 読み直した記録を session に入れる（自分のタイプと案内役も記録から）
export function useCareer(career) {
  session.career = career;
  session.you = career.type;
  session.guide = career.guide;
  session.oppKey = null;
  session.lastResult = null;
}

// 入門を終えた時：新しい一代記を作って今の記録（session.slot）へ保存（その記録の前の中身はここで上書き）
export function startCareer({ guide, type, name, seed }, store = localStore()) {
  useCareer(newCareer({ guide, type, name, seed }));
  rememberSlot(session.slot, store);
  saveNow(store);
  return session.career;
}

export function trainNow(kind, store = localStore()) {
  session.career = train(session.career, kind);
  saveNow(store);
  return session.career;
}

// 場所は basho が無い時だけ始める（場所の途中で読み直しても、始め直さない）
export function beginBasho(store = localStore()) {
  if (!session.career.basho) {
    session.career = startBasho(session.career);
    saveNow(store);
  }
  return session.career;
}

// 今日の相手が未定（幕下以下の2番目から）なら決めて、すぐ保存する（読み直しても同じ相手）
export function decideNow(store = localStore()) {
  const c = session.career;
  if (!c?.basho) return c;
  const d = decideOpponent(c);
  if (d !== c) {
    session.career = d;
    saveNow(store);
  }
  return session.career;
}

// 相手の情報に入る時：今日の相手から相手の作戦表と自分のお勧めを組む。同じ相手にもう一度来た時は組み直さない
export function prepareOpponent(store = localStore()) {
  const c = decideNow(store);
  const opp = c ? currentOpponent(c) : null;
  if (!opp) return null;
  const key = `${c.bashoIndex}:${c.basho.day}`;
  if (session.oppKey !== key) {
    session.oppKey = key;
    session.opp = opp.type;
    session.oppStrategy = defaultStrategy(TYPES[opp.type].sample, opp.type);
    session.strategy = recommendStrategy(TYPES[c.type].sample, c.type, opp.type);
  }
  return opp;
}

export function recordNow(won, kimarite, store = localStore()) {
  session.career = recordBout(session.career, won, kimarite);
  saveNow(store);
  return session.career;
}

// 取組の種：同じ一代記・同じ場所・同じ日なら同じ（読み直して取り直しても結果は変わらない）
export function boutSeed(c = session.career) {
  return (c.seed * 1000 + c.bashoIndex * 16 + c.basho.day + 7) >>> 0;
}

// 場所を締める（全部の取組が済んだ時だけ・1度だけ）。結果を session.lastResult に残し、保存する
export function closeBasho(store = localStore()) {
  const c = session.career;
  const b = c?.basho;
  if (!b || b.day < b.days.length) return null;
  const { career, summary } = finishBasho(c, makeRng(c.seed * 1000 + c.bashoIndex + 500));
  session.career = career;
  session.oppKey = null;
  session.lastResult = { summary, basho: { month: b.month, place: b.place }, before: { ...c.stats }, after: { ...career.stats } };
  saveNow(store);
  return session.lastResult;
}

// つづきから：場所の途中なら取組の順・そうでなければ稽古
export const resumeScene = (career) => (career.basho ? 'schedule' : 'training');
