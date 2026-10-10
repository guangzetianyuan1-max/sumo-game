// 番付の梯子（上から）。slots＝席の数（東西を合わせた数）・bouts＝一場所の取組の数
export const DIVISIONS = [
  { id: 'yokozuna', slots: 2, bouts: 15 },
  { id: 'ozeki', slots: 2, bouts: 15 },
  { id: 'sekiwake', slots: 2, bouts: 15 },
  { id: 'komusubi', slots: 2, bouts: 15 },
  { id: 'maegashira', slots: 32, bouts: 15 },
  { id: 'juryo', slots: 28, bouts: 15 },
  { id: 'makushita', slots: 60, bouts: 7 },
  { id: 'sandanme', slots: 80, bouts: 7 },
  { id: 'jonidan', slots: 80, bouts: 7 },
  { id: 'jonokuchi', slots: 40, bouts: 7 },
];
export const LADDER_SIZE = DIVISIONS.reduce((s, d) => s + d.slots, 0);
