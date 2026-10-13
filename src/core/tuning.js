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
// 心技体の伸び（10/12 作り直し：稽古を無くし、勝つたびに伸びる。本人「相手に勝ったら、心技体が少しづつ加算され強くなる」）
// start＝入門の値＝タイプの base（和150の形）×start（どれも10以下）。win＝勝ち1つの伸び（×タイプの伸びやすさ×部屋×格上×鈍り）
// lossMult＝負けの伸び（勝ちに対する比）。upsetMax＝格上に勝った時の上限の倍率（席の差 upsetSpan で上限に届く）
// 伸びは値が上がるほど鈍る：×max(dimFloor, 1 − 値/dimDen)。win の値は tests/basho.test.js の「一代の伸び」の帯に合わせる
// 10/12 測った（8つの種）win 0.66＝十両 11〜13・入幕 17.5〜19・大関 26.5〜29・横綱 31.5〜35 場所目（0.9 は早すぎ・0.62 は小兵の横綱が41でタイプの差7.5）
export const GROWTH = { start: 1 / 6, win: 0.66, lossMult: 0.2, upsetMax: 1.5, upsetSpan: 40, upsetSpanTotal: 30, dimDen: 101, dimFloor: 0.02 };
// 部屋の伸びやすい心技体（data/heya.js の grows）は伸びがこれだけ多い
export const HEYA_GROW_MULT = 1.1;
// 場所の相手の心技体の和：席 → 和 の折れ線（間はまっすぐつなぐ・各値は100まで）。
// 下の段（7番）は勝ち越し1つで12席動くので緩く、十両から上は2席ずつなので細かく、横綱の2席だけ跳ね上げる
export const OPP_TOTAL = {
  anchors: [[0, 290], [2, 226], [4, 204], [8, 188], [22, 174], [40, 171], [68, 138], [128, 96], [208, 60], [327, 25]], // 最後の席は LADDER_SIZE − 1 ＝ 327
};

// 勝ち抜きの敵の心技体の和：何体目（0から）→ 和 の折れ線。最後の1体が一番強い
// 20体版（10/13 Task 3・一生の通し careersim で合わせた）：1体目は100体版と同じ 22・20体目（大ボス）は100体版の index 59〜79 くらい（170〜210）の 206。
// 10体目（index 9＝十両の最後・敵が決め技を持つ前の関門）で 49→158 へ一段上げ、11〜19体目はそのまま（強さは機械のたたき方 CPU_CURVE20 と決め技で上がる）
// [99, 280] は21体目からの続き用（今は使わない）。値は機械の探し（直し1）で、型の重さ TYPE_MASS（kamiai.js）・TRAIN.gain と組みで決めた
// 10/13 測った（試験の種と、外の種4組 計380の一生）：1体目の初挑戦 93〜98%・10体目 55〜66%・大ボス 35〜53%・1〜19体目の初挑戦はどれも 48%以上・稽古の中央値 5〜6・取組の中央値 25〜26
export const FOE_TOTAL = {
  anchors: [[0, 22], [4, 41], [8, 49], [9, 158], [18, 158], [19, 206], [99, 280]],
};
// 稽古1コマの伸び（選んだ1つの値に gain × タイプの伸びやすさ × 鈍り）＝勝ち約4番ぶん
// gain 4（約2番ぶん）では稽古が110回に届き、稽古なしの行き詰まりも70超のままだった（10/12 合わせ）
// 20体版（10/13 Task 3）：8→14（直し1・11体目の壁を消す合わせの組み。負けた後の稽古1回で次の敵に届く）
export const TRAIN = { gain: 14 };

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
