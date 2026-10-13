// 昇進表（20体版・10/13 本人「まずは20体までを完成させたい」「2体ごと・18で横綱」）。倒した数で上がり、下がらない
export const PLAY_COUNT = 20; // この版で戦う敵の数（21体目からは続きとして後で足す）
export const RANKS = [
  { id: 'jonokuchi', at: 0 }, { id: 'jonidan', at: 2 }, { id: 'sandanme', at: 4 }, { id: 'makushita', at: 6 },
  { id: 'juryo', at: 8 }, { id: 'maegashira', at: 10 }, { id: 'komusubi', at: 12 }, { id: 'sekiwake', at: 14 },
  { id: 'ozeki', at: 16 }, { id: 'yokozuna', at: 18 },
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

export function nextRank(wins) {
  const r = RANKS.find((x) => x.at > wins);
  return r ? { id: r.id, at: r.at } : null;
}
