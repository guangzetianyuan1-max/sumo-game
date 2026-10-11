// 作戦表＝3場面×5手の優先順（設計書 §2）。どの関数も元を書き換えず、新しい作戦表を返す。
import { KIMARITE } from '../data/kimarite.js?v=23';
import { ARCH } from './tuning.js?v=23';
import { TYPES } from '../data/types.js?v=23';

export const SCENES = ['tachiai', 'mid', 'edge'];
export const ROW = 5;

export const emptyStrategy = () => ({ tachiai: [], mid: [], edge: [] });
const copy = (s) => ({ tachiai: [...s.tachiai], mid: [...s.mid], edge: [...s.edge] });

export function scenesOf(id) {
  const k = KIMARITE[id];
  if (!k) return [];
  return k.scenes ?? ARCH[k.arch].scenes;
}

export const canPlace = (id, scene) => scenesOf(id).includes(scene);

// 覚えた手を押したとき：使える段のうち、空きがあり同じ手がまだ無い最初の段の一番下へ
export function addTech(strat, id) {
  const scenes = scenesOf(id);
  if (!scenes.length) return { ok: false, strategy: strat, reason: 'unknown' };
  for (const sc of scenes) {
    if (strat[sc].length < ROW && !strat[sc].includes(id)) {
      const s = copy(strat);
      s[sc].push(id);
      return { ok: true, strategy: s, scene: sc };
    }
  }
  // 入れなかった理由：使える段すべてにもう入っている（dup）／それ以外は段が満杯（noroom）
  const dup = scenes.every((sc) => strat[sc].includes(id));
  return { ok: false, strategy: strat, reason: dup ? 'dup' : 'noroom' };
}

export function raise(strat, scene, i) {
  if (i <= 0 || i >= strat[scene].length) return strat;
  const s = copy(strat);
  [s[scene][i - 1], s[scene][i]] = [s[scene][i], s[scene][i - 1]];
  return s;
}

export function remove(strat, scene, i) {
  if (i < 0 || i >= strat[scene].length) return strat;
  const s = copy(strat);
  s[scene].splice(i, 1);
  return s;
}

// 長押しで持ち上げた手を置く（10/11 本人「移動先がいっぱいの場合、押されたほうが覚えた手に戻る」）。
// from＝{ scene, index }（段から持ち上げた）か null（覚えた手から）。to＝{ scene, index }（落とした枠）・'learned'（覚えた手へ）・null（どこでもない＝戻す）。
// 返り値 { ok, strategy, returned }（returned＝押し出されて段から抜けた手）か { ok:false, strategy, reason }。
export function moveTech(strat, { id, from = null, to = null }) {
  const same = { ok: true, strategy: strat, returned: null };
  if (from && strat[from.scene]?.[from.index] !== id) return { ok: false, strategy: strat, reason: 'from' };
  if (!to) return same;
  if (to === 'learned') {
    if (!from) return same;
    return { ok: true, strategy: remove(strat, from.scene, from.index), returned: null };
  }
  const sc = to.scene;
  if (!canPlace(id, sc)) return { ok: false, strategy: strat, reason: 'scene' };
  const s = copy(strat);
  const row = s[sc];
  if (from && from.scene === sc) {
    // 同じ段の中は並べ替え（抜いてから、落とした枠へ差し込む）
    row.splice(from.index, 1);
    row.splice(Math.max(0, Math.min(to.index, row.length)), 0, id);
    return { ok: true, strategy: s, returned: null };
  }
  if (row.includes(id)) return { ok: false, strategy: strat, reason: 'dup' };
  if (from) s[from.scene].splice(from.index, 1);
  if (row.length < ROW) {
    row.splice(Math.max(0, Math.min(to.index, row.length)), 0, id);
    return { ok: true, strategy: s, returned: null };
  }
  // 満杯：落とした枠の手が段から抜けて（＝覚えた手に戻って）、そこへ入る
  const at = Math.max(0, Math.min(to.index, ROW - 1));
  const returned = row[at];
  row[at] = id;
  return { ok: true, strategy: s, returned };
}

// 相手（と最初の自分）の作戦：覚えた手を場面ごとに、効き方の好みの順に5つまで並べる
const PREF = {
  tachiai: ['drive', 'pull', 'fell'],
  mid: ['drive', 'fell', 'pull', 'behind'],
  edge: ['reverse', 'fell', 'pull', 'drive', 'behind'],
};
export const rank = (sc, id) => {
  const i = PREF[sc].indexOf(ARCH[KIMARITE[id].arch].kind);
  return i < 0 ? 99 : i;
};

// type を渡すと（設計書 §2「相手の作戦表はタイプごとの見本から機械で組む」）、そのタイプの得意な型の手を先に並べる。
// 得意な手どうし・それ以外どうしは効き方の好みの順。type が無いときは前と同じ並び。
// 土俵際の逆転（うっちゃり）は、type があっても土俵際の段の先頭に置く。
export function defaultStrategy(known, type) {
  const strong = type ? TYPES[type]?.strong ?? [] : [];
  const tier = (id, sc) => {
    if (sc === 'edge' && ARCH[KIMARITE[id].arch].kind === 'reverse') return 0;
    return strong.includes(KIMARITE[id].arch) ? 1 : 2;
  };
  const s = emptyStrategy();
  for (const sc of SCENES) {
    const cands = known.filter((id) => canPlace(id, sc));
    cands.sort((a, b) => tier(a, sc) - tier(b, sc) || rank(sc, a) - rank(sc, b)); // 同じ順位は覚えた順（sort は安定）
    s[sc] = cands.slice(0, ROW);
  }
  return s;
}
