// 主人公はバランス型の1人（10/13 本人「主人公はバランス型のひとり」「新技は15」・前は5人だった）
// id はタイプの id と同じ（取組の計算・ドットの絵・声はタイプの物を使う）。名前・性格・新技の名前は i18n の hero.<id>.name / .trait・newtech.<id>
// press＝押し方（mash 連打・hold 長押し・tap 一発）・arch＝系統（tuning.js の ARCH・相性に使う）。第1段は解禁と覚えた記録だけ
export const HERO_TYPE = 'balance';
export const OKAMI = 'kotone';
export const HERO_IDS = [HERO_TYPE];
export const HEROES = {
  balance: { newTechs: [
    { id: 'samidare', press: 'mash', arch: 'tsuki' }, { id: 'jusensha', press: 'mash', arch: 'oshi' },
    { id: 'mangetsu', press: 'hold', arch: 'yori' }, { id: 'tornado', press: 'hold', arch: 'nage' },
    { id: 'daisharin', press: 'hold', arch: 'hineri' }, { id: 'inazuma', press: 'tap', arch: 'kake' },
    { id: 'kazaguruma', press: 'tap', arch: 'nage' }, { id: 'rakurai', press: 'tap', arch: 'hiki' },
    { id: 'mikazuki', press: 'tap', arch: 'sori' }, { id: 'tatsumaki', press: 'hold', arch: 'tsuri' },
    { id: 'nadare', press: 'hold', arch: 'yori' }, { id: 'tsubame', press: 'tap', arch: 'hineri' },
    { id: 'teppeki', press: 'tap', arch: 'utchari' }, { id: 'yaribusuma', press: 'mash', arch: 'tsuki' },
    { id: 'tenku', press: 'hold', arch: 'nage' },
  ] },
};
// 新技の解禁：6体倒すごとに1つ（0〜84・10/13 本人「A」）。newTechs の同じ番目が稽古で覚えられる
export const NEW_TECH_AT = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84];
export const newTechIds = (type) => HEROES[type].newTechs.map((x) => x.id);
