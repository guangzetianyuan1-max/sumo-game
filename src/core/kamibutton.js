// src/core/kamibutton.js — 紙相撲の下のボタン1つの見た目（10/14 ボタン1つ Task 3・設計書 2026-10-14-sumo-one-button-ring-bar-design.md §2）。画面から切り離した純粋な関数
// 場面→mode：立ち合い前 wait・合図（立ち合いの〇）go・押し合い tap・決め技の〇 ring・守りのバー bar・
//   バーが出た時に指が押したまま（ためていない）again（「はなして、もう一度」・ledger Ruling 6/7 の後始末）・
//   踏ん張り中（バーに失敗して来た敵の踏ん張りの act＝押すと跳ね返される）stay「待て」（最終点検の直し 3）・倒れた hold・終わり done
// 〇とバーの絵そのものは src/ui/hud.js（中央上の〇・左端のバー）。ここはボタンの字・色・脈・満ちと、下の案内・ことねの吹き出しの鍵だけ
import { KAMI, beatOffset, gaugeLit, barGauge } from './kami.js?v=38';
import { gaugeTier } from './gaugetier.js?v=38';
import { IPPON } from './drills.js?v=38';
import { BAR } from './tactics.js?v=38';

export const BUTTON_COLOR = { // 遊び方の見本（HelpScene）も同じ色を使う
  wait: 0x5a5f6e, // 灰
  go: 0xe3c27a, // 金（立ち合いの〇）
  ring: 0xf0b030, // 濃い金（決め技の〇）
  tap: 0xc8553d, // 朱（連打）
  bar: 0x4f8a5b, // 緑（バーをためる＝緑の帯で離す）
  again: 0x8a5ab0, // 紫（はなして、もう一度）
  stay: 0x6e4a46, // くすんだ赤茶（踏ん張り中は待て・攻めの札の「踏ん張り中」と同じ系統）
  hold: 0x3d6fc8, // 青（起き上がり）
  done: 0x5a5f6e,
};
const LABEL = { wait: 'wait', go: 'go', ring: 'go', tap: 'tap', bar: 'bar', again: 'again', stay: 'stay', hold: 'hold', done: 'wait' }; // 〇の時は立ち合いも決め技も「一押し！」
const HINT = { wait: 'ready', go: 'ready', ring: 'ring', tap: 'push', bar: 'bar', again: 'again', stay: 'stay', hold: 'down' };
const COACH = { wait: 'ready', go: 'ready', ring: 'finish', tap: 'push', bar: 'bar', again: 'again', stay: 'stay', hold: 'down' };
const RING_PULSE_S = 0.5; // 〇のぴったりからこの秒離れると脈は 0

// 決め技のゲージの段（光っている間だけ・光っていない＝0）：相性の倍率と、光ってからの割合（gaugeTier）
export function gaugeTierOf(st, side = 'east') {
  if (!gaugeLit(st, side)) return 0;
  const me = st.f[side];
  const frac = me.gaugeTime > 0 ? (st.t - me.litFrom) / me.gaugeTime : 1;
  return gaugeTier(me.kimete ? me.kimete.power : 1, frac);
}

const look = (mode, pulse = 0, fill = 0, alert = false, band = null) => ({ mode, label: `kami.btn.${LABEL[mode]}`, color: BUTTON_COLOR[mode], pulse, fill, alert, band });
const ringPulse = (st, r) => Math.max(0, 1 - Math.abs(st.t - r.hitAt) / RING_PULSE_S);

// ボタン1つの見た目：{ mode, label（字の鍵）, color, pulse（0〜1・ふちの輪）, fill（0〜1・弧）, alert（赤いふち＝守りの間）, band（バーの間だけ・弧の上の緑の帯 [下, 上]＝左端のバーと同じ割合） }
// 倒れている間は〇やバーがあっても hold（長押しは起き上がりに使う・バーはためられない）
export function buttonLook(st, side = 'east') {
  const me = st.f[side];
  if (st.phase === 'done') return look('done');
  if (st.phase === 'ready') {
    const r = me.ring;
    return r && r.kind === 'tachiai' && !me.charged ? look('go', ringPulse(st, r)) : look('wait');
  }
  if (me.down) return look('hold', 0, Math.max(0, Math.min(1, me.standHeld / me.standTime)));
  if (me.ring) return look('ring', ringPulse(st, me.ring));
  const b = st.bar && st.bar.side === side && st.bar.result === null ? st.bar : null;
  if (b) {
    if (me.held && b.heldFrom === null) return look('again', 0, 0, true); // 指が押したまま（出る前からの指・出てすぐの押し）＝ためていない
    return look('bar', 0, b.heldFrom === null ? 0 : barGauge(st), true, [b.center - b.half, b.center + b.half]);
  }
  const tac = st.tactic;
  if (tac && tac.side !== side && tac.id === 'fumbari' && tac.phase === 'act') return look('stay'); // 踏ん張り中は待つ（解けたら連打）
  return look('tap', Math.max(0, 1 - beatOffset(st) / (KAMI.BEAT / 2)));
}

// 下の案内の1行の鍵（終わったら null）
export function hintKey(st, side = 'east') {
  const l = buttonLook(st, side);
  return l.mode === 'done' ? null : `kami.hint.${HINT[l.mode]}`;
}

// 練習の一番（1体目）のことねの吹き出しの鍵：立ち合い＝ready・押し合い＝push・〇＝finish・バー＝bar・はなして もう一度＝again・踏ん張り中＝stay・倒れた＝down・終わり＝null
export function coachKey(st, side = 'east') {
  const l = buttonLook(st, side);
  return l.mode === 'done' ? null : `kami.coach.${COACH[l.mode]}`;
}

// バーの結果の字の鍵（主人公のバーの st.lastBar から）：成功＝ok／失敗のうち 満タン・帯の上＝late（長すぎ）・押したまま予告が終わった＝slow（押すのが遅い）・
// 帯の下で離した＝early（早い）／押さなかった（たまり 0）・敵のバー・結果が無い＝null。帯は今のバー（結果は BAR.linger 秒残る）・消えた後は既定の数
export function barSayKey(st, side = 'east') {
  const r = st.lastBar;
  if (!r || r.side !== side) return null;
  if (r.result === 'ok') return 'kami.bar.ok';
  if (!(r.gauge > 0)) return null;
  const b = st.bar && st.bar.side === side ? st.bar : { center: BAR.center, half: BAR.half[1] };
  if (r.gauge >= 1 || r.gauge > b.center + b.half) return 'kami.bar.late';
  return st.f[side].held ? 'kami.bar.slow' : 'kami.bar.early';
}

// 〇の判定の見せ方（st.lastRing の judge：2＝◎・1＝○・0＝×）：主人公の〇が終わってから IPPON.gapMs の間だけ。無い＝null
export function ringFlash(st, side = 'east') {
  const r = st.lastRing;
  if (!r || r.side !== side || st.t - r.at > IPPON.gapMs / 1000) return null;
  return { judge: r.judge, key: `kami.ring.${r.judge}` };
}

// 相手の攻めの札（敵の頭の上）：予告＝warn（赤い札・攻めの字）／踏ん張り・はたきの実行＝act（落ち着いた暗い赤の札「踏ん張り中」「構え中」＝危ない間）／
// 踏ん張りが解けた後始末＝now（「今だ！押せ！」）／ほか・終わり・自分の攻め＝null。敵の必殺技の予告は name（foekime.<id>）つき
export function tacticPlate(st, side = 'east') {
  const tac = st.tactic;
  if (st.phase !== 'push' || !tac || tac.side === side) return null;
  if (tac.phase === 'warn' && tac.kime) return { kind: 'warn', key: `kami.warn.${tac.id}`, name: `foekime.${tac.kime}` }; // 敵の必殺技＝「必殺技！〇〇」（name＝技の名前の鍵）
  if (tac.phase === 'warn') return { kind: 'warn', key: `kami.warn.${tac.id}` };
  if (tac.phase === 'act' && (tac.id === 'fumbari' || tac.id === 'hataki')) return { kind: 'act', key: `kami.act.${tac.id}` };
  if (tac.phase === 'after' && tac.id === 'fumbari') return { kind: 'now', key: 'kami.now.fumbari' };
  return null;
}
