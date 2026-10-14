// src/core/kamibutton.js — 紙相撲の下の2つのボタンの見た目（左＝押し：場面→字の鍵・色・拍の近さ・起き上がりの進み／右＝決め技：光っているか・段の色）。画面から切り離した純粋な関数
import { KAMI, beatOffset, gaugeLit, bracing } from './kami.js?v=37';
import { gaugeTier, TIER_COLOR } from './gaugetier.js?v=37';

const COLOR = {
  wait: 0x5a5f6e, // 灰
  go: 0xe3c27a, // 金
  tap: 0xc8553d, // 朱（押しのボタンの色）
  hold: 0x3d6fc8, // 青
  brace: 0x4f8a5b, // 緑（こらえている＝腰を落としている）
  done: 0x5a5f6e,
};
const RIGHT_OFF = 0x3a3f4c; // 右（決め技）が光っていない・決め技なし・終わり＝暗い灰色
const RIGHT_LIT = 0xe3c27a; // 光った時の色が段に無い時（虹は画面の側で色を回す）＝金

// 決め技のゲージの段（光っている間だけ・光っていない＝0）：相性の倍率と、光ってからの割合（gaugeTier）
export function gaugeTierOf(st, side = 'east') {
  if (!gaugeLit(st, side)) return 0;
  const me = st.f[side];
  const frac = me.gaugeTime > 0 ? (st.t - me.litFrom) / me.gaugeTime : 1;
  return gaugeTier(me.kimete ? me.kimete.power : 1, frac);
}

const left = (mode, pulse, fill) => ({ mode, label: `kami.btn.${mode === 'done' ? 'wait' : mode}`, color: COLOR[mode], pulse, fill });

// 左「押し」ボタン：立ち合い前 wait・合図の後 go・押し合い tap（拍の近さで pulse）・倒れた hold（起き上がりの進み fill）・こらえている brace・終わり done。
// ゲージが光っていても tap のまま（決め技は右だけ）
export function leftLook(st, side = 'east') {
  const me = st.f[side];
  if (st.phase === 'done') return left('done', 0, 0);
  if (st.phase === 'ready') return left(st.t >= st.signalAt && !me.charged ? 'go' : 'wait', 0, 0);
  if (me.down) return left('hold', 0, Math.max(0, Math.min(1, me.standHeld / me.standTime)));
  const l = bracing(st, side) ? left('brace', 0, 0) : left('tap', Math.max(0, 1 - beatOffset(st) / (KAMI.BEAT / 2)), 0);
  // 突っ張りの予告の間（立っている時）：左に答え＝「こらえ！」の字と赤いふち（alert）。色（tap／brace）はそのまま
  const tac = st.tactic;
  if (tac && tac.side !== side && tac.id === 'tsuppari' && tac.phase === 'warn') return { ...l, label: 'kami.btn.braceNow', alert: true };
  return l;
}

// 相手の攻めの札（敵の頭の上）：予告＝warn（赤い札・攻めの字）／踏ん張り・はたきの実行＝act（落ち着いた暗い赤の札「踏ん張り中」「構え中」＝危ない間）／
// 踏ん張りが解けた後始末＝now（「今だ！押せ！」）／ほか・終わり・自分の攻め＝null
export function tacticPlate(st, side = 'east') {
  const tac = st.tactic;
  if (st.phase !== 'push' || !tac || tac.side === side) return null;
  if (tac.phase === 'warn') return { kind: 'warn', key: `kami.warn.${tac.id}` };
  if (tac.phase === 'act' && (tac.id === 'fumbari' || tac.id === 'hataki')) return { kind: 'act', key: `kami.act.${tac.id}` };
  if (tac.phase === 'after' && tac.id === 'fumbari') return { kind: 'now', key: 'kami.now.fumbari' };
  return null;
}

// 右「決め技」ボタン：none＝決め技を持っていない（字は「決め技なし」）・off＝光っていない（光っていても すき stun の間は fire が出ないので off）・lit＝光っている（段 tier と段の色）・done＝終わり。
// name＝持っていく決め技の名前の id（字は newtech.<id>・無ければ「決め技！」）
export function rightLook(st, side = 'east', name = null) {
  const me = st.f[side];
  if (!me.kimete) return { mode: 'none', label: 'kami.btn.none', color: RIGHT_OFF, tier: 0 };
  const label = name ? `newtech.${name}` : 'kami.btn.finish';
  if (st.phase === 'done') return { mode: 'done', label, color: RIGHT_OFF, tier: 0 };
  const tier = gaugeTierOf(st, side);
  if (tier > 0 && !(me.stun > 0) && !me.down && !me.fell) return { mode: 'lit', label, color: TIER_COLOR[tier] || RIGHT_LIT, tier };
  return { mode: 'off', label, color: RIGHT_OFF, tier: 0 };
}

// 練習の一番（1体目）のことねの吹き出しの鍵：立ち合い前＝ready・押し合い（こらえる含む）＝push・倒れた＝down・右が光った＝finish・終わり＝null
const COACH = { wait: 'ready', go: 'ready', tap: 'push', brace: 'push', hold: 'down' };
export function coachKey(st, side = 'east') {
  const l = leftLook(st, side);
  if (l.mode === 'done') return null;
  if (l.mode !== 'hold' && rightLook(st, side).mode === 'lit') return 'kami.coach.finish';
  return `kami.coach.${COACH[l.mode]}`;
}
