// 本物の相撲の表示（10/11 本人「調査結果、表示すべきものがあれば、どんどんいれてください」）。番付の動きや強さは変えない＝見せるだけ
// 星の印（勝ち越し・負け越し・全勝）・昇進の知らせ（新十両・新入幕・新三役・大関・横綱）・金星と三賞
import { divisionOf, rankParts } from './banzuke.js?v=22';
import { KIMARITE } from '../data/kimarite.js?v=22';

// 星の印：勝ちが過半数に届いたら勝ち越し（15番の8勝・7番の4勝）・負けが届いたら負け越し・全部勝ったら全勝
export function recordNote(wins, losses, bouts) {
  if (bouts > 0 && wins === bouts) return 'zensho';
  if (wins * 2 > bouts) return 'kachikoshi';
  if (losses * 2 > bouts) return 'makekoshi';
  return null;
}

// 段の番号（0＝横綱・1＝大関・2＝関脇・3＝小結・4＝前頭・5＝十両・6〜＝幕下より下）
const level = (pos) => divisionOf(pos).index;

// 昇進の知らせ（大関に落ちた直後に戻った時は ozekiReturn）。history＝この場所より前の場所（各 pos）。大関・横綱は上がるたび（再昇進も）、
// 新三役・新入幕・新十両はそれより上の段に一度も座ったことが無い時だけ。飛び級は着いた段の印
export function promotionNote(fromPos, toPos, history = []) {
  const to = level(toPos);
  const from = level(fromPos);
  if (to >= from) return null;
  if (to === 0) return 'yokozuna';
  if (to === 1) {
    // 大関から落ちた直後の場所で10勝して戻った＝返り咲き（前の場所が大関）
    const last = history[history.length - 1];
    return from === 2 && last && level(last.pos) === 1 ? 'ozekiReturn' : 'ozeki';
  }
  const best = Math.min(from, ...history.map((h) => level(h.pos)));
  if (to >= best) return null;
  if (to <= 3) return 'shinSanyaku';
  if (to === 4) return 'shinNyumaku';
  if (to === 5) return 'shinJuryo';
  return null;
}

const MAKUUCHI_SANSHO = ['komusubi', 'sekiwake', 'maegashira']; // 三賞は三役（小結・関脇）と前頭だけ（大関・横綱は無し）
const TOP_TWO = ['yokozuna', 'ozeki'];

// 締める前の場所から、金星の数と三賞（殊勲・敢闘・技能の順）。番付も心技体も動かさない
export function bashoAwards(career) {
  const b = career.basho;
  const none = { kinboshi: 0, sansho: [] };
  if (!b || b.kyujo === true) return none;
  const div = divisionOf(career.pos).id;
  const won = b.results.map((r, i) => (r === 'win' ? i : -1)).filter((i) => i >= 0);
  const wins = won.length;
  const kinboshi = div === 'maegashira' ? won.filter((i) => divisionOf(b.opponents[i].pos).id === 'yokozuna').length : 0;
  const sansho = [];
  if (MAKUUCHI_SANSHO.includes(div) && wins * 2 > b.results.length) {
    if (won.some((i) => TOP_TWO.includes(divisionOf(b.opponents[i].pos).id))) sansho.push('shukun');
    const lowMaegashira = div === 'maegashira' && rankParts(career.pos).number >= 10;
    if (wins >= (lowMaegashira ? 10 : 11)) sansho.push('kanto');
    const techs = new Set();
    for (const i of won) {
      const id = b.kimarite[i];
      const k = Object.prototype.hasOwnProperty.call(KIMARITE, id) ? KIMARITE[id] : null;
      if (k && k.group !== 'kihon') techs.add(k.id); // 技でない決まり方・既定の動きは表に無い＝数えない
    }
    if (techs.size >= 4) sansho.push('gino');
  }
  return { kinboshi, sansho };
}
