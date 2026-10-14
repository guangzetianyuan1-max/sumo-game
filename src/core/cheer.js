// 稽古の応援と、稽古の画面の右下の助言（10/11 本人「女子は、ちゃんこと休みの際に応援。親方はそれ以外の稽古で応援」
// 「画面右下に親方また女子が現れ、アドバイスをする」）。who＝娘の id か部屋の id・key＝i18n の鍵
import { heyaOfGuide } from '../data/heya.js?v=39';
import { TRAININGS } from './career.js?v=39';

// 10/12 稽古を流れから外した＝右下の助言（trainingAdvice）は消した。応援の1行は稽古の画面（_retired）が使っていた物として残す
const DAUGHTER_KINDS = ['chanko', 'rest'];

// 稽古を押した後の応援の1行。count＝稽古の回数（奇数なら .1・偶数なら .2 で交互）。知らない娘・稽古は null
export function cheerKey(guide, kind, count) {
  const heya = heyaOfGuide(guide);
  if (!heya || !TRAININGS.includes(kind)) return null;
  const who = DAUGHTER_KINDS.includes(kind) ? guide : heya;
  const n = Math.abs(count) % 2 === 1 ? 1 : 2;
  return { who, key: `cheer.${who}.${kind}.${n}` };
}
