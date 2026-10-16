// src/core/chime.js — 「ここだ」の音と、連打の目標の音を、いつ鳴らすかだけを決める（音を作るのは src/ui/sfx.js の koko・tassei）
// v45 本人（10/16）「長押し、緑の帯に入って効果音」「稽古連打、目標達成で効果音」
//   長押し：ためているバーが緑の帯に入った瞬間に1度だけ。帯の中にいる間は鳴らし直さない・新しい押し（押し直し・次の予告・次の回）でまた鳴る
//   連打：数が目標（RENDA.full＝30）に届いたたたきで1度だけ（1回の5秒の中で数は増えるだけ＝越えるのは1度）
import { barGauge, barInBand, kimeHoldGauge } from './kami.js?v=47';
import { RENDA, nagaoshiInBand } from './drills.js?v=47';

// 押しごとの覚え：key＝今の押しの印（押し始めの時刻など・押していない＝null）・rung＝この押しでもう鳴らした
export const newChime = () => ({ key: null, rung: false });

// 毎コマ呼ぶ。今の押し key と、緑の帯の中か inGreen から、今鳴らすなら true（memo を書き換える）
export function greenChime(memo, key, inGreen) {
  if (key === null || key === undefined) { memo.key = null; memo.rung = false; return false; }
  if (memo.key !== key) { memo.key = key; memo.rung = false; }
  if (!inGreen || memo.rung) return false;
  memo.rung = true;
  return true;
}

// 取組（kami.js の st）：side の守りのバー、または長押しの決め技の〇を、長押しでためている間の { key（押し始めの st.t）, inGreen }。ためていない＝key null
export function boutGreen(st, side = 'east') {
  const me = st && st.f && st.f[side];
  const r = me && me.ring;
  if (r && r.input === 'hold' && st.phase !== 'done') {
    if (r.heldFrom === null || me.down || me.fell) return { key: null, inGreen: false };
    const g = kimeHoldGauge(st, side);
    return { key: r.heldFrom, inGreen: g < 1 && Math.abs(g - r.center) <= r.half + 1e-9 };
  }
  const b = st && st.bar;
  if (!b || st.phase === 'done' || b.side !== side || b.result !== null || b.heldFrom === null || !me || me.down || me.fell) return { key: null, inGreen: false };
  return { key: b.heldFrom, inGreen: barInBand(b, barGauge(st)) };
}

// 長押し稽古：押している（hold）間の { key（押し始めの時刻）, inGreen }。gauge＝今のゲージ・half＝その稽古の帯の半分の幅
export function drillGreen(phase, holdAt, gauge, half) {
  if (phase !== 'hold' || !Number.isFinite(holdAt)) return { key: null, inGreen: false };
  return { key: holdAt, inGreen: gauge < 1 && nagaoshiInBand(gauge, half) };
}

// 連打稽古：このたたきで数が prev から count になった時、目標に届いたか（届いた1度だけ true）
export const rendaGoal = (prev, count) => prev < RENDA.full && count >= RENDA.full;

// 遊び方の3枚目の見本のバー（v45b・バグ出し2 M2「2.2秒ごとに鳴り続ける」）：鳴らすのは見本の最初の DEMO_CHIMES 回のためだけ。
// lap＝何回目のため（0 から・ページを開き直すと 0 に戻る＝また2回）。それより後は黙って見本だけ動く
export const DEMO_CHIMES = 2;
export function demoChime(memo, lap, inGreen) {
  if (!(lap < DEMO_CHIMES)) return false;
  return greenChime(memo, lap, inGreen);
}
