// 10/13 主人公をバランス型1人にした時に外した4人の新技（控え・どこからも読まない）
export const RETIRED_HEROES = {
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
