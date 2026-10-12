// 昇進表（設計書 §4・10/12 夜 本人「途中昇進を設ける。90で横綱」）。倒した数で上がり、下がらない
export const RANKS = [
  { id: 'jonokuchi', at: 0 }, { id: 'jonidan', at: 5 }, { id: 'sandanme', at: 15 }, { id: 'makushita', at: 25 },
  { id: 'juryo', at: 35 }, { id: 'maegashira', at: 45 }, { id: 'komusubi', at: 60 }, { id: 'sekiwake', at: 70 },
  { id: 'ozeki', at: 80 }, { id: 'yokozuna', at: 90 },
];
export const CLEAR_AT = 100; // 100体倒してクリア

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
