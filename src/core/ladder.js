// 昇進表（50体版・10/16 本人「敵50体でクリア」・設計書 2026-10-16 §3）：5勝ごとに昇進・45で横綱・50でクリア。倒した数で上がり、下がらない
export const PLAY_COUNT = 50; // 戦う敵の数（src/data/foes.js の FOE_COUNT と同じ・試験で確かめる）
export const RANKS = [
  { id: 'jonokuchi', at: 0 }, { id: 'jonidan', at: 5 }, { id: 'sandanme', at: 10 }, { id: 'makushita', at: 15 },
  { id: 'juryo', at: 20 }, { id: 'maegashira', at: 25 }, { id: 'komusubi', at: 30 }, { id: 'sekiwake', at: 35 },
  { id: 'ozeki', at: 40 }, { id: 'yokozuna', at: 45 },
];
export const CLEAR_AT = PLAY_COUNT;

export function rankOf(wins) {
  let id = RANKS[0].id;
  for (const r of RANKS) if (wins >= r.at) id = r.id;
  return id;
}

// ちょうどその数に届いた時の昇進先（0 と途中の数は null）
export function promotionAt(wins) {
  const r = RANKS.find((x) => x.at === wins && x.at > 0);
  return r ? r.id : null;
}

// 勝ち数 → 番付の番号（RANKS の何番目・0〜9）。天井（tuning.js の CEILING）を引くのに使う
export function rankIndexOf(wins) {
  const k = RANKS.findIndex((r) => r.id === rankOf(wins));
  return k < 0 ? 0 : k;
}

export function nextRank(wins) {
  const r = RANKS.find((x) => x.at > wins);
  return r ? { id: r.id, at: r.at } : null;
}
