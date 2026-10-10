// 強さ合わせの つまみ。強さの数を動かすのは このファイルと src/data/types.js の base だけ（tests/balance.test.js で確かめる）。
export const STRONG_BONUS = 0.06; // 得意な型の上乗せ
export const WEAK_MAX = 0.3; // 弱みの上乗せの最大（弱みを減らす値が0のとき）
export const NOISE = 1.0; // 運のぶれ幅（0.5〜1.5倍）
export const EDGE_AT = 70; // 攻められている側が土俵際に切り替わる位置
export const OUT_AT = 100; // ここを越えたら出た
export const TURN_LIMIT = 14; // これだけ手を重ねたら、位置で勝ちを決める
export const RECOVER = 6; // 1手ごとに戻る体勢
export const OKURI_BELOW = 35; // 送り技は、相手の体勢がこれより下で使える
export const NON_TECH_P = 0.004; // 技でない決まり方が起きる割合（1手あたり）
// 読み合い：引き技・いなし（hiki・hineri）は、相手が押しに来た（drive）手にぶつけると強い
export const COUNTER_BONUS = 0.25;
// 押す距離が体の比で伸びる強さ（前は bout.js に Math.sqrt＝0.5 と書いてあった）
export const PUSH_RATIO_EXP = 0.5;

// 動きの型。kind＝効き方（drive 位置を動かす／fell 体勢を崩して倒す／pull 引いて落とす／behind 後ろから／reverse 土俵際の逆転／shake 振りほどく）
// needs＝使える組み（apart 離れ／grip 組む／any どちらでも）。reach＝離れていても使え、決まると組む
// w＝心・技・体の重み（足して1）。push＝位置の動き。bal＝相手の体勢を削る量。finish＝相手の体勢がこれ以下で決まる。recoil＝引いた側が下がる量
export const ARCH = {
  tsuki: { kind: 'drive', needs: 'apart', scenes: ['tachiai', 'mid'], w: { shin: 0.3, gi: 0.2, tai: 0.5 }, push: 34, bal: 8, after: 'apart' },
  oshi: { kind: 'drive', needs: 'apart', scenes: ['tachiai', 'mid'], w: { shin: 0.3, gi: 0.2, tai: 0.5 }, push: 38, bal: 8, after: 'apart' },
  yori: { kind: 'drive', needs: 'grip', reach: true, scenes: ['tachiai', 'mid'], w: { shin: 0.3, gi: 0.2, tai: 0.5 }, push: 37, bal: 6, after: 'grip' },
  tsuri: { kind: 'drive', needs: 'grip', reach: true, scenes: ['mid', 'edge'], w: { shin: 0.2, gi: 0.2, tai: 0.6 }, push: 44, bal: 5, after: 'grip' },
  nage: { kind: 'fell', needs: 'grip', scenes: ['mid', 'edge'], w: { shin: 0.2, gi: 0.5, tai: 0.3 }, bal: 35, finish: 30 },
  hineri: { kind: 'fell', needs: 'any', scenes: ['mid', 'edge'], w: { shin: 0.2, gi: 0.6, tai: 0.2 }, bal: 15, finish: 30 },
  kake: { kind: 'fell', needs: 'any', scenes: ['mid', 'edge'], w: { shin: 0.2, gi: 0.6, tai: 0.2 }, bal: 30, finish: 35 },
  sori: { kind: 'fell', needs: 'grip', scenes: ['mid', 'edge'], w: { shin: 0.3, gi: 0.6, tai: 0.1 }, bal: 40, finish: 40 },
  hiki: { kind: 'pull', needs: 'any', scenes: ['tachiai', 'mid', 'edge'], w: { shin: 0.3, gi: 0.5, tai: 0.2 }, bal: 30, finish: 30, recoil: 12 },
  okuri: { kind: 'behind', needs: 'any', scenes: ['mid', 'edge'], w: { shin: 0.3, gi: 0.4, tai: 0.3 } },
  utchari: { kind: 'reverse', needs: 'grip', scenes: ['edge'], w: { shin: 0.5, gi: 0.3, tai: 0.2 } },
};

// 作戦表に使える手が1つも無いときの動き。weak＝力の出る割合。outAs＝これで出したときの決まり手
export const DEFAULT_MOVES = {
  _press: { kind: 'drive', needs: 'apart', w: { shin: 0.3, gi: 0.2, tai: 0.5 }, push: 15, bal: 5, after: 'apart', outAs: 'oshidashi', weak: 0.8 },
  _shake: { kind: 'shake', needs: 'grip', w: { shin: 0.3, gi: 0.3, tai: 0.4 }, weak: 0.8 },
};
