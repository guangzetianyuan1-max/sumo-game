// 敵20体それぞれの必殺技（10/14 本人「各敵キャラも必殺技を持つように」・設計書 2026-10-14-sumo-one-button-ring-bar-design.md §4.5）
// 名前は i18n の foekime.<id>。arch＝決め技の系統（kami.js の KIMETE_FX）：突き tsuki・はたき hiki・投げ nage・寄り yori・うっちゃり utchari
// 系統は型から：重量＝突き・小兵＝はたき・長身＝投げ・四つ＝寄り・バランス＝敵ごと（釣り人は四つでも一本釣り＝投げ・農家と大ボスはうっちゃり）
export const FOE_KIMETE = {
  robot: { id: 'robot_rocket', arch: 'tsuki' },
  ninja: { id: 'ninja_leaf', arch: 'hiki' },
  alien: { id: 'alien_saucer', arch: 'nage' },
  itamae: { id: 'itamae_fillet', arch: 'tsuki' },
  daiku: { id: 'daiku_pillar', arch: 'yori' },
  shobo: { id: 'shobo_hose', arch: 'tsuki' },
  yubin: { id: 'yubin_express', arch: 'hiki' },
  samurai: { id: 'samurai_iai', arch: 'nage' },
  astronaut: { id: 'astronaut_zerog', arch: 'nage' },
  wizard: { id: 'wizard_broom', arch: 'hiki' },
  dino: { id: 'dino_eruption', arch: 'tsuki' },
  snowman: { id: 'snowman_bigball', arch: 'yori' },
  manekineko: { id: 'manekineko_crowd', arch: 'tsuki' },
  vending: { id: 'vending_jackpot', arch: 'yori' },
  shogi: { id: 'shogi_fork', arch: 'nage' },
  fisher: { id: 'fisher_bigcatch', arch: 'nage' },
  farmer: { id: 'farmer_harvest', arch: 'utchari' },
  prowrestler: { id: 'prowrestler_lariat', arch: 'tsuki' },
  kappa: { id: 'kappa_plate', arch: 'hiki' },
  pirate: { id: 'pirate_sevenseas', arch: 'utchari' },
};
export const FOE_KIMETE_IDS = Object.keys(FOE_KIMETE).map((k) => FOE_KIMETE[k].id);
