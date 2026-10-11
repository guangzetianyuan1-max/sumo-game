// 5つのタイプ（設計書 §1 入門）。base の和は150でそろえる（同じ強さ）。高い=60・中=45〜50・低い=40。
// strong＝得意な動きの型（上乗せ STRONG_BONUS）。weak＝この型を受けると弱い。by の値を上げると弱みが減る。when＝その組みのときだけ効く。
// start＝始めに覚えている3手。sample＝第1段で覚えさせておく見本の10手（習得は第3段で作る）。
// どちらもゲームの手（kimarite.js の IN_GAME・10/11 21手に絞った）だけで書く
export const TYPE_IDS = ['heavy', 'small', 'balance', 'yotsu', 'tall'];

export const TYPES = {
  heavy: {
    base: { shin: 50, gi: 40, tai: 60 },
    strong: ['oshi', 'tsuki', 'yori'],
    weak: { arch: ['hiki', 'hineri'], by: ['shin', 'gi'] },
    start: ['tsukidashi', 'oshidashi', 'yorikiri'],
    sample: ['tsukidashi', 'oshidashi', 'yorikiri', 'tsukitaoshi', 'oshitaoshi', 'yoritaoshi', 'abisetaoshi', 'hatakikomi', 'tsukiotoshi', 'sukuinage'],
    girth: 3, tall: false,
  },
  small: {
    base: { shin: 50, gi: 60, tai: 40 },
    strong: ['hineri', 'kake', 'hiki', 'okuri'],
    weak: { arch: ['yori', 'nage', 'tsuri'], by: ['tai'], when: 'grip' },
    start: ['oshidashi', 'hatakikomi', 'hikiotoshi'],
    sample: ['oshidashi', 'hatakikomi', 'hikiotoshi', 'katasukashi', 'tsukiotoshi', 'sotogake', 'uchigake', 'okuridashi', 'shitatenage', 'tsukidashi'],
    girth: 1, tall: false,
  },
  balance: {
    base: { shin: 50, gi: 50, tai: 50 },
    strong: [],
    weak: null,
    start: ['oshidashi', 'yorikiri', 'uwatenage'],
    sample: ['oshidashi', 'yorikiri', 'uwatenage', 'shitatenage', 'tsukiotoshi', 'hatakikomi', 'sotogake', 'kotenage', 'tsukidashi', 'utchari'],
    girth: 2, tall: false,
  },
  yotsu: {
    base: { shin: 60, gi: 45, tai: 45 },
    strong: ['yori', 'nage'],
    weak: { arch: ['oshi', 'tsuki'], by: ['gi'], when: 'apart' },
    start: ['yorikiri', 'uwatenage', 'shitatenage'],
    sample: ['yorikiri', 'uwatenage', 'shitatenage', 'yoritaoshi', 'uwatedashinage', 'sukuinage', 'kotenage', 'tsuridashi', 'utchari', 'uchigake'],
    girth: 2, tall: false,
  },
  tall: {
    base: { shin: 40, gi: 50, tai: 60 },
    strong: ['nage', 'tsuri', 'hiki'],
    weak: { arch: ['kake', 'sori', 'hineri'], by: ['shin'] },
    start: ['yorikiri', 'uwatenage', 'tsuridashi'],
    sample: ['yorikiri', 'uwatenage', 'tsuridashi', 'shitatenage', 'hatakikomi', 'hikiotoshi', 'kotenage', 'sukuinage', 'oshidashi', 'utchari'],
    girth: 2, tall: true,
  },
};
