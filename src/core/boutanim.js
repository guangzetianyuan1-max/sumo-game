// 取組の画面の動き（10/11 本人「3の動きで『動画を入れて』」・見本＝art_src/動画試作/bout_video.py）。画面には触らない（node で試せる）
// 姿勢の絵＝assets/bout/<east|west>/<姿勢>.png（tools/prep_bout.py で切り抜く）。東＝右向き・紺／西＝左右反転・赤
import { KIMARITE } from '../data/kimarite.js?v=26';

// 切り抜いた姿勢（tools/prep_bout.py の POSES と同じ名前）
export const POSE_NAMES = [
  'shikiri', 'tachiai', 'both', 'grip', 'grip2', 'throw', 'recoil', 'stagger', 'fall',
  'push', 'brace', 'rise', 'tsR', 'tsL', 'hit', 'back', 'topple',
];

// 土俵の世界（横に広い・画面は二人を追って横に動く）。ringX＝輪の中心・rx/ry＝俵の輪（楕円）の半径・feetY＝足もとの線（画面の y）
export const WORLD = { w: 1100, ringX: 550, rx: 430, ry: 85, feetY: 620, view: 720 };
// 位置 ±100（俵）のときの、触れ合う所の輪の中心からの距離（見本の突っ張り4つの後＝+180）
export const CONTACT_SPAN = 180;
// 二人の前の端を触れ合う所で重ねる量（見本と同じ 10）
export const OVERLAP = 10;
// 位置がこれより小さく動いただけなら、どちらも攻めていない
const MOVE_EPS = 0.5;

const THRUST = ['tsuki', 'oshi'];
const DRIVE_OTHER = ['yori', 'tsuri'];
// 型 → 攻めの姿勢（2つ並ぶ型は手ごとに交互）
const ARCH_POSE = {
  tsuki: ['tsR', 'tsL'], oshi: ['tsR', 'tsL'],
  yori: ['grip', 'grip2'], tsuri: ['grip', 'grip2'],
  nage: ['throw'], hineri: ['throw'], kake: ['throw'], sori: ['throw'],
  hiki: ['push'], // 叩き・引き落としの振り下ろし
  okuri: ['tachiai'],
  utchari: ['brace'],
};
// 作戦表に使える手が無い時の既定の動き（tuning.js の DEFAULT_MOVES）の見せ方
const DEFAULT_ARCH = { _press: 'oshi', _shake: 'yori' };

const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const other = (side) => (side === 'east' ? 'west' : 'east');
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 手の id → 動きの型（知らない手は null）
export function techArch(id) {
  if (has(DEFAULT_ARCH, id)) return DEFAULT_ARCH[id];
  return has(KIMARITE, id) ? KIMARITE[id].arch : null;
}

// 型の攻めの姿勢。i＝何手目か（交互にする）。知らない型は両腕を前へ
export function archPose(arch, i = 0) {
  if (!has(ARCH_POSE, arch)) return 'both';
  const list = ARCH_POSE[arch];
  return list[Math.abs(i) % list.length];
}

export const isThrust = (id) => THRUST.includes(techArch(id));

// 記録の1行 → 二人の姿勢。攻めた側＝位置が相手の方へ動いた側（東が押すと位置は + へ）
// 受けた側：突き押しで下がった＝のけぞる（hit）・寄りや吊りで下がった＝後ずさり（back）・ほかは自分の型の姿勢
// ただし引いた側（hiki）は自分から下がった＝押されたのではない＝自分の型の姿勢（振り下ろし）
export function stepPoses(entry, prevPos, i = 0) {
  const d = entry.pos - prevPos;
  const own = (side) => archPose(techArch(entry[side] && entry[side].id), i);
  const attacker = d > MOVE_EPS ? 'east' : d < -MOVE_EPS ? 'west' : null;
  if (!attacker) return { east: own('east'), west: own('west'), attacker: null };
  const defender = other(attacker);
  const aArch = techArch(entry[attacker] && entry[attacker].id);
  const dArch = techArch(entry[defender] && entry[defender].id);
  let dPose = own(defender);
  if (dArch !== 'hiki') {
    if (THRUST.includes(aArch)) dPose = 'hit';
    else if (DRIVE_OTHER.includes(aArch)) dPose = 'back';
  }
  return { [attacker]: own(attacker), [defender]: dPose, attacker };
}

// 決まり方の見せ方：突き押しの「出し」＝pushout（俵の外へ押し出して土俵の下へ落ちる）・「倒し」＝pushdown（俵際で倒れる）・ほか＝simple
export function finishKind(id) {
  if (!has(KIMARITE, id) || !THRUST.includes(KIMARITE[id].arch)) return 'simple';
  if (/dashi$/.test(id)) return 'pushout';
  if (/taoshi$/.test(id)) return 'pushdown';
  return 'simple';
}

// 位置 → 触れ合う所の x（世界の中）。±100 より外は俵の所で止める
export function contactX(pos) {
  return WORLD.ringX + (clamp(pos, -100, 100) / 100) * CONTACT_SPAN;
}

// 触れ合う所を、東の体（左へ left 伸びる）・西の体（右へ right 伸びる）が世界の外へ出ない所に止める
export function clampContact(x, left, right, worldW = WORLD.w) {
  return clamp(x, left, Math.max(left, worldW - right));
}

// 画面の左の端の世界の x：触れ合う所を真ん中に・世界の端より外は見せない
export function viewScroll(contact) {
  return clamp(contact - WORLD.view / 2, 0, WORLD.w - WORLD.view);
}

// 体の絵の左の端（絵の原点は左下）。front＝相手に近い列（目録）・sx＝横の倍率。二人の前の端を OVERLAP だけ重ねる
export function bodyLeft(side, contact, gap, front, sx, overlap = OVERLAP) {
  if (side === 'east') return contact - gap / 2 + overlap - front * sx;
  return contact + gap / 2 - overlap - front * sx;
}

// タイプの体つき（今は5タイプとも「標準」の絵を使い、幅と高さを掛けて分ける）
const BODY_SCALE = { heavy: { sx: 1.12, sy: 1 }, small: { sx: 0.9, sy: 0.9 }, tall: { sx: 0.96, sy: 1.08 } };
export function bodyScale(type) {
  const s = has(BODY_SCALE, type) ? BODY_SCALE[type] : { sx: 1, sy: 1 };
  return { sx: s.sx, sy: s.sy };
}
