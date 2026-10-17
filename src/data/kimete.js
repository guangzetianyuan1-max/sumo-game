// 決め技5つ（10/13 本人「A」・50体版で解禁を10体ごとに）。系統（arch）で紙相撲の動きと相性が決まる。名前は i18n の newtech.<id>
import { TYPES } from './types.js?v=54';

// drill＝覚える時の稽古の遊び（src/core/drills.js の DRILLS・10/14 本人「稽古の出来で決め技を習得」）・
// input＝取組の出し方（設計書 2026-10-16 §6：覚えた稽古と同じ）：mash 連打（左）・hold 長押し（右・緑で離す）・tap 一押し（右・〇）
// at＝解禁の勝ち数（50体版 §5：0・10・20・30・40）。並び＝解禁の順（勧めの重み・稽古の札の順もこの順）
// v47 本人「本番で一発〇が初めしか出ない」：前は 0＝五月雨突き（連打）で、一押しの技は20勝まで無かった（立ち合いの〇しか出ない）＝0 を〇の風車投げに入れ替えた
export const KIMETE = [
  { id: 'kazaguruma', arch: 'nage', at: 0, drill: 'ippon', input: 'tap' },
  { id: 'samidare', arch: 'tsuki', at: 10, drill: 'renda', input: 'mash' },
  { id: 'mangetsu', arch: 'yori', at: 20, drill: 'nagaoshi', input: 'hold' },
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
// v47：うっちゃり（鉄壁うっちゃり）は自分の背中の端の近く（kami.js の EDGE_SELF）でしか光らず、長身の敵に勧めても約9割の取組で光らなかった＝型だけでは勧めない（相性 affinity と強さは変えない）
export const NO_TYPE_FIT = ['utchari'];
export function typeFit(arch, foeType) {
  if (NO_TYPE_FIT.indexOf(arch) >= 0) return false;
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
