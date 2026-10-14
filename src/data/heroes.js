// 主人公はバランス型の1人（10/13 本人「主人公はバランス型のひとり」「新技は15」・前は5人だった）
// id はタイプの id と同じ（取組の計算・ドットの絵・声はタイプの物を使う）。名前・性格・新技の名前は i18n の hero.<id>.name / .trait・newtech.<id>
// press＝押し方（mash 連打・hold 長押し・tap 一発）・arch＝系統（tuning.js の ARCH・相性に使う）。第1段は解禁と覚えた記録だけ
import { KIMETE } from './kimete.js?v=39';

export const HERO_TYPE = 'balance';
export const OKAMI = 'kotone';
export const HERO_IDS = [HERO_TYPE];
// 15の表（第1.5段の物・20体版では使わない。21体目からの続きに残す）
export const CONTINUATION_TECHS = [
  { id: 'samidare', press: 'mash', arch: 'tsuki' }, { id: 'jusensha', press: 'mash', arch: 'oshi' },
  { id: 'mangetsu', press: 'hold', arch: 'yori' }, { id: 'tornado', press: 'hold', arch: 'nage' },
  { id: 'daisharin', press: 'hold', arch: 'hineri' }, { id: 'inazuma', press: 'tap', arch: 'kake' },
  { id: 'kazaguruma', press: 'tap', arch: 'nage' }, { id: 'rakurai', press: 'tap', arch: 'hiki' },
  { id: 'mikazuki', press: 'tap', arch: 'sori' }, { id: 'tatsumaki', press: 'hold', arch: 'tsuri' },
  { id: 'nadare', press: 'hold', arch: 'yori' }, { id: 'tsubame', press: 'tap', arch: 'hineri' },
  { id: 'teppeki', press: 'tap', arch: 'utchari' }, { id: 'yaribusuma', press: 'mash', arch: 'tsuki' },
  { id: 'tenku', press: 'hold', arch: 'nage' },
];
const PRESS = { samidare: 'mash', mangetsu: 'hold', kazaguruma: 'tap', rakurai: 'tap', teppeki: 'tap' };
// 20体版の決め技5つ（kimete.js の並び）
export const HEROES = {
  balance: { newTechs: KIMETE.map((k) => ({ id: k.id, press: PRESS[k.id], arch: k.arch })) },
};
// 決め技の解禁：4体倒すごとに1つ（0・4・8・12・16・10/13 本人「A」）。newTechs の同じ番目が稽古で覚えられる
export const NEW_TECH_AT = KIMETE.map((k) => k.at);
export const newTechIds = (type) => HEROES[type].newTechs.map((x) => x.id);
