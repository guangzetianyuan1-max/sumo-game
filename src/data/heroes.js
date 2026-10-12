// 主人公5人（設計書 §5・10/12 夜 本人「主人公のキャラクターは5つ」「新技は1キャラ5つ・各キャラの特性にあった新技」）
// id はタイプの id と同じ（取組の計算・ドットの絵・声はタイプの物を使う）。名前・性格・新技の名前は i18n の hero.<id>.name / .trait・newtech.<id>
// press＝押し方（mash 連打・hold 長押し・tap 一発）・arch＝系統（tuning.js の ARCH・相性に使う）。第1段は解禁と覚えた記録だけ
import { TYPE_IDS } from './types.js?v=28';

export const HERO_IDS = [...TYPE_IDS];
export const HEROES = {
  heavy: { newTechs: [
    { id: 'jusensha', press: 'mash', arch: 'oshi' }, { id: 'yamakuzushi', press: 'mash', arch: 'oshi' },
    { id: 'nadare', press: 'hold', arch: 'yori' }, { id: 'daifunka', press: 'hold', arch: 'tsuri' },
    { id: 'jihibiki', press: 'tap', arch: 'hiki' },
  ] },
  small: { newTechs: [
    { id: 'shippu', press: 'mash', arch: 'tsuki' }, { id: 'tornado', press: 'hold', arch: 'nage' },
    { id: 'tsubame', press: 'tap', arch: 'hineri' }, { id: 'inazuma', press: 'tap', arch: 'kake' },
    { id: 'kagebunshin', press: 'tap', arch: 'hiki' },
  ] },
  balance: { newTechs: [
    { id: 'samidare', press: 'mash', arch: 'tsuki' }, { id: 'mangetsu', press: 'hold', arch: 'yori' },
    { id: 'daisharin', press: 'hold', arch: 'hineri' }, { id: 'kazaguruma', press: 'tap', arch: 'nage' },
    { id: 'mikazuki', press: 'tap', arch: 'sori' },
  ] },
  yotsu: { newTechs: [
    { id: 'manriki', press: 'mash', arch: 'yori' }, { id: 'orochi', press: 'hold', arch: 'yori' },
    { id: 'tatsumaki', press: 'hold', arch: 'tsuri' }, { id: 'taiju', press: 'hold', arch: 'nage' },
    { id: 'teppeki', press: 'tap', arch: 'utchari' },
  ] },
  tall: { newTechs: [
    { id: 'yaribusuma', press: 'mash', arch: 'tsuki' }, { id: 'tenku', press: 'hold', arch: 'nage' },
    { id: 'owashi', press: 'hold', arch: 'yori' }, { id: 'rakurai', press: 'tap', arch: 'hiki' },
    { id: 'nagaude', press: 'tap', arch: 'hineri' },
  ] },
};
// 新技の解禁：倒した数がこの数に届くと、newTechs の同じ番目が稽古で覚えられる（0＝入門の時から）
export const NEW_TECH_AT = [0, 20, 40, 60, 80];
export const newTechIds = (type) => HEROES[type].newTechs.map((x) => x.id);
