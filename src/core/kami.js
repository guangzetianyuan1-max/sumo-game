// 紙相撲の計算（10/13 本人「紙相撲に切り替える」・設計書 2026-10-13-sumo-kamizumo-design.md）
// 画面から切り離した、型紙2枚の動き。単位＝画面の px と秒。x＝足もとの真ん中・y＝箱の面からの高さ（上が＋）
// a＝傾き（＋＝自分の後ろへ反る）。東＝主人公＝左から右へ（dir +1）・西＝敵＝右から左へ（dir -1）
import { makeRng } from './rng.js?v=37';
import { TACTICS, isTactic, tacticTiming, TACTIC_START } from './tactics.js?v=37';
import { ON_BEAT } from './beat.js?v=37';

export { ON_BEAT };

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
  BRACE_DELAY: 0.15,  // 立っている時に押し続けて、この秒数を過ぎたら「こらえる」
  BRACE_MASS: 2,      // こらえている間、ぶつかりで使う重さの倍率
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
    down: false, held: false, heldAt: -Infinity, landAt: -Infinity, standHeld: 0, stun: 0, fell: false, taps: [], charged: false,
    litUntil: 0, litFrom: 0, cool: 0, pushT: 0, pushV: 0,
    tactics: Array.isArray(p.tactics) ? p.tactics.filter(isTactic) : [], tacticIndex: Number(p.tacticIndex) || 0, // 相手の攻め（西だけ）
  };
}

export function newBout({ east, west, seed }) {
  const rng = makeRng(seed);
  const st = {
    t: 0, phase: 'ready', signalAt: 1 + rng() * 0.8, rng,
    f: { east: fighter({ ...east, tactics: [] }, 290, 1), west: fighter(west, 430, -1) }, // 攻めは敵（西）だけ
    winner: null, how: null, finisherBy: null, finisherAt: -Infinity, finisherArch: null,
    lastKimete: null, // 最後に出た決め技 { side, arch }（画面の演出用）
    tactic: null, // 今の攻め { side, id, phase: 'warn'|'act'|'after', from, until }（画面と driver が読む）
    tacticRun: { pushAt: null, next: null, n: 0, taps: [], recoiled: false, slapAt: -Infinity }, // 攻めの段取り（次の予告の時刻・何回目・組まれている間のたたき・はたいて倒した時刻＝画面の音の合図）
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

// 決め技の入口（右ボタン）。光っていて出せる時だけ出して true・それ以外は何もせず false
export function fire(st, side) {
  if (st.phase !== 'push') return false;
  const me = st.f[side], op = st.f[other(side)];
  if (me.down || me.stun > 0 || me.fell) return false;
  if (gaugeLit(st, side) && !inZone(me, op)) me.litUntil = st.t; // 場所を外れたゲージは消す
  if (!gaugeLit(st, side)) return false;
  const late = (st.t - me.litFrom) / me.gaugeTime; // 0＝光ってすぐ・1＝消える寸前
  const k = late < 0.7 ? 1 : 0.4;
  fireKimete(st, side, k);
  if (inAct(st, 'kumi') && st.tactic.side !== side) enterPhase(st, 'after'); // 組まれている側の決め技は組まれている間でも出る＝組みが解ける
  me.litUntil = st.t;
  if (late >= 0.7) me.stun = 0.3; // 外し気味＝一瞬すき
  st.finisherBy = side;
  st.finisherAt = st.t;
  return true;
}

// こらえている：立って箱の面にいる時に、押し始め（heldAt）と着地（landAt）の遅い方から 0.15 秒以上押し続けている（倒れている時の長押しは起き上がり）
// 10/14 Task 4 直し1：跳ねている間は こらえない（たたいて押したままの指が空中で こらえになり、ゆっくり押す人だけ重さ×2 を得ていた）
const isBracing = (st, f) => f.held && !f.down && grounded(f) && st.t - Math.max(f.heldAt, f.landAt) >= KAMI.BRACE_DELAY;
export function bracing(st, side) {
  return isBracing(st, st.f[side]);
}

// ---- 相手の攻め（数字は tactics.js）：予告 warn → 実行 act → 後始末 after → 間 gap ----
const gapOf = (st) => Math.abs(st.f.west.x - st.f.east.x);
const inAct = (st, id) => !!st.tactic && st.tactic.id === id && st.tactic.phase === 'act';
const tacticPower = (st) => tacticTiming(st.f[st.tactic.side].tacticIndex).power;

// ぶつかりで使う重さ：こらえ×BRACE_MASS・踏ん張りの act ×mass・解けた後 ×afterMass
function massOf(st, side) {
  const f = st.f[side], t = st.tactic;
  let m = f.mass * (isBracing(st, f) ? KAMI.BRACE_MASS : 1);
  if (t && t.side === side && t.id === 'fumbari') {
    if (t.phase === 'act') m *= TACTICS.fumbari.mass;
    else if (t.phase === 'after' && !st.tacticRun.recoiled) m *= TACTICS.fumbari.afterMass; // 待った時だけ、解けた後が軽い（押し込みどき）
  }
  return m;
}

function enterPhase(st, phase) {
  const t = st.tactic, warnFrom = t.from;
  t.phase = phase; t.from = st.t; t.until = st.t + TACTICS[t.id][phase];
  if (phase === 'act') { st.tacticRun.recoiled = false; startAct(st, warnFrom); }
}

// 実行の始まり：突っ張りの一突き・組みの組みつき
function startAct(st, warnFrom) {
  const t = st.tactic, op = st.f[other(t.side)];
  if (t.id === 'tsuppari') {
    const d = TACTICS.tsuppari;
    if (gapOf(st) > d.reach || op.down || op.fell) { enterPhase(st, 'after'); return; } // 届かない・倒れている＝突き損ね（倒れた主人公は こらえられないので突かない）
    // こらえた＝ほとんど下がらない。予告の間に押し始めていれば、0.15秒に届いていなくても こらえた扱い
    if (isBracing(st, op) || (op.held && !op.down && !op.fell && op.heldAt >= warnFrom)) { op.vx = -op.dir * d.braced / (op.mass * KAMI.BRACE_MASS); return; } // こらえた＝ほとんど下がらない
    const power = tacticPower(st);
    op.vx = -op.dir * d.push * power / op.mass;
    op.vy = Math.max(op.vy, d.lift);
    if (!op.down) op.va += d.va * power; // 後ろへ反る
  } else if (t.id === 'kumi') {
    st.tacticRun.taps = [];
    if (gapOf(st) > TACTICS.kumi.miss || op.down) enterPhase(st, 'after'); // 予告の間に離れた・倒れた＝組み損ね
  }
}

// 組まれている間（1コマごと・動く前）：2枚は間 keep のまま、主人公を背中側へ運ぶ
function applyGrip(st, dt) {
  if (!inAct(st, 'kumi')) return;
  const me = st.f[st.tactic.side], op = st.f[other(st.tactic.side)];
  if (me.fell || op.fell) return;
  if (op.down) { enterPhase(st, 'after'); return; } // 倒れた相手は運ばない（起き上がれるように）
  op.x -= op.dir * TACTICS.kumi.carry * tacticPower(st) * dt;
  op.vx = 0; me.vx = 0;
  me.x = op.x + op.dir * TACTICS.kumi.keep;
}

// 攻めの段取り（1コマごと・押し合いの間だけ）
function updateTactic(st) {
  const run = st.tacticRun;
  if (run.pushAt === null) { run.pushAt = st.t; run.next = st.t + TACTIC_START; }
  const t = st.tactic;
  if (t) {
    const me = st.f[t.side];
    if (t.phase !== 'after' && (me.down || me.fell)) { enterPhase(st, 'after'); return; } // 倒れた敵は攻めをやめる
    if (st.t < t.until - 1e-9) return;
    if (t.phase === 'warn') enterPhase(st, 'act');
    else if (t.phase === 'act') enterPhase(st, 'after');
    else { st.tactic = null; run.next = st.t + tacticTiming(me.tacticIndex).gap; }
    return;
  }
  const side = 'west', me = st.f[side], list = me.tactics;
  if (!list.length || st.t < run.next || me.down || me.fell) return;
  for (let k = 0; k < list.length; k++) { // 順番に。組みはくっついた時だけ（離れていれば次の攻めへ）
    const id = list[(run.n + k) % list.length];
    if (id === 'kumi' && (gapOf(st) > TACTICS.kumi.start || st.f[other(side)].down)) continue;
    run.n += k + 1;
    const warn = Math.max(TACTICS[id].warn, tacticTiming(me.tacticIndex).warn);
    st.tactic = { side, id, phase: 'warn', from: st.t, until: st.t + warn };
    return;
  }
}

// たたき（tap）が攻めに当たった時。true＝跳ねずに終わり
function tacticOnTap(st, side, beforeHop) {
  const t = st.tactic;
  if (!t || t.phase !== 'act' || t.side === side) return false;
  const me = st.f[side], owner = st.f[t.side];
  if (beforeHop) {
    if (t.id === 'kumi') { // 素早く連打して振りほどく
      const d = TACTICS.kumi;
      st.tacticRun.taps = st.tacticRun.taps.filter((x) => st.t - x < d.window).concat([st.t]);
      if (st.tacticRun.taps.length >= d.taps) { enterPhase(st, 'after'); owner.stun = Math.max(owner.stun, d.stun); }
    } else if (t.id === 'hataki' && gapOf(st) <= TACTICS.hataki.reach) {
      const d = TACTICS.hataki;
      enterPhase(st, 'after');
      if (beatOffset(st) >= d.beat) { // 拍を外した＝身をかわしてはたく
        me.down = true; me.a = d.fallA; me.va = 0; me.standHeld = 0;
        st.tacticRun.slapAt = st.t;
        if (owner.tacticIndex >= d.slideFrom) me.vx = -me.dir * d.slide * tacticPower(st) / me.mass; // 10体目から：前へつんのめって倒れ、足もとは自分の後ろ（箱の端）へ滑る（決め技の引きと同じ）
        owner.x -= owner.dir * d.back;
        return true;
      }
    }
    return false;
  }
  if (t.id === 'fumbari' && gapOf(st) <= TACTICS.fumbari.reach) { // 踏ん張りを押した＝跳ね返されて後ろへよろける
    me.vx = -me.dir * TACTICS.fumbari.recoilVx * tacticPower(st); // 強さに比例（1体目 ×0.6）
    me.va += TACTICS.fumbari.recoilVa;
    st.tacticRun.recoiled = true;
  }
  return false;
}

// 左ボタン：立ち合いと跳ねだけ（光っていても跳ねる）
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
  if (inAct(st, 'kumi') && st.tactic.side !== side) tacticOnTap(st, side, true); // 組まれている間は、跳ねられなくても数える
  if (bracing(st, side)) return; // こらえている間は跳ねない
  const t = st.tactic;
  if (t && t.side === side && t.phase === 'act' && t.id !== 'tsuppari') return; // 構え・組みの間、攻める側は跳ねない
  if (!grounded(me)) return;
  if (inAct(st, 'hataki') && tacticOnTap(st, side, true)) return;
  me.taps = me.taps.filter((x) => st.t - x < 1).concat([st.t]);
  const off = beatOffset(st);
  const rhythm = off < ON_BEAT ? 1.6 : off < 0.16 ? 1.0 : 0.6;
  const mom = 1 + KAMI.MOMENTUM * Math.max(0, me.taps.length - 2) / 2;
  const p = rhythm * mom * boost(st);
  me.vy = KAMI.HOP_VY * (0.85 + 0.3 * st.rng()) * Math.min(1.4, p);
  me.vx = me.vx * 0.5 + me.dir * KAMI.HOP_VX * p / me.mass;
  me.va += (st.rng() - 0.5) * KAMI.SPIN * p;
  tacticOnTap(st, side, false);
}

export function hold(st, side, on) {
  const me = st.f[side];
  if (on && !me.held) me.heldAt = st.t;
  me.held = !!on;
  if (!on) me.standHeld = 0;
}

function moveOne(st, f, dt) {
  if (f.fell) return;
  const n = dt * 60; // コマの数
  const air = !grounded(f); // 動く前に宙にいたか（着地の時刻 landAt を残す）
  if (f.pushT > 0) { f.vx += f.pushV * n; f.pushT = Math.max(0, f.pushT - dt); } // 寄られている間は押され続ける
  if (!grounded(f) || f.vy > 0) f.vy -= KAMI.G * dt;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  if (f.y <= 0 && onBox(f)) {
    if (air) f.landAt = st.t;
    f.y = 0; f.vy = 0;
    f.vx *= Math.pow(f.down ? 0.93 : KAMI.FRICTION, n);
  }
  if (f.down) {
    if (f.held) { f.standHeld += dt; if (f.standHeld >= f.standTime) { f.down = false; f.a = 0; f.va = 0; f.standHeld = 0; f.heldAt = st.t; } } // 起きた後の こらえるは、そこから数える
  } else {
    f.va += -f.a * f.right * 60 * n;
    f.va *= Math.pow(KAMI.DAMP, n);
    f.a += f.va * n;
    if (isBracing(st, f)) { f.va = 0; f.a *= Math.pow(0.8, n); } // こらえている間は傾かない（傾きは戻る）
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
  const ie = 1 / massOf(st, 'east'), iw = 1 / massOf(st, 'west');
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
  applyGrip(st, dt);
  for (const s of SIDES) moveOne(st, st.f[s], dt);
  collide(st);
  if (st.phase === 'push') for (const s of SIDES) updateGauge(st, s);
  if (st.phase === 'ready' && st.t > st.signalAt + 1.5) { // たたかない側は、弱い当たりで自動で立ち合う
    for (const s of SIDES) { const f = st.f[s]; if (!f.charged) { f.charged = true; f.vx = f.dir * KAMI.CHARGE * 0.6 / f.mass; } }
    st.phase = 'push';
  }
  if (st.phase === 'push') updateTactic(st);
  for (const s of SIDES) { const f = st.f[s]; if (!f.fell && f.y < KAMI.FALL_Y) f.fell = true; }
  const e = st.f.east, w = st.f.west;
  if (e.fell || w.fell) {
    const loser = e.fell && w.fell ? (e.y <= w.y ? 'east' : 'west') : e.fell ? 'east' : 'west'; // 同じ高さなら主人公の負け（主人公を有利にしない）
    st.winner = other(loser);
    const lf = st.f[loser];
    const win = st.finisherArch === 'hiki' ? 3 : 2; // 引きは倒してから落ちるまで時間がかかる
    st.how = st.finisherBy === st.winner && st.t - st.finisherAt <= win ? 'finisher' : lf.down ? 'down' : 'push';
    st.phase = 'done';
    st.tactic = null; // 取組の終わりで攻めは止まる
  }
}
