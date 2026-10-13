// 紙相撲の計算（10/13 本人「紙相撲に切り替える」・設計書 2026-10-13-sumo-kamizumo-design.md）
// 画面から切り離した、型紙2枚の動き。単位＝画面の px と秒。x＝足もとの真ん中・y＝箱の面からの高さ（上が＋）
// a＝傾き（＋＝自分の後ろへ反る）。東＝主人公＝左から右へ（dir +1）・西＝敵＝右から左へ（dir -1）
import { makeRng } from './rng.js?v=31';

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
  NEAR: 190,          // 相手との間がこの内なら近い
  MOMENTUM: 0.18,
  LATE: 30, LATE_UP: 0.08,
  FALL_Y: -40,
  MAX_DT: 1 / 30,
};

const SIDES = ['east', 'west'];
const other = (s) => (s === 'east' ? 'west' : 'east');

function fighter(p, x, dir) {
  return {
    mass: p.mass, right: p.right, standTime: p.standTime, gaugeTime: p.gaugeTime, finisher: p.finisher, w: p.w,
    canFinish: p.canFinish !== false, // 決め技を持つか（無い時は持つ＝主人公は変わらない・機械の相手は参号から）
    x, y: 0, vx: 0, vy: 0, a: 0, va: 0, dir,
    down: false, held: false, standHeld: 0, stun: 0, fell: false, taps: [], charged: false,
    litUntil: 0, litFrom: 0, cool: 0,
  };
}

export function newBout({ east, west, seed }) {
  const rng = makeRng(seed);
  const st = {
    t: 0, phase: 'ready', signalAt: 1 + rng() * 0.8, rng,
    f: { east: fighter(east, 290, 1), west: fighter(west, 430, -1) },
    winner: null, how: null, finisherBy: null, finisherAt: -Infinity,
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

// 決め技の場所：相手が奥の端の近くで、自分の近くにいる
function inZone(me, op) {
  const edge = me.dir > 0 ? KAMI.BOX.r - op.x : op.x - KAMI.BOX.l; // 相手の、自分から見て奥の端までの近さ
  return !op.fell && edge < KAMI.EDGE && Math.abs(op.x - me.x) < KAMI.NEAR;
}

// 決め技のゲージを点ける・消す（1コマごと）
function updateGauge(st, side) {
  const me = st.f[side], op = st.f[other(side)];
  const ok = me.canFinish && !me.down && inZone(me, op); // 光ってよい形か（間の時間 cool とは分けて見る）
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
    op.vx += me.dir * KAMI.FINISH * me.finisher * k / op.mass;
    op.vy = Math.max(op.vy, 260);
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
    st.how = st.finisherBy === st.winner && st.t - st.finisherAt <= 2 ? 'finisher' : lf.down ? 'down' : 'push';
    st.phase = 'done';
  }
}
