// 決め技5つ（10/13 本人「A」・50体版で解禁を10体ごとに）。系統（arch）で紙相撲の動きと相性が決まる。名前は i18n の newtech.<id>
import { TYPES } from './types.js?v=46';

// drill＝覚える時の稽古の遊び（src/core/drills.js の DRILLS・10/14 本人「稽古の出来で決め技を習得」）・
// input＝取組の出し方（設計書 2026-10-16 §6：覚えた稽古と同じ）：mash 連打（左）・hold 長押し（右・緑で離す）・tap 一押し（右・〇）
// at＝解禁の勝ち数（50体版 §5：0・10・20・30・40）
export const KIMETE = [
  { id: 'samidare', arch: 'tsuki', at: 0, drill: 'renda', input: 'mash' },
  { id: 'mangetsu', arch: 'yori', at: 10, drill: 'nagaoshi', input: 'hold' },
  { id: 'kazaguruma', arch: 'nage', at: 20, drill: 'ippon', input: 'tap' },
  { id: 'rakurai', arch: 'hiki', at: 30, drill: 'ippon', input: 'tap' },
  { id: 'teppeki', arch: 'utchari', at: 40, drill: 'nagaoshi', input: 'hold' },
];
export const KIMETE_IDS = KIMETE.map((k) => k.id);

export function kimeteById(id) {
  for (const k of KIMETE) if (k.id === id) return k;
  return null;
}

// 決め技に無い系統（弱みに書かれていても決め技では突けない系統）に一番近い、決め技の系統（v42 勧めの「敵の型に合う系統」）。
// 反り・ひねり＝体を反らせて回す うっちゃり・足掛け＝崩して投げる 投げ・吊り＝体を寄せて持ち上げる 寄り・押し＝突き
export const NEAR_ARCH = { sori: 'utchari', hineri: 'utchari', kake: 'nage', tsuri: 'yori', oshi: 'tsuki' };

// 敵の型に合う系統か：弱みの系統そのもの、または弱みの系統に近い決め技の系統（NEAR_ARCH）。得意な系統は合わない
export function typeFit(arch, foeType) {
  const t = TYPES[foeType];
  if (!t || !t.weak || t.strong.indexOf(arch) >= 0) return false;
  return t.weak.arch.some((w) => w === arch || NEAR_ARCH[w] === arch);
}

// 敵の型に対する系統の相性：弱い系統 1.5・得意な系統 0.7・ほか 1
export function affinity(arch, foeType) {
  const t = TYPES[foeType];
  if (!t) return 1;
  if (t.weak && t.weak.arch.indexOf(arch) >= 0) return 1.5;
  if (t.strong.indexOf(arch) >= 0) return 0.7;
  return 1;
}
