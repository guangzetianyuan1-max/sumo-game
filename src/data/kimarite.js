// 決まり手82手（2001年からの分類）。id はローマ字（英語版の名前にもそのまま使う・長音記号なし）。
// 出典：en.wikipedia.org/wiki/Kimarite（2026-10-10 取得・相撲協会の分類を引いている）。sumo.or.jp の一覧ページには届かなかった。
// en＝英語の短い説明（言葉の札で使う）。arch＝動きの型（src/core/tuning.js の ARCH）。diff＝決まりにくさ（0〜0.35・まれな技ほど大きい）。
// scenes を書いた手だけ、型の決まりの場面を上書きする。
const K = (id, ja, en, group, arch, diff = 0, scenes) => ({ id, ja, en, group, arch, diff, ...(scenes ? { scenes } : {}) });

export const GROUPS = ['kihon', 'kake', 'nage', 'hineri', 'sori', 'tokushu'];
const SCENE_IDS = ['tachiai', 'mid', 'edge'];

export const KIMARITE_LIST = [
  // 基本技 7
  K('abisetaoshi', '浴びせ倒し', 'leans in and topples the opponent backward', 'kihon', 'yori', 0.1),
  K('oshidashi', '押し出し', 'pushes the opponent out without a belt grip', 'kihon', 'oshi'),
  K('oshitaoshi', '押し倒し', 'pushes the opponent down', 'kihon', 'oshi', 0.05),
  K('tsukidashi', '突き出し', 'thrusts the opponent out with open hands', 'kihon', 'tsuki'),
  K('tsukitaoshi', '突き倒し', 'thrusts the opponent down', 'kihon', 'tsuki', 0.05),
  K('yorikiri', '寄り切り', 'frontal force out while holding the belt', 'kihon', 'yori'),
  K('yoritaoshi', '寄り倒し', 'frontal force out, the opponent falls', 'kihon', 'yori', 0.05),
  // 掛け手 18
  K('ashitori', '足取り', 'grabs a leg and drives the opponent out', 'kake', 'kake', 0.1),
  K('chongake', 'ちょん掛け', 'hooks the heel with a heel', 'kake', 'kake', 0.25),
  K('kawazugake', '河津掛け', 'wraps a leg and trips backward', 'kake', 'kake', 0.3),
  K('kekaeshi', '蹴返し', 'kicks the inside of the foot', 'kake', 'kake', 0.1, ['tachiai', 'mid']),
  K('ketaguri', '蹴手繰り', 'kicks the legs out at the charge', 'kake', 'kake', 0.1, ['tachiai', 'mid']),
  K('kirikaeshi', '切り返し', 'twists the opponent back over a knee', 'kake', 'kake', 0.1),
  K('komatasukui', '小股掬い', 'scoops the inside thigh and throws', 'kake', 'kake', 0.2),
  K('kozumatori', '小褄取り', 'lifts the ankle from the front', 'kake', 'kake', 0.3),
  K('mitokorozeme', '三所攻め', 'triple attack: two legs and the head', 'kake', 'kake', 0.35),
  K('nimaigeri', '二枚蹴り', 'kicks the standing foot and throws', 'kake', 'kake', 0.3),
  K('omata', '大股', 'lifts the other thigh and throws', 'kake', 'kake', 0.3),
  K('sotogake', '外掛け', 'outside leg trip', 'kake', 'kake'),
  K('sotokomata', '外小股', 'lifts the outer thigh and throws', 'kake', 'kake', 0.3),
  K('susoharai', '裾払い', 'sweeps the leg from behind', 'kake', 'kake', 0.3),
  K('susotori', '裾取り', 'grabs the ankle and pulls down', 'kake', 'kake', 0.25),
  K('tsumatori', '褄取り', 'pulls a leg back as the opponent comes', 'kake', 'kake', 0.3),
  K('uchigake', '内掛け', 'inside leg trip', 'kake', 'kake'),
  K('watashikomi', '渡し込み', 'grabs the thigh and pushes', 'kake', 'kake', 0.1),
  // 投げ手 13
  K('ipponzeoi', '一本背負い', 'one-arm shoulder throw', 'nage', 'nage', 0.3),
  K('kakenage', '掛け投げ', 'hooks the thigh and throws', 'nage', 'nage', 0.2),
  K('koshinage', '腰投げ', 'hip throw', 'nage', 'nage', 0.3),
  K('kotenage', '小手投げ', 'armlock throw without the belt', 'nage', 'nage'),
  K('kubinage', '首投げ', 'headlock throw', 'nage', 'nage', 0.1),
  K('nichonage', '二丁投げ', 'sweeps both legs and throws', 'nage', 'nage', 0.3),
  K('shitatedashinage', '下手出し投げ', 'pulling underarm throw', 'nage', 'nage', 0.05),
  K('shitatenage', '下手投げ', 'underarm throw', 'nage', 'nage'),
  K('sukuinage', '掬い投げ', 'beltless arm throw', 'nage', 'nage'),
  K('tsukaminage', 'つかみ投げ', 'lifts by the belt and throws', 'nage', 'nage', 0.35),
  K('uwatedashinage', '上手出し投げ', 'pulling overarm throw', 'nage', 'nage', 0.05),
  K('uwatenage', '上手投げ', 'overarm throw', 'nage', 'nage'),
  K('yaguranage', '櫓投げ', 'lifts with a thigh and throws', 'nage', 'nage', 0.35),
  // 捻り手 19
  K('amiuchi', '網打ち', "fisherman's throw on the arm", 'hineri', 'hineri', 0.3),
  K('gasshohineri', '合掌捻り', 'clasped-hands twist down', 'hineri', 'hineri', 0.3),
  K('harimanage', '波離間投げ', 'over-the-back belt throw', 'hineri', 'hineri', 0.3),
  K('kainahineri', '腕捻り', 'two-handed arm twist down', 'hineri', 'hineri', 0.3),
  K('katasukashi', '肩透かし', 'under-shoulder swing down', 'hineri', 'hineri', 0.05),
  K('kotehineri', '小手捻り', 'arm-locking twist down', 'hineri', 'hineri', 0.25),
  K('kubihineri', '首捻り', 'head-twisting throw', 'hineri', 'hineri', 0.2),
  K('makiotoshi', '巻き落とし', 'twist down without the belt', 'hineri', 'hineri', 0.1),
  K('osakate', '大逆手', 'backward armlock throw', 'hineri', 'hineri', 0.35),
  K('sabaori', '鯖折り', 'forces the knees down from above', 'hineri', 'hineri', 0.3),
  K('sakatottari', '逆とったり', 'arm bar counter throw', 'hineri', 'hineri', 0.25),
  K('shitatehineri', '下手捻り', 'twisting underarm throw', 'hineri', 'hineri', 0.1),
  K('sotomuso', '外無双', 'outer thigh propping twist', 'hineri', 'hineri', 0.2),
  K('tokkurinage', '徳利投げ', 'two-handed head twist down', 'hineri', 'hineri', 0.35),
  K('tottari', 'とったり', 'arm bar throw', 'hineri', 'hineri', 0.1),
  K('tsukiotoshi', '突き落とし', 'thrusts down from the side', 'hineri', 'hineri'),
  K('uchimuso', '内無双', 'inner thigh propping twist', 'hineri', 'hineri', 0.25),
  K('uwatehineri', '上手捻り', 'twisting overarm throw', 'hineri', 'hineri', 0.1),
  K('zubuneri', 'ずぶねり', 'head pivot throw', 'hineri', 'hineri', 0.35),
  // 反り手 6
  K('izori', '居反り', 'dives under and lifts backward', 'sori', 'sori', 0.35),
  K('kakezori', '掛け反り', 'hooking backward body drop', 'sori', 'sori', 0.35),
  K('shumokuzori', '撞木反り', 'bell hammer backward drop', 'sori', 'sori', 0.35),
  K('sototasukizori', '外たすき反り', 'outer reverse backward drop', 'sori', 'sori', 0.35),
  K('tasukizori', 'たすき反り', 'reverse backward drop', 'sori', 'sori', 0.35),
  K('tsutaezori', '伝え反り', 'underarm forward body drop', 'sori', 'sori', 0.35),
  // 特殊技 19
  K('hatakikomi', '叩き込み', 'slaps the opponent down', 'tokushu', 'hiki'),
  K('hikiotoshi', '引き落とし', 'pulls the opponent down', 'tokushu', 'hiki'),
  K('hikkake', '引っ掛け', 'grabs the arm and pulls past', 'tokushu', 'hiki', 0.15),
  K('kimedashi', '極め出し', 'locks the arms and forces out', 'tokushu', 'yori', 0.1),
  K('kimetaoshi', '極め倒し', 'locks the arms and forces down', 'tokushu', 'yori', 0.15),
  K('okuridashi', '送り出し', 'pushes out from behind', 'tokushu', 'okuri'),
  K('okurigake', '送り掛け', 'trips from behind', 'tokushu', 'okuri', 0.3),
  K('okurihikiotoshi', '送り引き落とし', 'pulls down from behind', 'tokushu', 'okuri', 0.2),
  K('okurinage', '送り投げ', 'throws from behind', 'tokushu', 'okuri', 0.25),
  K('okuritaoshi', '送り倒し', 'knocks down from behind', 'tokushu', 'okuri', 0.1),
  K('okuritsuridashi', '送り吊り出し', 'lifts out from behind', 'tokushu', 'okuri', 0.3),
  K('okuritsuriotoshi', '送り吊り落とし', 'lifts and slams from behind', 'tokushu', 'okuri', 0.35),
  K('sokubiotoshi', '素首落とし', 'chops down on the neck', 'tokushu', 'hiki', 0.25),
  K('tsuridashi', '吊り出し', 'lifts and carries out', 'tokushu', 'tsuri'),
  K('tsuriotoshi', '吊り落とし', 'lifts and slams down', 'tokushu', 'tsuri', 0.25),
  K('ushiromotare', '後ろもたれ', 'backs into the opponent behind', 'tokushu', 'okuri', 0.35),
  K('utchari', 'うっちゃり', 'backward pivot throw at the edge', 'tokushu', 'utchari', 0.1),
  K('waridashi', '割り出し', 'upper-arm force out', 'tokushu', 'yori', 0.2),
  K('yobimodoshi', '呼び戻し', 'pulling body slam', 'tokushu', 'nage', 0.3),
];

export const KIMARITE = Object.fromEntries(KIMARITE_LIST.map((k) => [k.id, k]));
export const GROUP_COUNTS = Object.fromEntries(GROUPS.map((g) => [g, KIMARITE_LIST.filter((k) => k.group === g).length]));
export const NON_TECH = ['isamiashi', 'koshikudake', 'tsukite', 'tsukihiza', 'fumidashi'];

const EXPECTED = { kihon: 7, kake: 18, nage: 13, hineri: 19, sori: 6, tokushu: 19 };

// 表の検査。誤りを文で返す（空なら正しい）
export function validateKimarite(list, archIds) {
  const errs = [];
  if (list.length !== 82) errs.push(`合計が82でない: ${list.length}`);
  const seen = new Set();
  for (const k of list) {
    if (seen.has(k.id)) errs.push(`重複: ${k.id}`);
    seen.add(k.id);
    if (!GROUPS.includes(k.group)) errs.push(`無い組: ${k.id} ${k.group}`);
    if (!archIds.includes(k.arch)) errs.push(`無い型: ${k.id} ${k.arch}`);
    if (!k.ja || !k.en) errs.push(`名前か説明が無い: ${k.id}`);
    if (k.scenes && !k.scenes.every((s) => SCENE_IDS.includes(s))) errs.push(`無い場面: ${k.id}`);
    if (!(k.diff >= 0 && k.diff <= 0.35)) errs.push(`決まりにくさが範囲外: ${k.id}`);
  }
  for (const g of GROUPS) {
    const n = list.filter((k) => k.group === g).length;
    if (n !== EXPECTED[g]) errs.push(`組の手数が違う: ${g} ${n}（正しくは ${EXPECTED[g]}）`);
  }
  return errs;
}
