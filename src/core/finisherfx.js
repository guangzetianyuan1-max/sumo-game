// 必殺技の演出（設計書 2026-10-16-sumo-50-foes-design.md §6.5・10/16 本人「主人公、敵も、必殺技により演出を派手に。回転する。飛び跳ねる」「後半に行くほど、演出は派手に」）。
// 勝ち負けと強さは kami.js の計算のまま＝ここは画面の上だけ（取組の画面が時計を止めている間に見せる）。Phaser から切り離した純粋な関数（Math.random を使わない）
// 段 tier＝敵の番号で5段（1〜10・11〜20・21〜30・31〜40・41〜50体目）。主人公の技も今戦っている敵の段
// 動きの部品は系統ごとに1つずつ（ARCH_MOVES の頭から段の数だけ）・技ごとの飾りは表（FINISHER_DECOR）・系統ごとの元の効果（ARCH_BASE）
// 酔いと見にくさ：画面全体は回さない（回るのは型紙だけ）・光は 0.5 以下・揺れは 0.2 秒以内（v41 の決まり）

export const FX_LIMIT = { secs: 1.5, bossSecs: 2.0, flash: 0.5, shake: 0.2 };
// 段ごとの大きさ：secs＝長さ・stages＝動きの段数・spins＝回る回数・jump＝跳ぶ高さ px・ghosts＝残像の数・dust＝土ぼこりの粒・edge＝画面の縁の色の光・decorScale＝飾りの大きさ
export const TIER_FX = [
  { secs: 0.8, stages: 1, spins: 1, jump: 60, ghosts: 0, dust: 6, edge: false, decorScale: 0.6, flash: 0.15, shake: { px: 3, s: 0.1 } },
  { secs: 1.0, stages: 1, spins: 2, jump: 110, ghosts: 3, dust: 10, edge: false, decorScale: 0.8, flash: 0.2, shake: { px: 4, s: 0.12 } },
  { secs: 1.2, stages: 1, spins: 2, jump: 140, ghosts: 3, dust: 18, edge: false, decorScale: 1.0, flash: 0.3, shake: { px: 5, s: 0.15 } },
  { secs: 1.4, stages: 2, spins: 3, jump: 170, ghosts: 4, dust: 22, edge: true, decorScale: 1.2, flash: 0.4, shake: { px: 6, s: 0.18 } },
  { secs: 1.5, stages: 3, spins: 3, jump: 200, ghosts: 5, dust: 28, edge: true, decorScale: 1.5, flash: 0.5, shake: { px: 7, s: 0.2 } },
];
export const WEAK_FX = 0.5; // 弱い必殺技（倒さない・1〜4体目）は動きを半分
export const WEAK_UNTIL = 4; // 演出を小さくするのは 1〜4体目（番号 0〜3）の倒さない必殺技だけ（preflight M1：農家 9体目・海賊 44体目は強さが downMin の下でも段のとおり＝後半ほど派手に）
export const BOSS_FINALE = 0.5; // 大ボスの取組だけの締めの秒（合わせて 2.0 秒まで）
export const GHOST_DT = 0.05; // 残像の時刻の間（秒）
// 系統ごとの動き（設計書 §6.5 の表）：段の数だけ頭から使う。thrust＝前へ小刻みに突き出す・charge＝低く突進・spin＝縦の軸で回って裏返る・leap＝高く跳ぶ・flip＝後ろへ宙返り
export const ARCH_MOVES = {
  tsuki: ['thrust', 'leap', 'spin'],
  yori: ['charge', 'leap', 'spin'],
  nage: ['spin', 'leap', 'spin'],
  hiki: ['leap', 'spin', 'leap'],
  utchari: ['flip', 'leap', 'spin'],
};
// 飾りの種類：type＝描く形（src/ui/finisherfx.js）・motion＝動き方・n＝数・size＝大きさ px
export const DECOR = {
  rain: { type: 'line', motion: 'fall', n: 10, size: 46 },
  moon: { type: 'circle', motion: 'grow', n: 1, size: 90 },
  windmill: { type: 'blade', motion: 'spin', n: 4, size: 90 },
  bolt: { type: 'bolt', motion: 'strike', n: 2, size: 220 },
  wall: { type: 'rect', motion: 'grow', n: 3, size: 70 },
  swirl: { type: 'arc', motion: 'spin', n: 3, size: 80 },
  ink: { type: 'dot', motion: 'burst', n: 12, size: 14 },
  flame: { type: 'tri', motion: 'rise', n: 8, size: 30 },
  petal: { type: 'ellipse', motion: 'fall', n: 10, size: 16 },
  snow: { type: 'dot', motion: 'fall', n: 14, size: 8 },
  wave: { type: 'arc', motion: 'burst', n: 4, size: 60 },
  leaf: { type: 'ellipse', motion: 'spin', n: 8, size: 18 },
  star: { type: 'star', motion: 'burst', n: 6, size: 18 },
  steam: { type: 'dot', motion: 'rise', n: 8, size: 20 },
  gold: { type: 'line', motion: 'burst', n: 12, size: 60 },
  ring: { type: 'circle', motion: 'grow', n: 2, size: 70 },
};
// 系統ごとの元の効果（§6.5 の表の「効果」）：突き＝朱の衝撃の輪・寄り＝土ぼこり・投げ＝金の弧・はたき＝稲妻の線・うっちゃり＝星
export const ARCH_BASE = { tsuki: ['ring', 0xd2342a], yori: ['steam', 0xe8d6a6], nage: ['gold', 0xe3c27a], hiki: ['bolt', 0xfff3c4], utchari: ['star', 0xfff3c4] };
// 技ごとの「その技らしさ」（§6.5）：主人公5＋敵50＝55
export const FINISHER_DECOR = {
  samidare: ['rain', 0x8fc4ff], mangetsu: ['moon', 0xfff3c4], kazaguruma: ['windmill', 0xe3c27a], rakurai: ['bolt', 0xffe066], teppeki: ['wall', 0xb0b7c0],
  robot_rocket: ['flame', 0xff8c00], ninja_leaf: ['leaf', 0x27ae60], alien_saucer: ['swirl', 0x9b59b6], itamae_fillet: ['gold', 0xecf0f1], daiku_pillar: ['wall', 0x8b5a2b],
  shobo_hose: ['rain', 0x5dade2], yubin_express: ['star', 0xe74c3c], samurai_iai: ['gold', 0xd5d8dc], astronaut_zerog: ['star', 0xaed6f1], wizard_broom: ['star', 0x8e44ad],
  dino_eruption: ['flame', 0xe74c3c], snowman_bigball: ['snow', 0xffffff], manekineko_crowd: ['gold', 0xf1c40f], vending_jackpot: ['gold', 0xf39c12], shogi_fork: ['wall', 0xd4ac0d],
  fisher_bigcatch: ['wave', 0x2e86c1], farmer_harvest: ['leaf', 0xd4ac0d], prowrestler_lariat: ['ring', 0xe74c3c], kappa_plate: ['rain', 0x48c9b0], pirate_sevenseas: ['wave', 0x1a5276],
  kaedesato_morote: ['leaf', 0xd2691e], pan_kneading: ['steam', 0xf5deb3], ekiin_bell: ['star', 0xf1c40f], hagikawa_hikiotoshi: ['petal', 0xc678c0], niwashi_pruning: ['leaf', 0x27ae60],
  tsubakinami_gaburi: ['wave', 0x5dade2], akabeko_headbob: ['flame', 0xc0392b], okiagari_yaoki: ['star', 0xe74c3c], kokeshi_spin: ['petal', 0xf1948a], kashitani_nodowa: ['leaf', 0x8b5a2b],
  tanuki_drumbelly: ['ring', 0x8b5a2b], daruma_knockout: ['gold', 0xc0392b], aone_uwatenage: ['swirl', 0x5dade2], haniwa_dance: ['steam', 0xc68e5a], benishima_hatakikomi: ['flame', 0xe74c3c],
  kuma_bearhug: ['leaf', 0x6b4423], geniwa_denshamichi: ['steam', 0xbdc3c7], inoshishi_headlong: ['steam', 0x8b7355], onigawara_roof: ['wall', 0x555b66], washiumi_tsuriotoshi: ['wave', 0x2e86c1],
  tengu_fan: ['leaf', 0xc0392b], torakaze_edge: ['swirl', 0xf39c12], umibozu_tidal: ['wave', 0x1f618d], odako_ink: ['ink', 0x111111], raine_teppo: ['bolt', 0xf1c40f],
  yukiotoko_avalanche: ['snow', 0xecf0f1], kaminari_drum: ['bolt', 0xf4d03f], fujin_windbag: ['swirl', 0x58d68d], ryujin_rising: ['swirl', 0x16a085], oni_kishin: ['flame', 0xc0392b],
};
// 弱い演出か：相手（west）の技で、1〜4体目の時だけ。主人公の技はいつも段のとおり
export function weakFinisher(side, foeIndex) {
  return side === 'west' && typeof foeIndex === 'number' && Number.isFinite(foeIndex) && foeIndex >= 0 && foeIndex < WEAK_UNTIL;
}

const SPREAD = [90, 140, 260, 300, 340]; // 段ごとの飾りの広がり（px）：3段目からは画面の上半分まで
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// 敵の番号 → 段 0〜4（範囲の外は端・数でない値は 0）
export function finisherTier(foeIndex) {
  const i = Math.floor(Number(foeIndex));
  if (!Number.isFinite(i) || i < 0) return 0;
  return Math.min(TIER_FX.length - 1, Math.floor(i / 10));
}

// 演出の段取り。arch＝系統・kime＝技の id（飾り）・foeIndex＝今戦っている敵の番号・weak＝倒さない弱い必殺技・boss＝大ボスの取組（締めがつく）
export function finisherPlan({ arch, kime = null, foeIndex = 0, weak = false, boss = false } = {}) {
  const a = has(ARCH_MOVES, arch) ? arch : 'tsuki';
  const tier = finisherTier(foeIndex);
  const fx = TIER_FX[tier];
  const s = weak ? WEAK_FX : 1;
  const decor = kime && has(FINISHER_DECOR, kime) ? FINISHER_DECOR[kime] : ARCH_BASE[a];
  const secs = Math.min(boss ? FX_LIMIT.bossSecs : FX_LIMIT.secs, fx.secs * (weak ? 0.8 : 1) + (boss ? BOSS_FINALE : 0));
  return {
    arch: a, kime, tier, boss: !!boss, weak: !!weak, secs,
    moves: ARCH_MOVES[a].slice(0, weak ? 1 : fx.stages),
    spins: weak ? 1 : fx.spins, jump: fx.jump * s, thrusts: 3 + Math.min(2, tier), ghosts: weak ? 0 : fx.ghosts,
    spread: SPREAD[tier] * (weak ? 0.6 : 1), dust: Math.round(fx.dust * s), edge: fx.edge && !weak, decorScale: fx.decorScale * s,
    decor: { kind: decor[0], color: decor[1] }, base: ARCH_BASE[a],
    flash: Math.min(FX_LIMIT.flash, fx.flash * s), shake: { px: fx.shake.px * s, s: Math.min(FX_LIMIT.shake, fx.shake.s) },
    finaleFrom: boss ? (secs - BOSS_FINALE) / secs : 1,
  };
}

const neutral = () => ({ att: { dx: 0, dy: 0, rot: 0, sx: 1 }, rec: { dx: 0, dy: 0, rot: 0 } });

// 技を出す側の1つの動き（v＝その動きの中の 0〜1・始めと終わりは 0／回転は回り切る）
function moveAt(move, v, p) {
  const hump = Math.sin(Math.PI * v);
  if (move === 'thrust') return { dx: 28 * Math.abs(Math.sin(Math.PI * p.thrusts * v)), dy: 0, rot: 0, sx: 1 };
  if (move === 'charge') return { dx: 70 * hump * (p.weak ? 0.5 : 1), dy: 12 * hump, rot: -0.15 * hump, sx: 1 };
  if (move === 'leap') return { dx: 0, dy: -p.jump * hump, rot: 0, sx: 1 };
  if (move === 'spin') return { dx: 0, dy: -0.3 * p.jump * hump, rot: 0, sx: Math.cos(2 * Math.PI * p.spins * v) };
  if (move === 'flip') return { dx: -30 * hump, dy: -p.jump * hump, rot: -2 * Math.PI * v, sx: 1 };
  return { dx: 0, dy: 0, rot: 0, sx: 1 };
}

// 受ける側（u＝体の動きの中の 0〜1・env＝1つの山）：突き＝はじかれて傾く・寄り＝押されて一緒に滑る・投げ＝弧を描いて2回転・はたき＝前へつんのめる・うっちゃり＝頭の上を越えて背中側へ
function recAt(arch, u, env, p) {
  const s = p.weak ? 0.5 : 1;
  if (arch === 'tsuki') return { dx: 40 * env * s, dy: 0, rot: 0.35 * env * s };
  if (arch === 'yori') return { dx: 60 * env * s, dy: 0, rot: 0.1 * env * s };
  if (arch === 'nage') return { dx: 50 * env * s, dy: -1.2 * p.jump * env, rot: 2 * Math.PI * (p.weak ? 1 : 2) * u };
  if (arch === 'hiki') return { dx: -20 * env * s, dy: 10 * env * s, rot: -0.9 * env * s };
  return { dx: -90 * env * s, dy: -p.jump * env, rot: -2 * Math.PI * u };
}

// t 秒（演出の始まりから）の型紙の動き。dx＝技を出す側から見て前が＋（画面は東なら そのまま・西なら左右を返す）・dy＝画面の下が＋・rot＝回り（ラジアン）・sx＝横の縮み（回って裏返る）
// 始め（t ≤ 0）と終わり（t ≥ secs）と大ボスの締めの間は 0（演出の前後で型紙が飛ばない）
export function finisherPose(plan, t) {
  if (!plan || !(plan.secs > 0)) return neutral();
  const u = t / plan.secs;
  if (!(u > 0) || u >= plan.finaleFrom || u >= 1) return neutral();
  const b = u / plan.finaleFrom;
  const n = plan.moves.length;
  const k = Math.min(n - 1, Math.floor(b * n));
  const v = b * n - k;
  return { att: moveAt(plan.moves[k], v, plan), rec: recAt(plan.arch, b, Math.sin(Math.PI * b), plan) };
}

// 残像：GHOST_DT 秒ずつ前の時刻の、技を出す側の姿（古いほど薄い・0.35 以下）。始まる前の時刻は無い。
// 大ボスの締め（finaleFrom から後）は本体が元の位置へ戻る＝残像は出さない（締めの前の姿が本体とずれて残らない・最終レビュー Important 4）
export function ghostPoses(plan, t) {
  const out = [];
  if (!plan || !(plan.secs > 0) || t / plan.secs >= plan.finaleFrom) return out;
  for (let k = 1; k <= plan.ghosts; k++) {
    const tk = t - k * GHOST_DT;
    if (tk > 0) out.push({ alpha: 0.35 * (1 - k / (plan.ghosts + 1)), pose: finisherPose(plan, tk).att });
  }
  return out;
}

// 決まった並びの小さな乱れ（0〜1・同じ k と salt なら同じ値）
const jit = (k, salt) => { const x = Math.sin((k + 1) * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };

// t 秒の飾りの形（画面の座標）。at＝技の当たる所（2枚の型紙の間の胸の高さ）。終わったら []
export function decorAt(plan, t, at) {
  const u = plan.secs > 0 ? t / plan.secs : 1;
  if (!(u >= 0) || u >= 1) return [];
  const fade = u < 0.15 ? u / 0.15 : u > 0.8 ? (1 - u) / 0.2 : 1;
  const R = plan.spread, out = [];
  const layer = (kind, color, mul, salt) => {
    const d = DECOR[kind];
    if (!d) return;
    const n = Math.max(1, Math.round(d.n * mul));
    for (let k = 0; k < n; k++) {
      const a = 2 * Math.PI * (k / n) + jit(k, salt) * 0.6;
      const r0 = R * (0.3 + 0.7 * jit(k, salt + 1));
      let x = at.x, y = at.y, rot = a;
      if (d.motion === 'burst') { x += Math.cos(a) * r0 * u; y += Math.sin(a) * r0 * u * 0.8; }
      else if (d.motion === 'fall') { x += (jit(k, salt + 2) - 0.5) * 2 * R; y += -R + 2 * R * ((u + jit(k, salt + 3)) % 1); rot = 0.4; }
      else if (d.motion === 'rise') { x += (jit(k, salt + 2) - 0.5) * 1.4 * R; y -= 1.2 * R * ((u + jit(k, salt + 3)) % 1); rot = 0; }
      else if (d.motion === 'spin') { const s = a + u * 4 * Math.PI; x += Math.cos(s) * r0 * 0.7; y += Math.sin(s) * r0 * 0.5; rot = s; }
      else if (d.motion === 'strike') { x += (k - (n - 1) / 2) * 60; y -= R * (1 - u); rot = 0; }
      const size = d.size * plan.decorScale * (d.motion === 'grow' ? 0.4 + 1.2 * u + 0.3 * k : 1);
      out.push({ type: d.type, x, y, size, rot, color, alpha: Math.max(0, Math.min(0.9, 0.9 * fade)) });
    }
  };
  layer(plan.base[0], plan.base[1], 1, 1);
  layer(plan.decor.kind, plan.decor.color, 1 + 0.5 * plan.tier, 7);
  if (plan.boss && u >= plan.finaleFrom) layer('gold', 0xffd700, 2, 13); // 大ボスの取組だけの締め：金の光の線が大きく舞う
  return out;
}

// 回る軸（画面の確かめで足した・Task 8）：型紙の原点は足もと（origin 0.5, 1）。足もとの軸で半回転すると頭が箱の下へ垂れる＝
// 足す回り rot（ラジアン・画面の向き）の軸の高さを、回りの大きさで足もと（0）→体の真ん中（h/2・四分の一回転から先）へ連続に上げ、その分だけ足もとをずらす
export function pivotOffset(rot, h) {
  const r = Number.isFinite(rot) ? rot : 0;
  const p = (Math.max(0, h) / 2) * Math.min(1, Math.abs(r) / (Math.PI / 2));
  return { dx: 0 - p * Math.sin(r), dy: p * Math.cos(r) - p };
}
