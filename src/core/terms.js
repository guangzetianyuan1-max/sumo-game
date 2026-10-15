// src/core/terms.js — 遊ぶ前の同意書（v42 本人「初めの注意書き、昔話と同じ同意書にサインを。このゲームはスマホの画面をたたくので、万が一の故障の責任は負わない項目を追加」）
// 下敷き＝昔話のゲーム（fq-site の src/data/terms.js と src/ui/terms.js）。文は i18n の terms.*（日本語は ja.js・英語は en.js）。画面は src/ui/terms.js（HTML の上掛け）
// 流れ：初めて遊ぶ時（と版 TERMS_VERSION を上げた時）＝同意書 → 「同意する」に印 →「同意して はじめる」→ 今の注意書きの札 → 表紙。同意した後は今まで通り
// 同意の記録は localStorage の TERMS_KEY（遊びの記録 sumo.career とは別の鍵）に 版と日時で残す。読めない・残せない端末では毎回たずねる
// ⚠消費者契約法では、事業者の責任を「すべて」免れる約束は無効になる（故意・重大な過失まで外すと条ごと効かない恐れ）
//   ⇒ 責任の範囲・画面をたたく故障の項は「制作者に故意または重大な過失がある場合を除き」と必ず書く（tests/terms.test.js が見張る）。
//   お金を取る・広告を入れる時は、専門家に見てもらってから版を上げる
// 書き換えたら TERMS_VERSION を上げる＝前に同意した人にも もう一度 見せる。ここは画面を使わない（node で試験する）
export const TERMS_VERSION = '2026-10-15';
export const TERMS_KEY = 'sumo.terms';
export const OFFICIAL_URL = 'https://guangzetianyuan1-max.github.io/sumo-game/';
// 項目の並び（文は i18n の terms.<id>.head・terms.<id>.body）。tap＝画面をたたいて遊ぶこと（新・v42）
export const TERMS_SECTIONS = ['about', 'data', 'official', 'warranty', 'tap', 'liability', 'manners', 'fiction', 'changes'];

// 同意した版（無い・壊れている・読めない＝null）
export function agreedVersion(store) {
  try {
    if (!store) return null;
    const v = JSON.parse(store.getItem(TERMS_KEY) ?? 'null');
    return v && typeof v.version === 'string' ? v.version : null;
  } catch {
    return null;
  }
}

// 同意書を見せるか：今の版に同意していなければ true（読めない端末も true＝毎回たずねる）
export const needTerms = (store) => agreedVersion(store) !== TERMS_VERSION;

// 同意を残す（残せなくても遊べる＝次に開いた時また たずねる）。残せたら true
export function saveAgreement(store, now = new Date()) {
  try {
    if (!store) return false;
    store.setItem(TERMS_KEY, JSON.stringify({ version: TERMS_VERSION, at: now.toISOString() }));
    return true;
  } catch {
    return false;
  }
}
