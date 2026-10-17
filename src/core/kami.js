// 紙相撲の計算（10/13 本人「紙相撲に切り替える」・設計書 2026-10-13-sumo-kamizumo-design.md）
// 画面から切り離した、型紙2枚の動き。単位＝画面の px と秒。x＝足もとの真ん中・y＝箱の面からの高さ（上が＋）
// a＝傾き（＋＝自分の後ろへ反る）。東＝主人公＝左から右へ（dir +1）・西＝敵＝右から左へ（dir -1）
import { makeRng } from './rng.js?v=59';
import { TACTICS, isTactic, tacticTiming, TACTIC_START, BAR, TACTIC_TYPE, barSpec, barWarn, FOE_KIME_ID, FOE_KIME, KIME_TYPE } from './tactics.js?v=59';
import { ON_BEAT } from './beat.js?v=59';
import { IPPON } from './drills.js?v=59';
import { KIME_INPUTS, tapJudge, mashJudge, holdJudge } from './kimeinput.js?v=59';

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

// 一発の〇（10/14 ボタン1つ・設計書 2026-10-14-sumo-one-button-ring-bar-design.md §3）。判定は稽古の一押しと同じ ipponJudge（±70ms＝2・±170ms＝1・外＝0）
// tachiaiHit＝合図から的に重なるまで（秒）・kimeHit＝光ってから重なるまで＝max(kimeMin, gaugeTime×kimeHit)（技が高いほど ゆっくり・稽古の 0.8〜1.3 秒に近く）
// 10/14 Task 2（Ruling 3）：kimeHit 0.6→0.9・最短 kimeMin 0.8 秒（0.36 秒では見てから押せなかった）
// 10/15（〇が押すか時間切れまで消えない）：kimeHit 0.9→0.7（〇の間は跳ねない＝長い〇は鍛えた主人公ほど損。大ボスの初挑戦が 20% に落ちた・kami_tune で 31%／最初の心技体 6%）
// charge＝立ち合いの当たりの強さ（判定 0・1・2 ごと。合図の前の早押しも 0.5）・kimeK＝決め技の強さ（判定 1・2・0 は出ない・10/17 見た目どおりの判定に替えた時に ○ を 0.6→0.7）・missStun＝決め技の外れの すき
// cool＝決め技の〇の終わり（until＝光った時に決まる・長押しは押し始めで満タンまで延びる）から次に光るまでの秒。早く決めても数え始めは until のまま（3つの出し方で同じ）。
//   Task 7 で「決めた時刻から数える」を試した：連打と長押しの〇が早く光り直す分、〇の間は押せない時間が増え、一生の40秒超が 5.1%→7.3%・満月寄りの勝ちが 67%→62%＝今のままにした
// reachSlack＝押した時の届く距離の余裕（px・10/15）：主人公の〇は相手が離れても消えない（押すか時間切れまで）。押した時に相手が
// KIMETE_REACH＋reachSlack の外（うっちゃりは自分の背中側の端から EDGE_SELF＋reachSlack の外も）なら「届かない」＝決め技無し・すき無し
export const RING = { tachiaiHit: 0.9, kimeHit: 0.7, kimeMin: 0.8, charge: [0.5, 1.0, 1.6], kimeK: [0, 0.7, 1], missStun: 0.3, cool: 1.5, reachSlack: 40 };
const RING_NEAR = IPPON.nearMs / 1000; // 押さないまま hitAt からこれを過ぎたら外れ（〇が消える）
// 決め技の一押しの〇は、見た目どおりに判定する（10/17 本人「一押しの必殺技、〇から外れても決まりませんか？」→ A）：
//   前は時刻のずれ（○ ±0.17秒）で決め、金の輪が白い的から約30px離れて見えても決まった。
//   今は金の輪（半径 r・線の太さ 10）と白い的（半径 IPPON.targetR）の間の px で決める：○＝金の輪が的のまわりの薄い帯に触れる・◎＝白い線に重なる。
//   帯の太さは判定と同じ（hud.js の drawRing が RING_PX.near から描く）。幅は scale 倍（相手が進むほど狭い）
export const RING_PX = { near: 21, perfect: 8 };
const ringSpeed = (r) => (IPPON.startR - IPPON.targetR) / Math.max(1e-3, r.hitAt - r.from); // 金の輪が縮む速さ（px／秒）
export function kimeRingJudge(r, t) {
  const k = r.scale > 0 ? r.scale : 1, d = Math.abs(t - r.hitAt) * ringSpeed(r);
  return d <= RING_PX.perfect * k ? 2 : d <= RING_PX.near * k ? 1 : 0;
}

// 決め技の〇の出し方（input の無い〇＝試験が手で作る物と立ち合いは一押し）と、消える時刻（until の無い〇は hitAt＋近いの幅）
const ringInput = (r) => (r && r.input ? r.input : 'tap');
const ringUntil = (r) => (Number.isFinite(r.until) ? r.until : r.hitAt + RING_NEAR);

// 光った時の決め技の〇（設計書 2026-10-16 §6）。連打＝窓 window 秒に need 回・長押し＝limit 秒の内に押し始める（押し始めたら満タンまで延びる・kimeHold）・一押し＝今の〇（幅は scale 倍）
function kimeRing(st, side, me) {
  const inp = me.kimete.input, from = st.t;
  if (inp && inp.input === 'mash') {
    const until = from + inp.window;
    return { side, kind: 'kime', input: 'mash', from, hitAt: until, until, need: inp.need, count: 0, window: inp.window, good: inp.good, rearm: inp.rearm > 0 ? inp.rearm : 0, armed: false };
  }
  if (inp && inp.input === 'hold') {
    const until = from + inp.limit;
    return { side, kind: 'kime', input: 'hold', from, hitAt: until, until, fillMs: inp.fillMs, center: inp.center, half: inp.half, core: inp.core, heldFrom: null };
  }
  const hitAt = from + Math.max(RING.kimeMin, me.gaugeTime * RING.kimeHit), scale = inp && inp.scale > 0 ? inp.scale : 1;
  const ring = { side, kind: 'kime', input: 'tap', scale, from, hitAt };
  ring.until = hitAt + (RING_PX.near * scale) / ringSpeed(ring); // 消えるのは ○ の帯を金の輪が内側へ抜けた時（○の外の遅い押しは〇が消えた後＝すき無し）
  return ring;
}

const SIDES = ['east', 'west'];
const other = (s) => (s === 'east' ? 'west' : 'east');
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// 決め技の系統と相性の倍率（無い＝光らない）。名前の id がある＝敵の必殺技（〇でなく攻めの順番で予告とバーで来る・gap＝次の必殺技までの最短の秒）
// input＝主人公の決め技の出し方の数（src/core/kimeinput.js の kimeInputSpec・無い＝今の一押し・幅 1）
function kimeteOf(k) {
  if (!k || ARCHS.indexOf(k.arch) < 0) return null;
  const out = { arch: k.arch, power: k.power > 0 ? k.power : 1 };
  if (typeof k.id === 'string' && k.id) { out.id = k.id; out.gap = k.gap > 0 ? k.gap : 0; }
  if (k.input && typeof k.input === 'object' && KIME_INPUTS.indexOf(k.input.input) >= 0) out.input = k.input;
  return out;
}

function fighter(p, x, dir) {
  return {
    mass: p.mass, right: p.right, standTime: p.standTime, gaugeTime: p.gaugeTime, finisher: p.finisher, w: p.w,
    canFinish: p.canFinish !== false, // false なら決め技を出さない（古い呼び方。20体版は kimete の有る無しで決める）
    kimete: kimeteOf(p.kimete),
    x, y: 0, vx: 0, vy: 0, a: 0, va: 0, dir,
    down: false, held: false, standHeld: 0, upAt: -Infinity, upHeld: false, stun: 0, fell: false, taps: [], charged: false,
    tapAt: -Infinity, prevTapAt: -Infinity, // 左のたたき（mash）と一押し（press）の時刻・その前の時刻（連打の技は間 rearm をあけた押しから数える・v47）
    litUntil: 0, litFrom: 0, cool: 0, pushT: 0, pushV: 0,
    ring: null, // 一発の〇 { side, kind: 'tachiai'|'kime', from, hitAt }（無い＝null）。主人公の決め技の〇は input・until と出し方の数も持つ（kimeRing）
    tactics: Array.isArray(p.tactics) ? p.tactics.filter(isTactic) : [], tacticIndex: Number(p.tacticIndex) || 0, // 相手の攻め（西だけ）
  };
}

export function newBout({ east, west, seed }) {
  const rng = makeRng(seed);
  const st = {
    t: 0, phase: 'ready', signalAt: 1 + rng() * 0.8, rng,
    f: { east: fighter({ ...east, tactics: [] }, 290, 1), west: fighter(west, 430, -1) }, // 攻めは敵（西）だけ
    winner: null, how: null, finisherBy: null, finisherAt: -Infinity, finisherArch: null,
    lastKimete: null, // 最後に出た決め技 { side, arch, kime? }（画面の演出用・敵の必殺技は kime＝必殺技の id）
    lastFoeKime: null, // 最後に予告の終わりまで来た敵の必殺技 { kime, arch, landed, at }（landed false＝バーは失敗したが届かず空振り。打ち消しは lastBar の ok）
    tactic: null, // 今の攻め { side, id, phase: 'warn'|'act'|'after', from, until }（画面と driver が読む）
    tacticRun: { pushAt: null, next: null, kimeTurn: false, kimeWait: null, n: 0, taps: [], recoiled: false, slapAt: -Infinity }, // 攻めの段取り（次の予告の時刻・何回目・組まれている間のたたき・はたいて倒した時刻＝画面の音の合図）
    lastRing: null, // 最後に終わった〇 { side, kind, judge, at }（画面の◎○×の演出用・押さずに通り過ぎた時も judge 0）
    bar: null, // 守りの長押しバー { side, tactic, from, fillMs, center, half, heldFrom, result: null|'ok'|'ng', gauge, at }（相手の攻めの予告の間・結果は BAR.linger 秒残る）
    lastBar: null, // 最後に出たバーの結果 { side, tactic, result, gauge, at }（画面の「こらえ成功！」の演出用）
    get ring() { return this.f.east.ring; }, // 画面に出す〇＝主人公の〇（敵の〇は st.f.west.ring・画面には出さない）
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

// 決め技の動き（系統ごと）。kime＝敵の必殺技の id（lastKimete に残す）。弱い必殺技（強さ < FOE_KIME.downMin＝1〜4体目）は倒さない＝押すだけ（Ruling 11）
function fireKimete(st, side, k, kime) {
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
  if (fx.down && !(kime && me.kimete.power < FOE_KIME.downMin)) { op.down = true; op.standHeld = 0; op.va = 0; op.a = arch === 'hiki' ? -1.5 : 1.5; } // 引き＝前へ・うっちゃり＝後ろへ倒れる
  st.lastKimete = kime ? { side, arch, kime } : { side, arch };
  st.finisherArch = arch;
}

// 決め技の〇を出さない時：攻めの予告の間（バー＝1度に1つ・どちらの側も）・組まれている側は組まれている間（Ruling 3：振りほどきの連打が〇の判定に食われない）
function ringBlocked(st, side) {
  const t = st.tactic;
  if (!t) return false;
  return t.phase === 'warn' || (t.phase === 'act' && t.id === 'kumi' && t.side !== side);
}

// 敵の必殺技（名前の id がある決め技）＝〇でなく、攻めと同じ予告＋主人公のバーで来る（ボタン1つ Task 2b）。
// id の無い決め技は、どちらの側でも今までのゲージと〇（本番では主人公だけ。西の〇の道は試験が型紙を直接作る時に使う）
const warnKime = (f) => !!(f.kimete && f.kimete.id);

// 主人公の決め技の〇（10/15 本人「押す前に〇が飛ばされ、連打に切り替えられてしまう」）：場所を外れても消えない＝押すか時間切れまで残る（倒れたら消える）。
// 西の〇は本番に無い（敵の必殺技は予告で来る）＝試験が id の無い決め技で作る西の〇は今まで通り（場所を外れたら消える）
const keepsRing = (side, r) => side === 'east' && !!r && r.kind === 'kime';

// 押した時に届くか（主人公の〇）：相手との間が KIMETE_REACH＋余裕の内。うっちゃりは自分の背中側の端の条件にも同じ余裕
function inReach(me, op) {
  if (!me.kimete || op.fell || me.fell) return false;
  const arch = me.kimete.arch;
  if (Math.abs(op.x - me.x) > KIMETE_REACH[arch] + RING.reachSlack) return false;
  if (arch !== 'utchari') return true;
  const back = me.dir > 0 ? me.x - KAMI.BOX.l : KAMI.BOX.r - me.x;
  return back <= KAMI.EDGE_SELF + RING.reachSlack;
}

// 決め技のゲージを点ける・消す（1コマごと）
// 光ると同時に決め技の〇が出る。ゲージ（gaugeLit）は〇の間だけ光る＝litUntil は〇が通り過ぎる時刻（hitAt＋0.17）
function updateGauge(st, side) {
  const me = st.f[side], op = st.f[other(side)];
  if (warnKime(me)) return; // 敵の必殺技はゲージも〇も使わない＝攻めの順番で来る（updateTactic）
  const ok = !me.down && inZone(me, op) && !ringBlocked(st, side); // 光ってよい形か（間の時間 cool とは分けて見る）
  const keep = keepsRing(side, me.ring) && !me.down && !me.fell; // 主人公の〇は、倒れない限り押すか時間切れまで残る
  if (ok && st.t >= me.cool && st.t >= me.litUntil) {
    me.ring = kimeRing(st, side, me);
    me.litFrom = st.t; me.litUntil = me.ring.until; me.cool = me.litUntil + RING.cool;
  }
  if (!ok && !keep && st.t < me.litUntil) { me.litUntil = st.t; if (me.ring && me.ring.kind === 'kime') me.ring = null; } // 倒れた・相手が場所を外れた＝消す（次に光るのは cool の後）
}

// 〇の判定：今押したら 0・1・2（〇は消さない）。一押しの〇だけ（幅は scale 倍）。〇が無い・連打と長押しの〇は 0
export function ringJudge(st, side) {
  const r = st.f[side].ring;
  if (!r || ringInput(r) !== 'tap') return 0;
  if (r.kind === 'kime') return kimeRingJudge(r, st.t); // 決め技は見た目どおり（px）・立ち合いは今まで通り時刻
  return tapJudge((st.t - r.hitAt) * 1000, r.scale > 0 ? r.scale : 1);
}

const endRing = (st, side, judge, far) => {
  const r = st.f[side].ring;
  st.f[side].ring = null;
  st.lastRing = far ? { side, kind: r.kind, judge, at: st.t, reach: false } : { side, kind: r.kind, judge, at: st.t }; // reach false＝届かない（画面の「届かない…」）
};

// 立ち合いの当たり（power＝RING.charge の値）
function charge(st, side, power) {
  const me = st.f[side];
  me.charged = true;
  me.vx = me.dir * KAMI.CHARGE * power / me.mass;
  if (st.f.east.charged && st.f.west.charged) st.phase = 'push';
}

// 〇が出ている時の押し。判定 0・1・2 を返す（すき・倒れている間は何もせず null・〇は残る）。跳ねない
function pressRing(st, side) {
  const me = st.f[side], op = st.f[other(side)], r = me.ring;
  if (r.kind === 'tachiai') {
    const j = ringJudge(st, side);
    endRing(st, side, j);
    charge(st, side, RING.charge[j]);
    return j;
  }
  if (me.down || me.fell || me.stun > 0) return null;
  if (ringInput(r) === 'mash') { mashKime(st, side); return null; } // 連打の技：一押しも1回に数える（機械と試験の入口・画面の左は mash）
  if (ringInput(r) === 'hold') return null; // 長押しの技は hold（画面の右は strike）
  if (!keepsRing(side, r) && !inZone(me, op)) { me.ring = null; me.litUntil = st.t; tap(st, side); return null; } // 西の〇（試験だけ）：場所を外れた〇は消える＝ふつうのたたき
  return resolveKime(st, side, ringJudge(st, side));
}

// 決め技の〇の終わり方（一押し・連打・長押しで同じ・preflight M2）。判定 0・1・2 を返す
// 届かない＝決め技は出ない・すき無し・跳ねない（画面の「届かない…」）／外れ（0）＝出ない・一瞬すき／○◎＝決め技
// 西の〇（試験だけ）は inZone を通ってから来る。inZone は inReach より狭いので、ここで届く距離を見ても西の〇は今までと同じ
function resolveKime(st, side, j) {
  const me = st.f[side], op = st.f[other(side)];
  if (!inReach(me, op)) { endRing(st, side, 0, true); me.litUntil = st.t; return 0; }
  endRing(st, side, j);
  me.litUntil = st.t;
  if (j === 0) { me.stun = Math.max(me.stun, RING.missStun); return 0; }
  fireKimete(st, side, RING.kimeK[j]);
  st.finisherBy = side;
  st.finisherAt = st.t;
  return j;
}

// 連打の技の1回（設計書 2026-10-16 §6・Ruling R2）：回数に届いたら判定して決める（窓の時間切れは expireRings）。跳ねない
// v47：光った後は、前のたたきから rearm 秒あけた押し（一度離して止めた後）から数える（armed）。それまでの押しは数えない＝光る前からの連打で勝手に決まらない（false＝画面は左を揺らす）
// v47 直し1：数え始めは光った後（r.from 以後）の押しだけ・前のたたき（光る前のたたきも含む）からの間で見る。rearm は 0.4 秒（kimeinput.js）
function mashKime(st, side) {
  const me = st.f[side], r = me.ring;
  if (me.stun > 0 || me.fell) return false;
  if (!r.armed) {
    if (st.t < r.from - 1e-9 || me.tapAt - me.prevTapAt < (r.rearm || 0) - 1e-9) return false;
    r.armed = true;
  }
  r.count += 1;
  if (r.count >= r.need) resolveKime(st, side, mashJudge(r.count, r.need, st.t - r.from, r.window, r.good));
  return true;
}

// 長押しの技のゲージ 0〜1（押していない＝0）
export function kimeHoldGauge(st, side) {
  const r = st.f[side].ring;
  if (!r || ringInput(r) !== 'hold' || r.heldFrom === null) return 0;
  return clamp01((st.t - r.heldFrom) * 1000 / r.fillMs);
}

// 長押しの技を離した（または満タン）：判定して決める（Ruling R1）
function finishKimeHold(st, side, g) {
  const r = st.f[side].ring;
  resolveKime(st, side, holdJudge(g, r.center, r.half, r.core));
}

// 長押しの技の指：新しい押し（離した→押した）でため始め・離して判定。前から押したままの指ではため始めない（Review Focus #2）
function kimeHold(st, side, on, was) {
  const me = st.f[side], r = me.ring;
  if (on && !was && r.heldFrom === null) {
    if (me.stun > 0) return;
    r.heldFrom = st.t;
    // Ruling R3：limit は押し始めるまでの秒。押し始めたら満タン（fillMs）まで〇は消えない＝遅く押し始めても緑で離せる（×は満タンの行）
    r.until = Math.max(r.until, st.t + r.fillMs / 1000 + 0.05); r.hitAt = r.until;
    me.litUntil = Math.max(me.litUntil, r.until); me.cool = Math.max(me.cool, me.litUntil + RING.cool);
    return;
  }
  if (!on && was && r.heldFrom !== null) finishKimeHold(st, side, kimeHoldGauge(st, side));
}

// たたいた時刻を覚える（連打の技の数え始め＝前のたたきとの間・v47）。左の mash と一押しの press（機械のたたき手の押し合いのたたき）
function noteTap(st, side) {
  const me = st.f[side];
  me.prevTapAt = me.tapAt;
  me.tapAt = st.t;
}

// ボタンの入口（1つ）：〇が出ていればその判定（0・1・2 を返す・跳ねない）・無ければ今の tap（null を返す）
// バー（守り）が出ている間の押しは跳ねない（tap が止める）＝ためるのは hold（画面は押した指をそのまま hold へ）
export function press(st, side) {
  if (st.phase === 'done') return null;
  noteTap(st, side);
  if (!st.f[side].down) st.f[side].upHeld = false; // 立っていて新しい押し＝起き上がりの指はもう関係ない（2本目の指で猶予を延ばし続けられない・Ruling 6 直し2）
  if (st.f[side].ring) return pressRing(st, side);
  tap(st, side);
  return null;
}

// ---- ボタン2つ（10/15 設計書 §11）：画面の指の入口の分け方だけ（物の動きは press・tap・hold のまま・機械のたたき手は press/hold を使う） ----
// 左＝連打だけ：押し合いの間の tap（true を返す）。〇・守りのバー・倒れている時と、立ち合い（ready）の間は何もしない（false）。
// 立っていて受けた押しは起き上がりの指（upHeld）を外す（press と同じ：右を押したままで次の攻めを止め続けられない）
export function mash(st, side) {
  const me = st.f[side];
  noteTap(st, side);
  if (st.phase === 'push' && me.ring && ringInput(me.ring) === 'mash' && !me.down) return mashKime(st, side); // 連打の技の〇は左で数える
  if (st.phase !== 'push' || me.ring || me.down || barOpen(st, side)) return false;
  me.upHeld = false;
  const t = st.tactic;
  if (t && t.side !== side && t.phase === 'warn') return false; // 自分への予告の間は跳ねない（tap の早期 return と同じ）＝左は沈まない・数えない（バーの結果が出た後も予告は続く）
  tap(st, side);
  return true;
}

// 右＝一押しと長押し：倒れていれば長押しの始まり（起き上がり）・〇があればその判定（press と同じ 0・1・2）・
// 押し合いの間はほかも長押しの始まり（バーの間はため始め・無い時は何も起きない）。跳ねない・立ち合いの早押しにならない。〇の判定のほかは null
export function strike(st, side) {
  if (st.phase === 'done') return null;
  const me = st.f[side];
  if (me.down) { hold(st, side, true); return null; }
  if (me.ring && ringInput(me.ring) === 'mash') return null; // 連打の技は左だけ（右は何も起きない）
  if (me.ring && ringInput(me.ring) === 'hold') { me.upHeld = false; hold(st, side, true); return null; } // 長押しの技はため始め
  if (me.ring) return press(st, side);
  if (st.phase !== 'push') return null;
  me.upHeld = false;
  hold(st, side, true);
  return null;
}

// 〇が通り過ぎた（until）：立ち合いは判定 0 の弱い当たり・決め技は消える。連打を1回でも数えていた・長押しをため始めていた＝×（すき・Ruling R2）。
// ほかの決め技の見送りは消えるだけ（すきは無い）
function expireRings(st) {
  for (const s of SIDES) {
    const r = st.f[s].ring;
    if (!r || st.t <= ringUntil(r)) continue;
    const me = st.f[s];
    const tried = r.kind === 'kime' && ((ringInput(r) === 'mash' && r.count > 0) || (ringInput(r) === 'hold' && r.heldFrom !== null));
    endRing(st, s, 0);
    if (tried) me.stun = Math.max(me.stun, RING.missStun);
    if (r.kind === 'tachiai' && st.phase === 'ready' && !me.charged) charge(st, s, RING.charge[0]);
  }
}

// ---- 守りの長押しバー（数は tactics.js の BAR・barSpec）：相手の攻めの予告の間だけ。立って押したままの「こらえ」は無い（10/14 ボタン1つ Task 2） ----
// 新しい押し（離した→押した）でため始め、離した時のゲージが緑の帯（center ± half・1 未満）なら ok。満タンまで押す・予告の終わりまで決めない＝ng
// 「まだ」（Ruling 7）：予告から BAR.react 秒より前の押し始めは数えない・BAR.tapMax 秒より短い押しを帯の下で離したら ため直し（連打の指で失敗にしない）
const barOpen = (st, side) => !!st.bar && st.bar.side === side && st.bar.result === null;
export const barInBand = (b, g) => g < 1 && Math.abs(g - b.center) <= b.half + 1e-9;

// 今のゲージ 0〜1（押す前は 0・結果が出たら離した時の値で止まる）
export function barGauge(st) {
  const b = st.bar;
  if (!b) return 0;
  if (b.result !== null || b.heldFrom === null) return b.gauge;
  return clamp01((st.t - b.heldFrom) * 1000 / b.fillMs);
}

// 攻めの予告に合わせてバーを出す（spec＝barSpec の数）。後の新しい予告（敵の必殺技など）も同じ形で出せる
function startBar(st, side, tactic, spec) {
  st.bar = { side, tactic, from: st.t, fillMs: spec.fillMs, center: spec.center, half: spec.half, heldFrom: null, result: null, gauge: 0, at: null, warnEnd: null };
}

// バーの結果。ok＝その攻めを打ち消し（予告から after へ・相手は BAR.stun 秒すき。踏ん張りは after＝軽い押し込みどき）／ng＝攻めはそのまま来る
function endBar(st, result) {
  const b = st.bar;
  b.gauge = barGauge(st);
  b.result = result; b.at = st.t;
  st.lastBar = { side: b.side, tactic: b.tactic, result, gauge: b.gauge, at: st.t };
  const t = st.tactic;
  if (result === 'ok' && t && t.phase === 'warn' && t.side !== b.side) {
    enterPhase(st, 'after');
    const owner = st.f[t.side];
    owner.stun = Math.max(owner.stun, BAR.stun);
  }
}

// 1コマごと：満タンに届いたら失敗・結果は linger 秒で消す
function updateBar(st) {
  const b = st.bar;
  if (!b) return;
  if (b.result === null && b.heldFrom !== null && barGauge(st) >= 1) endBar(st, 'ng');
  if (b.result !== null && st.t >= b.at + BAR.linger - 1e-9) st.bar = null;
}

// ---- 相手の攻め（数字は tactics.js）：予告 warn → 実行 act → 後始末 after → 間 gap ----
const gapOf = (st) => Math.abs(st.f.west.x - st.f.east.x);
const inAct = (st, id) => !!st.tactic && st.tactic.id === id && st.tactic.phase === 'act';
const tacticPower = (st) => tacticTiming(st.f[st.tactic.side].tacticIndex).power;

// ぶつかりで使う重さ：踏ん張りの act ×mass・解けた後 ×afterMass
function massOf(st, side) {
  const f = st.f[side], t = st.tactic;
  let m = f.mass;
  if (t && t.side === side && t.id === 'fumbari') {
    if (t.phase === 'act') m *= TACTICS.fumbari.mass;
    else if (t.phase === 'after' && !st.tacticRun.recoiled) m *= TACTICS.fumbari.afterMass; // 待った時だけ、解けた後が軽い（押し込みどき）
  }
  return m;
}

function enterPhase(st, phase) {
  const t = st.tactic;
  if (st.bar && st.bar.result === null) st.bar = null; // 決まらないまま予告が終わった（倒れた・取りやめ）＝バーは消す（失敗の判定は updateTactic）
  t.phase = phase; t.from = st.t; t.until = st.t + (t.id === FOE_KIME_ID ? FOE_KIME : TACTICS[t.id])[phase];
  if (phase === 'act') { st.tacticRun.recoiled = false; startAct(st); }
}

// 実行の始まり（守りのバーに失敗した時だけ来る）：突っ張りの一突き・はたき落とし・組みの組みつき・必殺技
function startAct(st) {
  const t = st.tactic, me = st.f[t.side], op = st.f[other(t.side)];
  if (t.id === FOE_KIME_ID) { // 必殺技が決まる（今の決め技の効き目・〇の ぴったりと同じ強さ）。倒れている・届かない＝空振り（landed false）
    const landed = !!me.kimete && !op.down && !op.fell && gapOf(st) <= KIMETE_REACH[me.kimete.arch] + FOE_KIME.slack;
    if (landed) {
      fireKimete(st, t.side, 1, t.kime);
      st.finisherBy = t.side;
      st.finisherAt = st.t;
    }
    st.lastFoeKime = { kime: t.kime, arch: t.arch, landed, at: st.t };
    enterPhase(st, 'after');
  } else if (t.id === 'tsuppari') {
    const d = TACTICS.tsuppari;
    if (gapOf(st) > d.reach || op.down || op.fell) { enterPhase(st, 'after'); return; } // 届かない・倒れている＝突き損ね
    const power = tacticPower(st);
    op.vx = -op.dir * d.push * power / op.mass;
    op.vy = Math.max(op.vy, d.lift);
    if (!op.down) op.va += d.va * power; // 後ろへ反る
  } else if (t.id === 'hataki') { // 前へはたき落とす（10体目からは足もとが箱の端まで滑る＝決め技の引きと同じ）・すぐ after
    const d = TACTICS.hataki;
    if (gapOf(st) <= d.reach && !op.down && !op.fell) {
      op.down = true; op.a = d.fallA; op.va = 0; op.standHeld = 0;
      st.tacticRun.slapAt = st.t;
      if (me.tacticIndex >= d.slideFrom) op.vx = -op.dir * d.slide * tacticPower(st) / op.mass;
      me.x -= me.dir * d.back;
    }
    enterPhase(st, 'after');
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
// 敵の必殺技の場所：'ok'＝出せる／'far'＝相手が届く距離（KIMETE_REACH＋FOE_KIME.reach）の外／'off'＝うっちゃりで自分が背中側の端から FOE_KIME.edgeU の外
function kimePlace(me, op) {
  const arch = me.kimete.arch;
  if (arch === 'utchari' && (me.dir > 0 ? me.x - KAMI.BOX.l : KAMI.BOX.r - me.x) > FOE_KIME.edgeU) return 'off';
  return Math.abs(op.x - me.x) > KIMETE_REACH[arch] + FOE_KIME.reach ? 'far' : 'ok';
}

// 攻めの段取り（1コマごと・押し合いの間だけ）
// 敵の必殺技は攻めの順番の1つ（攻め・必殺技・攻め・必殺技…・ボタン1つ Task 2b Ruling 10）：順番が来て出せなければ（届かない・間の中）次の攻めへ、
// 次の順番でまた試す（届かない時は FOE_KIME.wait 秒まで届くのを待ってから飛ばす・Ruling 12）。必殺技の後は攻めの間 gap を使わず FOE_KIME.next 秒で次の攻め（攻めを持たない敵は、必殺技だけを繰り返す）
function updateTactic(st) {
  const run = st.tacticRun;
  if (run.pushAt === null) {
    run.pushAt = st.t; run.next = st.t + TACTIC_START;
    const w = st.f.west;
    run.kimeTurn = warnKime(w); // 最初の順番は必殺技
  }
  const t = st.tactic;
  if (t) {
    const me = st.f[t.side], op = st.f[other(t.side)];
    if (t.phase !== 'after' && (me.down || me.fell)) { enterPhase(st, 'after'); return; } // 倒れた敵は攻めをやめる
    if (t.phase === 'warn' && (op.down || op.fell)) { enterPhase(st, 'after'); return; } // 予告の間に主人公が倒れた＝バーをためられない＝攻めは来ない（Review Focus #3）
    if (st.t < t.until - 1e-9) return;
    if (t.phase === 'warn') { if (st.bar && st.bar.result === null) endBar(st, 'ng'); enterPhase(st, 'act'); } // 決めないまま予告が終わった＝失敗
    else if (t.phase === 'act') enterPhase(st, 'after');
    else { st.tactic = null; run.next = st.t + (t.id === FOE_KIME_ID ? FOE_KIME.next : tacticTiming(me.tacticIndex).gap); }
    return;
  }
  const side = 'west', me = st.f[side], op = st.f[other(side)], list = me.tactics;
  if (st.t < run.next || me.down || me.fell || !(list.length || warnKime(me))) return;
  if (op.down || op.fell || op.ring || me.ring) return; // 主人公が倒れている間は始めない（起き上がってから）・〇が出ている間も待つ（1度に1つ）
  if (st.t < op.upAt + BAR.getUp || op.upHeld) return; // 起き上がってから getUp 秒・起き上がりの指を離すまでは始めない（Ruling 6）
  const place = run.kimeTurn && st.t >= me.cool && !me.fell && !op.fell ? kimePlace(me, op) : null;
  if (place === 'far') { // 届かない：FOE_KIME.wait 秒までは待つ（ほかの攻めも始めない）・過ぎたら攻めへ（うっちゃりの端の外 'off' は待たずに攻めへ）
    if (run.kimeWait === null) run.kimeWait = st.t;
    if (st.t < run.kimeWait + FOE_KIME.wait - 1e-9) return;
  } else if (place === 'ok') {
    run.kimeWait = null; // 必殺技の予告。バーの型は系統から（KIME_TYPE）・次の必殺技は予告の終わりから kimete.gap 秒より後
    const spec = barSpec(KIME_TYPE[me.kimete.arch], me.tacticIndex);
    const warn = barWarn(spec);
    st.tactic = { side, id: FOE_KIME_ID, kime: me.kimete.id, arch: me.kimete.arch, phase: 'warn', from: st.t, until: st.t + warn };
    me.cool = st.t + warn + me.kimete.gap;
    run.kimeTurn = !list.length;
    startBar(st, other(side), FOE_KIME_ID, spec);
    return;
  }
  for (let k = 0; k < list.length; k++) { // 順番に。組みはくっついた時だけ（離れていれば次の攻めへ）
    const id = list[(run.n + k) % list.length];
    if (id === 'kumi' && gapOf(st) > TACTICS.kumi.start) continue;
    run.n += k + 1;
    const spec = barSpec(TACTIC_TYPE[id], me.tacticIndex);
    const warn = barWarn(spec); // 予告＝バーが間に合う長さ（Review Focus #2）
    st.tactic = { side, id, phase: 'warn', from: st.t, until: st.t + warn };
    run.kimeWait = null;
    if (warnKime(me)) run.kimeTurn = true; // 次の順番は必殺技
    startBar(st, other(side), id, spec);
    return;
  }
}

// たたき（tap）が攻めに当たった時
function tacticOnTap(st, side, beforeHop) {
  const t = st.tactic;
  if (!t || t.phase !== 'act' || t.side === side) return false;
  const me = st.f[side], owner = st.f[t.side];
  if (beforeHop) {
    if (t.id === 'kumi') { // 素早く連打して振りほどく
      const d = TACTICS.kumi;
      st.tacticRun.taps = st.tacticRun.taps.filter((x) => st.t - x < d.window).concat([st.t]);
      if (st.tacticRun.taps.length >= d.taps) { enterPhase(st, 'after'); owner.stun = Math.max(owner.stun, d.stun); }
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

// たたき：立ち合いと跳ねだけ（〇は見ない＝〇の判定は press）
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
  const t = st.tactic;
  if (t && t.side !== side && t.phase === 'warn') return; // 自分への予告の間は跳ねない（バーの結果が出た後も・Ruling 5）＝ためるのは hold
  if (t && t.side === side && (t.phase === 'warn' || (t.phase === 'act' && t.id !== 'tsuppari'))) return; // 予告（構え）・踏ん張り・組みの間、攻める側は跳ねない
  if (!grounded(me)) return;
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

// 押し始めた押しが緑の上の端に届く前に予告が終わらないように、予告を延ばす（延びるだけ・最終点検の直し 2：反応の遅い人）。
// 元の終わりは bar.warnEnd に控え、「まだ」の短い一押しなら元へ戻す（連打で予告を延ばし続けられない）
function lateWarn(st, b, on) {
  const t = st.tactic;
  if (!t || t.phase !== 'warn' || t.side === b.side) return;
  if (b.warnEnd === null) b.warnEnd = t.until;
  if (on && st.t >= b.warnEnd - 1e-9) return; // 元の終わりを過ぎてからの押し直しでは延ばさない（同じコマで離して押し直す繰り返しで止め続けられない）
  t.until = on ? Math.max(b.warnEnd, b.heldFrom + b.fillMs * (b.center + b.half) / 1000 + BAR.late) : b.warnEnd;
}

// 押す・離す（倒れている時は起き上がり。立っていてバーが出ていれば、新しい押しでため始め・離して判定）
export function hold(st, side, on) {
  const me = st.f[side], was = me.held;
  me.held = !!on;
  if (!on) { me.standHeld = 0; me.upHeld = false; }
  const kr = me.ring;
  if (kr && ringInput(kr) === 'hold' && st.phase === 'push' && !me.down && !me.fell) { kimeHold(st, side, on, was); return; } // 長押しの技の〇（バーより先・同時には出ない）
  if (!barOpen(st, side) || me.down || me.fell) return;
  const b = st.bar;
  if (on && !was && b.heldFrom === null) { if (st.t >= b.from + BAR.react - 1e-6) { b.heldFrom = st.t; lateWarn(st, b, true); } }
  else if (!on && was && b.heldFrom !== null) {
    const g = barGauge(st);
    if (barInBand(b, g)) endBar(st, 'ok');
    else if (st.t - b.heldFrom < BAR.tapMax && g < b.center - b.half) { b.heldFrom = null; lateWarn(st, b, false); } // 短い一押し＝まだ（延ばした予告も元へ）
    else endBar(st, 'ng');
  }
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
    if (f.held) { f.standHeld += dt; if (f.standHeld >= f.standTime) { f.down = false; f.a = 0; f.va = 0; f.standHeld = 0; f.upAt = st.t; f.upHeld = true; } } // 起きた時刻（次の予告の猶予・Ruling 6）
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
  if (st.phase === 'ready' && st.t >= st.signalAt) { // 合図で、まだ立ち合っていない側に〇
    for (const s of SIDES) { const f = st.f[s]; if (!f.charged && !f.ring) f.ring = { side: s, kind: 'tachiai', from: st.signalAt, hitAt: st.signalAt + RING.tachiaiHit }; }
  }
  for (const s of SIDES) { const r = st.f[s].ring; if (r && ringInput(r) === 'hold' && r.heldFrom !== null && kimeHoldGauge(st, s) >= 1) finishKimeHold(st, s, 1); } // 長押しの技の満タン＝×
  expireRings(st); // たたかない側は、〇が通り過ぎた時（合図＋0.9＋0.17秒）に弱い当たり 0.5 で立ち合う
  updateBar(st);
  if (st.phase === 'push') updateTactic(st);
  for (const s of SIDES) {
    const f = st.f[s];
    if (f.outAt === undefined && !onBox(f)) f.outAt = st.t; // 箱の上から外へ出た時刻（足もとが箱の外＝もう床が無い）
    else if (f.outAt !== undefined && onBox(f) && f.y >= 0) f.outAt = undefined; // 宙で箱の上へ戻った（まだ床より上）＝出ていない
    if (!f.fell && f.y < KAMI.FALL_Y) f.fell = true;
  }
  const e = st.f.east, w = st.f.west;
  if (e.fell || w.fell) {
    // 負け＝先に箱の外へ出た方（10/17 バグ出し：相手を右の外へ高く打ち上げ、追って外へ出た主人公が先に下まで落ちて負けになった）。
    // 落ちていない側がまだ箱の上なら、落ちた側の負け（今まで通り）。両方が外なら先に出た方・同じ時刻なら低い方（同じ高さなら主人公の負け＝主人公を有利にしない）
    const outE = e.outAt === undefined ? Infinity : e.outAt, outW = w.outAt === undefined ? Infinity : w.outAt;
    const bothOut = outE < Infinity && outW < Infinity;
    const loser = bothOut && outE !== outW ? (outE < outW ? 'east' : 'west')
      : e.fell && w.fell ? (e.y <= w.y ? 'east' : 'west')
      : bothOut ? (e.y <= w.y ? 'east' : 'west')
      : e.fell ? 'east' : 'west';
    st.winner = other(loser);
    const lf = st.f[loser];
    const win = st.finisherArch === 'hiki' ? 3 : 2; // 引きは倒してから落ちるまで時間がかかる
    st.how = st.finisherBy === st.winner && st.t - st.finisherAt <= win ? 'finisher' : lf.down ? 'down' : 'push';
    st.phase = 'done';
    st.tactic = null; st.bar = null; // 取組の終わりで攻めとバーは止まる
    e.ring = null; w.ring = null;
  }
}
