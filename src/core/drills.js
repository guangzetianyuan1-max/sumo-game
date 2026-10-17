// 稽古の3つの遊び（10/13 本人「稽古がしょぼい。一押し、連打、長押しの訓練が欲しい」・20体版 Task 6）
// どの遊びも点数を 0〜1 にそろえ、伸びの倍率（0.5〜1.5・ふつうの出来 6割で 1.0）にする。画面（DrillScene）から切り離した純粋な関数
//   一押し（立ち合い）＝技：金の輪が縮んで的の輪に重なった瞬間に一押し。5回・ぴったり2点／近い1点／外れ0点（10点満点）
//   連打（鉄砲）＝体：5秒間の連打の回数（30回で満点）
//   長押し（四股）＝心：押している間ゲージがたまる。緑の帯でちょうど離す。3回・帯の真ん中ほど高い

import { barGreenScale } from './tactics.js?v=59';

export const DRILLS = ['ippon', 'renda', 'nagaoshi'];
export const DRILL_STAT = { ippon: 'gi', renda: 'tai', nagaoshi: 'shin' };
// 一番低い心技体に合う遊び（親方の勧め）
export const STAT_DRILL = { gi: 'ippon', tai: 'renda', shin: 'nagaoshi' };

export const MULT_MIN = 0.5; // 下手でも少しは伸びる
export const MULT_MAX = 1.5; // 上手
export const NORMAL_SCORE = 0.6; // ふつうの出来＝倍率 1.0（careersim はこの出来で回す）

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

// 点数（0〜1）→ 伸びの倍率。0 で 0.5・6割で 1.0・満点で 1.5（2本の直線・増える一方）
export function drillMult(score) {
  const s = clamp01(score);
  if (s <= NORMAL_SCORE) return MULT_MIN + (1 - MULT_MIN) * (s / NORMAL_SCORE);
  return 1 + (MULT_MAX - 1) * ((s - NORMAL_SCORE) / (1 - NORMAL_SCORE));
}

// 親方の一言の段は伸びの倍率（drillMult）で決める（v45b・バグ出し2：59%＝伸び×0.99 で一番きつい怒鳴りだった）：
//   great（×1.375 以上＝9割・笑う）・good（×1.0 以上＝6割＝ふつうの伸び・笑う）・ok（×0.8 以上＝約36%・ふつうの顔で「もう一息」）・bad（それ未満・怒鳴る）
//   ＝6割前後（ok と good の境）はどちらもふつうの言葉。怒鳴るのは伸びがはっきり落ちる時だけ
export const GREAT_SCORE = 0.9;
export const GRADE_MULT = { great: 1.375, good: 1, ok: 0.8 };
export function drillGrade(score) {
  const m = drillMult(score) + 1e-9; // 境目ちょうど（9割・6割）は上の段
  return m >= GRADE_MULT.great ? 'great' : m >= GRADE_MULT.good ? 'good' : m >= GRADE_MULT.ok ? 'ok' : 'bad';
}
export const gradeMood = (grade) => (grade === 'bad' ? 'shout' : grade === 'ok' || grade === 'ceiling' || grade === 'ceilingOne' ? 'normal' : 'smile');
// 心技体の稽古の親方の一言の段（Ruling R6・v47）：稽古の後に3つとも天井（allCeil）＝'ceiling'（「天井だ。次は土俵で勝て！」）・
// 伸ばした物だけ天井（atCeil）＝'ceilingOne'（「{stat}は天井だ。ほかの稽古をしろ！」・v47 本人「稽古のナビがまちまち」：1つ天井に着いただけで土俵へ行けと言っていた）・ほかは出来の段
export const statDrillGrade = (score, atCeil, allCeil = false) => (allCeil ? 'ceiling' : atCeil ? 'ceilingOne' : drillGrade(score));

// ---- 決め技の習得ゲージ（10/14 本人「稽古の出来で決め技を習得できるようにしてください」→ A 習得ゲージ） ----
// 決め技の稽古1回でたまる量＝max(0.35, 出来/0.6)。合計が1以上で習得＝6割の出来で1回・どんなに下手でも3回で必ず覚える。1回で満タンを超える分は捨てる（上限1）
export const KIMETE_MIN_GAIN = 0.35;
export const kimeteGain = (score) => Math.min(1, Math.max(KIMETE_MIN_GAIN, clamp01(score) / NORMAL_SCORE));
// ゲージ（0〜1）→ 画面の％。切り捨て（満タン前に100%と出さない・0.58 が 57 にならないよう少しだけ足す）
// 決め技モードの親方の一言の段（10/15 バグ出し：53% で「なんだそれは！」・同じ 53% で習得なら「見事！」とずれた）：
// 点数でなく、ゲージがどれだけ進んだかで決める。覚えた＝great・ゲージが満タンの KIMETE_GOOD_GAIN 以上進んだ＝good・ほか＝bad
export const KIMETE_GOOD_GAIN = 0.6;
export function kimeteGrade({ learned, from, to }) {
  if (learned) return 'great';
  const gain = (Number.isFinite(to) ? to : 0) - (Number.isFinite(from) ? from : 0);
  return gain >= KIMETE_GOOD_GAIN - 1e-9 ? 'good' : 'bad';
}
export const kimetePct = (v) => (Number.isFinite(v) ? Math.min(100, Math.max(0, Math.floor(v * 100 + 1e-6))) : 0);

// ---- 一押し ----
// 輪は startR から縮み、hitMs で的の輪 targetR にぴったり重なる（その後も縮み続ける）。
// 押した時刻と hitMs の差が perfectMs 以内＝2点・nearMs 以内＝1点・それより外＝0点。hitMs + nearMs を過ぎても押さなければ外れ
export const IPPON = { rounds: 5, startR: 230, targetR: 80, perfectMs: 70, nearMs: 170, gapMs: 700 };
const IPPON_HIT = [1100, 900, 1300, 800, 1000]; // 回ごとに縮む速さを変える（同じ間合いでは覚えて押せる）
export const ipponHitMs = (round) => IPPON_HIT[((round % IPPON_HIT.length) + IPPON_HIT.length) % IPPON_HIT.length];

export function ipponRadius(elapsedMs, hitMs) {
  const r = IPPON.startR + (IPPON.targetR - IPPON.startR) * (elapsedMs / hitMs);
  return Math.max(0, Math.min(IPPON.startR, r));
}

// 押した時刻のずれ（ms・早い＝負）→ 2・1・0 点
export function ipponJudge(offsetMs) {
  if (!Number.isFinite(offsetMs)) return 0;
  const d = Math.abs(offsetMs);
  return d <= IPPON.perfectMs ? 2 : d <= IPPON.nearMs ? 1 : 0;
}

// 押さないまま輪が通り過ぎた（外れ）
export const ipponMissed = (elapsedMs, hitMs) => elapsedMs > hitMs + IPPON.nearMs;

export const ipponScore = (points) => clamp01(points.reduce((a, p) => a + p, 0) / (IPPON.rounds * 2));

// ---- 連打 ----
export const RENDA = { ms: 5000, full: 30 };
// 連打の前の 3・2・1・GO：from から 1 つずつ stepMs ごとに減り、from*stepMs で GO（0）＝そこから RENDA.ms を数える
export const COUNTDOWN = { from: 3, stepMs: 1000 };
// 経過 ms → 今出す数（3・2・1・0＝GO）。始まる前・壊れた値は最初の数
export function countdownAt(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return COUNTDOWN.from;
  return Math.max(0, COUNTDOWN.from - Math.floor(elapsedMs / COUNTDOWN.stepMs));
}
// 遊びの始まりの時刻は、画面の最初のコマで決める（v42 本人「連打稽古が 3・2・1・GO から始まらない時がある」）：
// 画面を開いた時（create）の scene.time.now は、前にこの画面を閉じた時刻のまま止まっている（Phaser の場面の時計は走っている間しか進まない）。
// そこで startAt を決めると、2回目以降に開いた時は最初のコマで「閉じていた長さ」だけ進んだことになり、3・2・1 を飛ばしていきなり GO（一押しは「よーい」を飛ばす）。
// startAt がまだ数でなければ（開いたばかり）、最初のコマの now ＋ lead を始まりにする。数ならそのまま
export const armStart = (startAt, now, lead = 0) => (Number.isFinite(startAt) ? startAt : now + (Number.isFinite(lead) ? lead : 0));
// 稽古の始め方（v47 本人「稽古の始め方をそろえる」：前は 連打＝3・2・1・GO／一押し＝「よーい」だけ／長押し＝すぐ始まる）：
// 3つとも 3・2・1・GO（'count'）から。GO の後は 一押し＝最初の輪（'ring'）・連打＝5秒を数える（'run'）・長押し＝押すのを待つ（'wait'）
export const drillStartPhase = () => 'count';
export const afterCountdown = (kind) => (kind === 'ippon' ? 'ring' : kind === 'renda' ? 'run' : 'wait');
export const rendaScore = (count) => clamp01((Number.isFinite(count) ? count : 0) / RENDA.full);

// ---- 長押し ----
// 押している長さ held（ms）→ ゲージ 0〜1（fillMs で満タン・満タンまで上げると上げすぎ＝0点）
// 帯は center ± half。帯の真ん中で1点・帯の端で edge 点・帯の外は0点
// half は帯の半分の幅の基本（1体目）。稽古では次の相手の番号で狭める（nagaoshiHalf・v43：取組と同じ barGreenScale）。half を渡さない＝基本の幅
export const NAGAOSHI = { rounds: 3, fillMs: 1600, center: 0.75, half: 0.08, edge: 0.4, gapMs: 700 };
export const nagaoshiHalf = (foeIndex) => NAGAOSHI.half * barGreenScale(foeIndex);
export const nagaoshiGauge = (heldMs) => clamp01(heldMs / NAGAOSHI.fillMs);
export const nagaoshiInBand = (g, half = NAGAOSHI.half) => Math.abs(g - NAGAOSHI.center) <= half + 1e-9;

export function nagaoshiPoint(g, half = NAGAOSHI.half) {
  if (!Number.isFinite(g) || g >= 1 || !nagaoshiInBand(g, half)) return 0;
  const d = Math.min(1, Math.abs(g - NAGAOSHI.center) / half);
  return 1 - (1 - NAGAOSHI.edge) * d;
}

export const nagaoshiScore = (points) => clamp01(points.reduce((a, p) => a + p, 0) / NAGAOSHI.rounds);

// ---- 画面が裏へ回って戻った時の時計の直し（遊びの時計は画面が裏でも進む：戻った最初のコマで now が dur だけ飛ぶ） ----
// c＝{ phase, roundAt, startAt, gapUntil, runAt }（遊びの今の時計）・now＝戻った最初のコマの時刻・dur＝裏にいた長さ（ms）。新しい時計を返す（元は書き換えない）
//   3つとも：3・2・1・GO の最中は裏にいた分だけ後ろへずらす（数えが裏で進まない・始まりが決まる前は触らない）
//   一押し：輪が出ている最中ならその回をやり直す（外れにしない）／次の輪までの間は裏にいた分だけ後ろへ
//   連打：走っている最中は裏にいた分だけ後ろへずらす（5秒が裏で尽きない）
//   長押し：次の回までの間だけ後ろへずらす（押している最中は別に「やり直し」になる）
export function shiftForHidden(kind, c, now, dur) {
  const d = Number.isFinite(dur) && dur > 0 ? dur : 0;
  const out = { phase: c.phase, roundAt: c.roundAt, startAt: c.startAt, gapUntil: c.gapUntil, runAt: c.runAt };
  if (c.phase === 'count') {
    if (Number.isFinite(c.startAt)) out.startAt = c.startAt + d; // 3・2・1・GO は裏にいた間は止まる（まだ始まりが決まっていない＝armStart の前なら触らない）
  } else if (kind === 'ippon') {
    if (c.phase === 'ring') out.roundAt = now;
    else if (c.phase === 'gap') out.gapUntil = c.gapUntil + d;
  } else if (kind === 'renda') {
    if (c.phase === 'run') out.runAt = c.runAt + d;
  } else if (c.phase === 'gap') {
    out.gapUntil = c.gapUntil + d;
  }
  return out;
}
