// 勝ちの手ごたえ（設計書 2026-10-14-sumo-one-button-ring-bar-design.md §12・10/15 本人「勝っても気持ちよくない」）
// 演出を出す条件（純粋な関数）と、画面の時間の倍率（ヒットストップ＝0・スロー＝0.3）の時計。
// 画面（KamiScene）は毎コマ clockTick で実の秒を「計算の秒」に直し、機械のたたき手と step の両方にその秒を渡す＝
// 両方の型紙・〇・バー・相手の攻めが同じだけ止まる／遅くなる（〇とバーの判定は計算の時刻 st.t で決まる＝止まっている間に押しても、見えている〇・バーのとおりに判定される）。
// 強さの計算（kami.js）は何も変えない。足す遅れは1番で FEEL.budget 秒まで（ヒットストップは stopBudget まで・スローの分は残す）
import { KAMI } from './kami.js?v=41';
import { PLAY_COUNT } from './ladder.js?v=41';

export const FEEL = {
  // 〇の判定ごと（2＝◎・1＝○）：stop＝止まる秒・flash＝白い光の濃さ（0.5 以下・1回）・shake＝揺れ（px・秒＝0.2 以下）・vol＝「バシッ」の大きさ
  ring: {
    2: { stop: 0.12, flash: 0.45, shake: { px: 6, s: 0.18 }, sound: 'bashi', vol: 1 },
    1: { stop: 0.06, flash: 0.2, shake: { px: 3, s: 0.12 }, sound: 'bashi', vol: 0.55 },
  },
  // 敵の必殺技が届いて決まった：止まって揺れる（白い光は主人公の一押しだけ）
  foeKime: { stop: 0.1, flash: 0, shake: { px: 5, s: 0.16 }, sound: 'bashi', vol: 0.7 },
  // 箱の端を越えた後のスロー：勝ち＝0.3倍で約1秒・少し寄る／負け＝短く・暗く
  slow: { win: { scale: 0.3, secs: 1, dark: false, zoom: 1.04 }, lose: { scale: 0.3, secs: 0.5, dark: true, zoom: 1.02 } },
  // 連打：箱が沈む px・型紙の震え px（拍に合うと少し強く）・戻るまでの ms
  mash: { sink: 4, beatSink: 7, jitter: 1.5, beatJitter: 3, ms: 220 },
  zabutonFrom: 9, // 10体目（0から9）から座布団
  budget: 2, // 1番で足す遅れの上限（秒）
  stopBudget: 1.2, // そのうちヒットストップに使える分（残りはスロー）
};

// ev＝{ type: 'ring', judge, reach }（主人公の〇の判定）・{ type: 'foeKime', landed }（敵の必殺技）。演出なし＝null
// ×（judge 0）・届かない（reach false）・空振りの必殺技は何も出さない（揺れない）
export function feelFor(ev) {
  if (!ev) return null;
  if (ev.type === 'ring') {
    if (ev.reach === false) return null;
    const f = FEEL.ring[ev.judge];
    return f ? { ...f, shake: { ...f.shake } } : null;
  }
  if (ev.type === 'foeKime') return ev.landed ? { ...FEEL.foeKime, shake: { ...FEEL.foeKime.shake } } : null;
  return null;
}

// 落ちる側が主人公（heroLost）なら短く暗く
export const slowFor = (heroLost) => ({ ...(heroLost ? FEEL.slow.lose : FEEL.slow.win) });

export function mashFeel(onBeat) {
  const m = FEEL.mash;
  return { sink: onBeat ? m.beatSink : m.sink, jitter: onBeat ? m.beatJitter : m.jitter, ms: m.ms };
}

// 勝った時のにぎわい：'zabuton'＝座布団が舞い、どよめきが大きくふくらむ（必殺技で勝ち・10体目以降と大ボス・昇進の一番）／'cheer'＝ふつうの勝ち（拍手と歓声）／'none'＝負け
// how＝計算の st.how（'finisher' は勝った側の決め技で決まった）・promoted＝この勝ちで上がる番付（無い＝null）
export function cheerLevel(r) {
  if (!r || !r.won) return 'none';
  const big = r.how === 'finisher' || r.foeIndex >= FEEL.zabutonFrom || r.foeIndex === PLAY_COUNT - 1 || !!r.promoted;
  return big ? 'zabuton' : 'cheer';
}

// 箱の端を越えて、面より下へ落ち始めた（宙に浮いている間は箱の上へ戻れるので数えない）
export const pastEdge = (f) => !!f && (f.fell || ((f.x < KAMI.BOX.l || f.x > KAMI.BOX.r) && f.y < 0));

// ---- 画面の時間の倍率の時計 ----
const secs = (v) => (v > 0 && Number.isFinite(v) ? v : 0);

export function newClock() {
  return { stop: 0, slow: 0, scale: 1, stopSpent: 0, spent: 0 };
}

// ヒットストップ（重ねても延びない＝長い方だけ・使える分を使い切ったら止まらない）
export function clockHit(c, s) {
  const room = Math.max(0, Math.min(FEEL.stopBudget - c.stopSpent, FEEL.budget - c.spent));
  c.stop = Math.max(c.stop, Math.min(secs(s), room));
  return c;
}

// スロー（scale 倍で s 秒・遅れが budget を超える分は短くする）
export function clockSlow(c, s, scale) {
  const k = Math.max(0, Math.min(1, Number.isFinite(scale) ? scale : 1));
  if (k >= 1) return c;
  const room = Math.max(0, FEEL.budget - c.spent - c.stop);
  c.slow = Math.min(secs(s), room / (1 - k));
  c.scale = k;
  return c;
}

// たたいて飛ばす：スローの残りは元の速さ（ヒットストップは短いのでそのまま）
export function clockSkip(c) {
  c.slow = 0;
  return c;
}

export const clockStopped = (c) => c.stop > 0;
export const clockSlowing = (c) => c.slow > 0;

// 実の秒 real を、計算に渡す秒へ（止まりの残り→スローの残り→元の速さ の順に使う）
export function clockTick(c, real) {
  let rest = secs(real), out = 0;
  if (c.stop > 0) {
    const u = Math.min(c.stop, rest);
    c.stop -= u; rest -= u; c.stopSpent += u; c.spent += u;
    if (c.stop < 1e-9) c.stop = 0;
  }
  if (c.slow > 0 && rest > 0) {
    const u = Math.min(c.slow, rest);
    c.slow -= u; rest -= u; out += u * c.scale; c.spent += u * (1 - c.scale);
    if (c.slow < 1e-9) c.slow = 0;
  }
  return out + rest;
}

// ---- 取組の曲の重ねる段（src/ui/music.js の nokotta の layers）：0＝立ち合い前（大太鼓と拍子木だけ）・1＝押し合い・2＝追い込み（刻みが細かく強く）
// 追い込み＝どちらかの足が土俵（KAMI.RING）の外＝箱の端から 110px の内側、または取組の時刻が MUSIC.long 秒を過ぎた（長い取組）。テンポは変えない
export const MUSIC = { long: 30 };
export function musicLevel(st) {
  if (!st || st.phase === 'ready') return 0;
  if (st.phase !== 'push') return 1;
  if (st.t > MUSIC.long) return 2;
  const out = (f) => !!f && (f.x < KAMI.RING.l || f.x > KAMI.RING.r);
  return out(st.f.east) || out(st.f.west) ? 2 : 1;
}
