// src/state.js — 場面をまたぐ選び。run は勝ち抜き（入門を終えるまで null）。移り変わりはここの関数で行い、そのたびに保存する
// 10/12 夜 場所をやめて100体の勝ち抜きへ（設計書 §3）。場所の頃の関数は basho.js・career.js に残る（使わない）
import { TYPE_IDS, TYPES } from './data/types.js?v=32';
import { recommendStrategy } from './core/recommend.js?v=32';
import { defaultStrategy } from './core/strategy.js?v=32';
import { CAREER_KEY } from './core/career.js?v=32';
import { learnMove } from './core/learn.js?v=32';
import { rankOf } from './core/ladder.js?v=32';
import { HERO_TYPE } from './data/heroes.js?v=32';
import {
  newRun, currentFoe, recordResult, startTraining, trainStat, trainNewTech, serializeRun, deserializeRun,
} from './core/run.js?v=32';

export const session = {
  you: HERO_TYPE,
  opp: 'tall',
  strategy: null,
  oppStrategy: null,
  guide: null, // 案内役：10/13 から kotone（若女将）に固定（入門で newRun が入れる。入門前は null）
  speed: 'normal',
  seed: Date.now() % 100000,
  run: null, // 勝ち抜き（入門を終えるまで null）
  oppKey: null, // 作戦表を組んだ相手（倒した数:連敗数）。同じなら組み直さない
  lastBout: null, // 最後の取組の結果（取組の後の画面が読む）
  slot: 1, // 記録①〜③のどれで遊んでいるか
  kimete: null, // 相手の情報で選んだ決め技の id（覚えた物だけ・無い＝決め技無しで取る）
};

// 次の相手を引く（前の遊び方の名残・試験だけが使う）
export function nextOpponent(rand = Math.random) {
  session.opp = TYPE_IDS[Math.min(TYPE_IDS.length - 1, Math.floor(rand() * TYPE_IDS.length))];
  session.oppStrategy = null;
  session.strategy = recommendStrategy(TYPES[session.you].sample, session.you, session.opp);
  return session.opp;
}

export function localStore() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const SLOT_COUNT = 3;
export const slotKey = (n) => (n > 1 ? `${CAREER_KEY}.${n}` : CAREER_KEY);
const LAST_SLOT_KEY = 'sumo.slot';
const validSlot = (n) => Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT;

export function lastSlot(store = localStore()) {
  try {
    const n = Number(store ? store.getItem(LAST_SLOT_KEY) : null);
    return validSlot(n) ? n : 1;
  } catch {
    return 1;
  }
}

export function rememberSlot(n, store = localStore()) {
  session.slot = n;
  try { if (store) store.setItem(LAST_SLOT_KEY, String(n)); } catch { /* 覚えられなくても遊べる */ }
}

export function clearSlot(n, store = localStore()) {
  try { if (store) store.removeItem(slotKey(n)); } catch { /* 消せない端末では入門を終えた時に上書き */ }
}

// 記録の札の中身：読めた勝ち抜き { run }・古い版や壊れた記録 { old: true }・空き（と読めない端末）null
export function slotState(n, store = localStore()) {
  let raw = null;
  try { raw = store ? store.getItem(slotKey(n)) : null; } catch { return null; }
  if (raw === null || raw === undefined) return null;
  const run = deserializeRun(raw);
  return run ? { run } : { old: true };
}

export function slotSummary(run) {
  if (!run) return null;
  return { type: run.type, wins: run.wins, rank: rankOf(run.wins), cleared: run.cleared };
}

export function saveNow(store = localStore()) {
  if (!session.run || !store) return false;
  try {
    store.setItem(slotKey(session.slot), serializeRun(session.run));
    return true;
  } catch {
    return false;
  }
}

export function useRun(run) {
  session.run = run;
  session.you = run.type;
  session.guide = run.guide;
  session.oppKey = null;
  session.lastBout = null;
  session.strategy = session.oppStrategy = null;
  session.kimete = null;
}

export function startRun({ guide, type, seed }, store = localStore()) {
  useRun(newRun({ guide, type, seed }));
  rememberSlot(session.slot, store);
  saveNow(store);
  return session.run;
}

// 相手の情報に入る時：今の相手から相手の作戦表と自分のお勧めを組む。同じ相手・同じ連敗数なら組み直さない
export function prepareOpponent(store = localStore()) {
  const r = session.run;
  const foe = r ? currentFoe(r) : null;
  if (!foe) return null;
  const key = `${r.wins}:${r.streak}`;
  if (session.oppKey !== key || !session.strategy || !session.oppStrategy) {
    session.oppKey = key;
    session.opp = foe.type;
    session.oppStrategy = defaultStrategy(TYPES[foe.type].sample, foe.type);
    session.strategy = recommendStrategy(r.known, r.type, foe.type);
  }
  return foe;
}

// 説明（遊び方の3枚）を見た・飛ばした：記録に seenHelp を書いて保存する
export function markHelpSeen(store = localStore()) {
  if (!session.run) return null;
  if (session.run.seenHelp !== true) session.run = { ...session.run, seenHelp: true };
  saveNow(store);
  return session.run;
}

// 取組の種：倒した数と同じ相手への連敗数から（読み直して取り直しても同じ・負けて挑み直すと変わる）
export function boutSeed(r = session.run) {
  return (r.seed * 100000 + r.wins * 1000 + r.streak + 7) >>> 0;
}

export function recordNow(won, kimarite, store = localStore()) {
  const { run, note } = recordResult(session.run, won);
  session.run = run;
  session.lastBout = note ? { ...note, kimarite } : null;
  session.strategy = session.oppStrategy = null;
  session.oppKey = null;
  saveNow(store);
  return session.lastBout;
}

export const SUGGEST_TRAIN_AT = 3; // 同じ相手にこれだけ負けたら案内役が稽古を勧める
export const suggestTraining = (run) => run.streak >= SUGGEST_TRAIN_AT;

const keep = (store, run) => {
  session.run = run;
  saveNow(store);
  return session.run;
};
export const trainBegin = (store = localStore()) => keep(store, startTraining(session.run));
export const trainStatNow = (stat, store = localStore()) => keep(store, trainStat(session.run, stat));
export const trainTechNow = (id, store = localStore()) => keep(store, trainNewTech(session.run, id));
export const learnNow = (id, store = localStore()) => keep(store, learnMove(session.run, id));

// つづきから：稽古の途中なら稽古・ほかは番付表（紙相撲では従来の技を覚える画面へは行かない・古い記録に pendingLearn が残っていても無視）
export const resumeScene = (run) => (run.training ? 'training' : 'ladder');
