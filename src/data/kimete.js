// 決め技5つ（20体版・10/13 本人「A」）。系統（arch）で紙相撲の動きと相性が決まる。名前は i18n の newtech.<id>
import { TYPES } from './types.js?v=32';

export const KIMETE = [
  { id: 'samidare', arch: 'tsuki', at: 0 },
  { id: 'mangetsu', arch: 'yori', at: 4 },
  { id: 'kazaguruma', arch: 'nage', at: 8 },
  { id: 'rakurai', arch: 'hiki', at: 12 },
  { id: 'teppeki', arch: 'utchari', at: 16 },
];
export const KIMETE_IDS = KIMETE.map((k) => k.id);

export function kimeteById(id) {
  for (const k of KIMETE) if (k.id === id) return k;
  return null;
}

// 敵の型に対する系統の相性：弱い系統 1.5・得意な系統 0.7・ほか 1
export function affinity(arch, foeType) {
  const t = TYPES[foeType];
  if (!t) return 1;
  if (t.weak && t.weak.arch.indexOf(arch) >= 0) return 1.5;
  if (t.strong.indexOf(arch) >= 0) return 0.7;
  return 1;
}
