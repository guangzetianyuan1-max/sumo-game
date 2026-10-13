// src/core/kamibutton.js — 紙相撲の下のボタンの見た目（場面→字の鍵・色・拍の近さ・起き上がりの進み）。画面から切り離した純粋な関数
import { KAMI, beatOffset, gaugeLit } from './kami.js?v=33';
import { gaugeTier, TIER_COLOR } from './gaugetier.js?v=33';

const COLOR = {
  wait: 0x5a5f6e, // 灰
  go: 0xe3c27a, // 金
  tap: 0xc8553d, // 朱（決めのボタンの色）
  hold: 0x3d6fc8, // 青
  finish: 0xe3c27a, // 金
  done: 0x5a5f6e,
};

const look = (mode, pulse, fill) => ({ mode, label: `kami.btn.${mode === 'done' ? 'wait' : mode}`, color: COLOR[mode], pulse, fill, tier: 0 });

// 決め技のゲージの段（光っている間だけ・光っていない＝0）：相性の倍率と、光ってからの割合（gaugeTier）
export function gaugeTierOf(st, side = 'east') {
  if (!gaugeLit(st, side)) return 0;
  const me = st.f[side];
  const frac = me.gaugeTime > 0 ? (st.t - me.litFrom) / me.gaugeTime : 1;
  return gaugeTier(me.kimete ? me.kimete.power : 1, frac);
}

export function buttonLook(st, side = 'east') {
  const me = st.f[side];
  if (st.phase === 'done') return look('done', 0, 0);
  if (st.phase === 'ready') {
    return look(st.t >= st.signalAt && !me.charged ? 'go' : 'wait', 0, 0);
  }
  if (me.down) return look('hold', 0, Math.max(0, Math.min(1, me.standHeld / me.standTime)));
  if (gaugeLit(st, side)) {
    // 決め技：段の色（1 青・2 赤・3 金）。4＝虹は画面の側で色を回す（color は金のまま）
    const tier = gaugeTierOf(st, side);
    return { ...look('finish', 0, 0), tier, color: TIER_COLOR[tier] || COLOR.finish };
  }
  return look('tap', Math.max(0, 1 - beatOffset(st) / (KAMI.BEAT / 2)), 0);
}

// 練習の一番（1体目）のことねの吹き出しの鍵：立ち合い前＝ready・押し合い＝push・倒れた＝down・ゲージが光った＝finish・終わり＝null
const COACH = { wait: 'ready', go: 'ready', tap: 'push', hold: 'down', finish: 'finish' };
export function coachKey(st, side = 'east') {
  const m = COACH[buttonLook(st, side).mode];
  return m ? `kami.coach.${m}` : null;
}
