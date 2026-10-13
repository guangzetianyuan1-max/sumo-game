// 紙相撲の計算（10/13 本人「紙相撲に切り替える」・設計書 2026-10-13-sumo-kamizumo-design.md）
// 画面から切り離した、型紙2枚の動き。単位＝画面の px と秒。x＝足もとの真ん中・y＝箱の面からの高さ（上が＋）
// a＝傾き（＋＝自分の後ろへ反る）。東＝主人公＝左から右へ（dir +1）・西＝敵＝右から左へ（dir -1）
import { makeRng } from './rng.js?v=33';

export const KAMI = {
  BOX: { l: 40, r: 680 },
  RING: { l: 150, r: 570 },
  BEAT: 0.52,
  G: 2400,            // 重さで落ちる速さ（px/秒²）
  HOP_VY: 205,        // 1回の跳ねの上向きの速さ（10/13 Task 2 で 420→205・低い跳ね＝速くたたいても空振りが増え、たたく速さの差が効きすぎない）
  HOP_VX: 430,        // 1回の跳ねで前へ出る速さ（重さで割る・10/13 Task 2 で 170→430）
  CHARGE: 420,        // 立ち合いの当たりの速さ
  FINISH: 280,        // 決め技で相手を飛ばす速さ（決め技の強さ×・相手の重さで割る・10/13 Task 2 で 900→280＝一発で必ず飛ぶのでなく、強い押し。心技体の差が効く）
  FRICTION: 0.75,     // 着地中、1コマごとに残る横の速さ（倒れている時は 0.93・10/13 Task 2 で 0.82→0.75）
  RESTITUTION: 0.2,
  KICK: 0.00035,      // ぶつかった時に後ろへ反る強さ（10/13 Task 2 で 0.0009→0.00035）
  SPIN: 0.03,         // 跳ねるたびの傾きのゆらぎ
  DAMP: 0.9,
  FALL_A: 1.0,        // これより傾いたら倒れる（ラジアン）
  EDGE: 225,          // 相手の足が箱の端からこの内側に入ったらゲージ（10/13 Task 2 で 110→225）
  EDGE_SELF: 90,      // うっちゃり：自分の足が、自分の背中側の箱の端からこの内側にいたらゲージ（20体版）
  NEAR: 190,          // 相手との間がこの内なら近い（20体版からゲージには使わない＝決め技ごとの届く距離 KIMETE_REACH）
  MOMENTUM: 0.18,
  LATE: 30, LATE_UP: 0.08,
  FALL_Y: -40,
  MAX_DT: 1 / 30,
};

// 20体版：決め技の系統ごとの届く距離（相手との足もとの間・px）。型紙の幅が 90 なので、くっついた時の間は 90
export const KIMETE_REACH = { tsuki: 130, yori: 110, nage: 100, hiki: 120, utchari: 120 };

// 20体版：決め技の系統ごとの動き。強さ s＝KAMI.FINISH×決め技の強さ×相性×（光ってすぐ 1・遅い 0.4）÷相手の重さ
// vx＝相手へ足す横の速さ（s に掛ける）・vy＝上向きの速さ・time/push＝寄り続ける秒と、1コマごとに足す速さ（s に掛ける）
// va＝倒す回り・down＝倒す。うっちゃりは相手を相手自身の後ろへ
export const KIMETE_FX = {
  tsuki: { vx: 1, vy: 260 },                       // 突き：前へ突き飛ばし、少し浮かせる（今までの決め技）
  yori: { vx: 0.5, vy: 0, time: 0.6, push: 0.11 }, // 寄り：浮かせず、0.6秒 押し続ける（その間 相手は跳ねられない）
  nage: { vx: 0.7, vy: 520, va: 0.25 },            // 投げ：高く放り上げ、大きく回す（倒れやすい）
  hiki: { vx: 0.9, down: true },                   // 引き：前へつんのめらせて倒す。倒れた型紙は滑る（相手の後ろ＝箱の端へ）
  utchari: { vx: 2.8, vy: 300, down: true },       // うっちゃり：自分が端の時、相手を相手自身の後ろへ大きく飛ばす
};
const ARCHS = Object.keys(KIMETE_FX);

const SIDES = ['east', 'west'];
const other = (s) => (s === 'east' ? 'west' : 'east');

function fighter(p, x, dir) {
  return {
    mass: p.mass, right: p.right, standTime: p.standTime, gaugeTime: p.gaugeTime, finisher: p.finisher, w: p.w,
    canFinish: p.canFinish !== false, // false なら決め技を出さない（古い呼び方。20体版は kimete の有る無しで決める）
    kimete: p.kimete && ARCHS.indexOf(p.kimete.arch) >= 0 ? { arch: p.kimete.arch, power: p.kimete.power > 0 ? p.kimete.power : 1 } : null, // 決め技の系統と相性の倍率（無い＝光らない）
    x, y: 0, vx: 0, vy: 0, a: 0, va: 0, dir,
    down: false, held: false, standHeld: 0, stun: 0, fell: false, taps: [], charged: false,
    litUntil: 0, litFrom: 0, cool: 0, pushT: 0, pushV: 0,
  };
}

export function newBout({ east, west, seed }) {
  const rng = makeRng(seed);
  const st = {
    t: 0, phase: 'ready', signalAt: 1 + rng() * 0.8, rng,
    f: { east: fighter(east, 290, 1), west: fighter(west, 430, -1) },
    winner: null, how: null, finisherBy: null, finisherAt: -Infinity, finisherArch: null,
    lastKimete: null, // 最後に出た決め技 { side, arch }（画面の演出用）
  };
  return st;
}

export function beatOffset(st) {
  const ph = (st.t % KAMI.BEAT) / KAMI.BEAT;
  return Math.min(ph, 1 - ph) * KAMI.BEAT;
}

const boost = (st) => (st.t > KAMI.LATE ? 1 + KAMI.LATE_UP * (st.t - KAMI.LATE) : 1);
const onBox = (f) => f.x >= KAMI.BOX.l && f.x <= KAMI.BOX.r;
const grounded = (f) => f.y <= 0 && onBox(f) && !f.fell;

export function gaugeLit(st, side) {
  const me = st.f[side];
  return st.phase === 'push' && st.t < me.litUntil;
}

// 決め技の場所：決め技を持っていて、相手が届く距離にいる。
// うっちゃりは自分が背中側の端の近く、ほかは相手が奥の端の近く
function inZone(me, op) {
  if (!me.kimete || !me.canFinish || op.fell || me.fell) return false;
  const arch = me.kimete.arch;
  if (Math.abs(op.x - me.x) > KIMETE_REACH[arch]) return false;
  if (arch === 'utchari') {
    const back = me.dir > 0 ? me.x - KAMI.BOX.l : KAMI.BOX.r - me.x; // 自分の、背中側の端までの近さ
    return back <= KAMI.EDGE_SELF;
  }
  const edge = me.dir > 0 ? KAMI.BOX.r - op.x : op.x - KAMI.BOX.l; // 相手の、自分から見て奥の端までの近さ
  return edge < KAMI.EDGE;
}

// 決め技の動き（系統ごと）
function fireKimete(st, side, k) {
  const me = st.f[side], op = st.f[other(side)];
  const arch = me.kimete.arch, fx = KIMETE_FX[arch];
  const s = KAMI.FINISH * me.finisher * me.kimete.power * k / op.mass;
  if (arch === 'utchari') {
    op.vx = -op.dir * s * fx.vx; // 相手の進む向きと逆＝相手自身の後ろへ
  } else if (arch === 'hiki') {
    op.vx = me.dir * s * fx.vx; // 前へつんのめって倒れ、足もとは後ろ（箱の端の方）へ滑る
  } else {
    op.vx += me.dir * s * fx.vx;
  }
  if (fx.vy) op.vy = Math.max(op.vy, fx.vy);
  if (fx.va) op.va += fx.va * k; // 投げ：大きく回す（後ろへ反って倒れる）
  if (fx.time) { op.pushT = fx.time; op.pushV = me.dir * s * fx.push; op.stun = Math.max(op.stun, fx.time); }
  if (fx.down) { op.down = true; op.standHeld = 0; op.va = 0; op.a = arch === 'hiki' ? -1.5 : 1.5; } // 引き＝前へ・うっちゃり＝後ろへ倒れる
  st.lastKimete = { side, arch };
  st.finisherArch = arch;
}

// 決め技のゲージを点ける・消す（1コマごと）
function updateGauge(st, side) {
  const me = st.f[side], op = st.f[other(side)];
  const ok = !me.down && inZone(me, op); // 光ってよい形か（間の時間 cool とは分けて見る）
  if (ok && st.t >= me.cool && st.t >= me.litUntil) { me.litFrom = st.t; me.litUntil = st.t + me.gaugeTime; me.cool = me.litUntil + 1.5; }
  if (!ok && st.t < me.litUntil) me.litUntil = st.t; // 倒れた・相手が場所を外れた＝消す（次に光るのは cool の後）
}

export function tap(st, side) {
  if (st.phase === 'done') return;
  const me = st.f[side], op = st.f[other(side)];
  if (st.phase === 'ready') {
    if (me.charged) return;
    me.charged = true;
    const delay = st.t - st.signalAt;
    const power = delay < 0 ? 0.5 : Math.max(0.6, Math.min(1.6, 1.6 - delay / 0.5));
    me.vx = me.dir * KAMI.CHARGE * power / me.mass;
    if (st.f.east.charged && st.f.west.charged) st.phase = 'push';
    return;
  }
  if (me.down || me.stun > 0 || me.fell) return;
  if (gaugeLit(st, side) && !inZone(me, op)) me.litUntil = st.t; // 場所を外れたゲージは消す（ふつうの跳ねへ）
  if (gaugeLit(st, side)) {
    const late = (st.t - me.litFrom) / me.gaugeTime; // 0＝光ってすぐ・1＝消える寸前
    const k = late < 0.7 ? 1 : 0.4;
    fireKimete(st, side, k);
    me.litUntil = st.t;
    if (late >= 0.7) me.stun = 0.3; // 外し気味＝一瞬すき
    st.finisherBy = side;
    st.finisherAt = st.t;
    return;
  }
  if (!grounded(me)) return;
  me.taps = me.taps.filter((x) => st.t - x < 1).concat([st.t]);
  const off = beatOffset(st);
  const rhythm = off < 0.09 ? 1.6 : off < 0.16 ? 1.0 : 0.6;
  const mom = 1 + KAMI.MOMENTUM * Math.max(0, me.taps.length - 2) / 2;
  const p = rhythm * mom * boost(st);
  me.vy = KAMI.HOP_VY * (0.85 + 0.3 * st.rng()) * Math.min(1.4, p);
  me.vx = me.vx * 0.5 + me.dir * KAMI.HOP_VX * p / me.mass;
  me.va += (st.rng() - 0.5) * KAMI.SPIN * p;
}

export function hold(st, side, on) {
  const me = st.f[side];
  me.held = !!on;
  if (!on) me.standHeld = 0;
}

function moveOne(st, f, dt) {
  if (f.fell) return;
  const n = dt * 60; // コマの数
  if (f.pushT > 0) { f.vx += f.pushV * n; f.pushT = Math.max(0, f.pushT - dt); } // 寄られている間は押され続ける
  if (!grounded(f) || f.vy > 0) f.vy -= KAMI.G * dt;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  if (f.y <= 0 && onBox(f)) {
    f.y = 0; f.vy = 0;
    f.vx *= Math.pow(f.down ? 0.93 : KAMI.FRICTION, n);
  }
  if (f.down) {
    if (f.held) { f.standHeld += dt; if (f.standHeld >= f.standTime) { f.down = false; f.a = 0; f.va = 0; f.standHeld = 0; } }
  } else {
    f.va += -f.a * f.right * 60 * n;
    f.va *= Math.pow(KAMI.DAMP, n);
    f.a += f.va * n;
    if (Math.abs(f.a) > KAMI.FALL_A) { f.down = true; f.a = Math.sign(f.a) * 1.5; f.va = 0; }
  }
  f.stun = Math.max(0, f.stun - dt);
}

function collide(st) {
  const e = st.f.east, w = st.f.west;
  if (e.fell || w.fell || e.y > 30 || w.y > 30) return;
  const minGap = (e.w + w.w) / 2;
  const overlap = minGap - (w.x - e.x);
  if (overlap <= 0) return;
  const ie = 1 / e.mass, iw = 1 / w.mass;
  e.x -= overlap * ie / (ie + iw);
  w.x += overlap * iw / (ie + iw);
  const rel = e.vx - w.vx;
  if (rel > 0) {
    const j = (1 + KAMI.RESTITUTION) * rel / (ie + iw);
    e.vx -= j * ie; w.vx += j * iw;
    if (!e.down) e.va += KAMI.KICK * j * ie * (0.8 + 0.4 * st.rng());
    if (!w.down) w.va += KAMI.KICK * j * iw * (0.8 + 0.4 * st.rng());
  }
}

export function step(st, dt) {
  if (st.phase === 'done') return;
  if (!(dt > 0)) return;
  dt = Math.min(dt, KAMI.MAX_DT);
  st.t += dt;
  for (const s of SIDES) moveOne(st, st.f[s], dt);
  collide(st);
  if (st.phase === 'push') for (const s of SIDES) updateGauge(st, s);
  if (st.phase === 'ready' && st.t > st.signalAt + 1.5) { // たたかない側は、弱い当たりで自動で立ち合う
    for (const s of SIDES) { const f = st.f[s]; if (!f.charged) { f.charged = true; f.vx = f.dir * KAMI.CHARGE * 0.6 / f.mass; } }
    st.phase = 'push';
  }
  for (const s of SIDES) { const f = st.f[s]; if (!f.fell && f.y < KAMI.FALL_Y) f.fell = true; }
  const e = st.f.east, w = st.f.west;
  if (e.fell || w.fell) {
    const loser = e.fell && w.fell ? (e.y <= w.y ? 'east' : 'west') : e.fell ? 'east' : 'west'; // 同じ高さなら主人公の負け（主人公を有利にしない）
    st.winner = other(loser);
    const lf = st.f[loser];
    const win = st.finisherArch === 'hiki' ? 3 : 2; // 引きは倒してから落ちるまで時間がかかる
    st.how = st.finisherBy === st.winner && st.t - st.finisherAt <= win ? 'finisher' : lf.down ? 'down' : 'push';
    st.phase = 'done';
  }
}
