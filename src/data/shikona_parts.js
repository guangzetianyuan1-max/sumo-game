// しこ名の部品（設計書「相手のしこ名」）。上の字＋自然の字。読みは英語版の名前に使う。
// 実在の力士によく使われる字（BANNED）は部品に入れない（tests/shikona.test.js が見張る）
export const BANNED = ['朝', '琴', '若', '貴', '白', '鵬', '栃', '千', '北', '照', '稀', '霧', '豊', '魁', '翔', '錦', '大', '武', '隆', '安'];
// 実在の力士・年寄の名（部品の組み合わせが偶然これになったら飛ばす）
export const REAL_NAMES = ['藤島'];
export const PRE = [
  { ja: '雷', en: 'Rai' }, { ja: '嵐', en: 'Arashi' }, { ja: '鶴', en: 'Tsuru' }, { ja: '鷲', en: 'Washi' },
  { ja: '虎', en: 'Tora' }, { ja: '颯', en: 'Hayate' }, { ja: '輝', en: 'Teru' }, { ja: '紅', en: 'Beni' },
  { ja: '玄', en: 'Gen' }, { ja: '蒼', en: 'Ao' }, { ja: '楓', en: 'Kaede' }, { ja: '樫', en: 'Kashi' },
  { ja: '凛', en: 'Rin' }, { ja: '柊', en: 'Hiiragi' }, { ja: '葵', en: 'Aoi' }, { ja: '楠', en: 'Kusu' },
  { ja: '椿', en: 'Tsubaki' }, { ja: '萩', en: 'Hagi' }, { ja: '桐', en: 'Kiri' }, { ja: '藤', en: 'Fuji' },
];
export const SUF = [
  { ja: '山', en: 'yama' }, { ja: '川', en: 'kawa' }, { ja: '海', en: 'umi' }, { ja: '嶺', en: 'ne' },
  { ja: '岩', en: 'iwa' }, { ja: '浪', en: 'nami' }, { ja: '島', en: 'shima' }, { ja: '谷', en: 'tani' },
  { ja: '風', en: 'kaze' }, { ja: '里', en: 'sato' },
];
