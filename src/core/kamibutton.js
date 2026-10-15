// src/core/kamibutton.js — 紙相撲の下のボタン2つの見た目（10/15 ボタン2つに戻す・設計書 2026-10-14-sumo-one-button-ring-bar-design.md §11）。画面から切り離した純粋な関数
// 左＝連打だけ（leftLook）・右＝一押しと長押し（rightLook：〇の判定・守りのバー・起き上がり）。どちらも、出番でない時は暗い（off）
// 場面→mode（両方の元）：立ち合い前 wait・合図（立ち合いの〇）go・押し合い tap・決め技の〇 ring・守りのバー bar・
//   バーが出た時に右の指が押したまま（ためていない）again（「はなして、もう一度」・ledger Ruling 6/7 の後始末）・
//   踏ん張り中（バーに失敗して来た敵の踏ん張りの act＝左で押すと跳ね返される）stay「待て」・倒れた hold・終わり done
// 左が明るいのは tap だけ（stay は「待て」で暗い）・〇／バー／again／倒れの時は暗く「→右」。右が明るいのは go・ring・bar・again・hold（tap・stay の時は暗い）
// 〇とバーの絵そのものは src/ui/hud.js（中央上の〇・左端のバー）。ここはボタンの字・色・脈・満ち・暗さと、下の案内・ことねの吹き出しの鍵だけ
import { KAMI, beatOffset, gaugeLit, barGauge } from './kami.js?v=44';
import { gaugeTier } from './gaugetier.js?v=44';
import { IPPON } from './drills.js?v=44';
import { BAR } from './tactics.js?v=44';

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
  off: 0x3a3f4c, // 暗い灰（出番でないボタン・左右とも）
};
const LABEL = { wait: 'wait', go: 'go', ring: 'go', tap: 'tap', bar: 'bar', again: 'again', stay: 'stay', hold: 'hold', done: 'wait' }; // 〇の時は立ち合いも決め技も「一押し！」
const HINT = { wait: 'ready', go: 'ready', ring: 'ring', tap: 'push', bar: 'bar', again: 'again', stay: 'stay', hold: 'down' };
const COACH = { wait: 'ready', go: 'ready', ring: 'finish', tap: 'push', bar: 'bar', again: 'again', stay: 'stay', hold: 'down' };
const DIM = { wait: true, stay: true, done: true, off: true }; // 暗く描く mode
const RING_PULSE_S = 0.5; // 〇のぴったりからこの秒離れると脈は 0

// 決め技のゲージの段（光っている間だけ・光っていない＝0）：相性の倍率と、光ってからの割合（gaugeTier）
export function gaugeTierOf(st, side = 'east') {
  if (!gaugeLit(st, side)) return 0;
  const me = st.f[side];
  const frac = me.gaugeTime > 0 ? (st.t - me.litFrom) / me.gaugeTime : 1;
  return gaugeTier(me.kimete ? me.kimete.power : 1, frac);
}

const look = (mode, pulse = 0, fill = 0, alert = false, band = null) => ({ mode, label: `kami.btn.${LABEL[mode]}`, color: BUTTON_COLOR[mode], pulse, fill, alert, band, dim: !!DIM[mode] });
// 出番でないボタン：左＝「→右」（toRight）・右＝「一押し 長押し」（right）
const off = (label) => ({ mode: 'off', label: `kami.btn.${label}`, color: BUTTON_COLOR.off, pulse: 0, fill: 0, alert: false, band: null, dim: true });
const ringPulse = (st, r) => Math.max(0, 1 - Math.abs(st.t - r.hitAt) / RING_PULSE_S);

// 場面の見た目（左右の元）：{ mode, label（字の鍵）, color, pulse（0〜1・ふちの輪）, fill（0〜1・弧）, alert（赤いふち＝守りの間）, band（バーの間だけ・弧の上の緑の帯 [下, 上]＝左端のバーと同じ割合）, dim（暗く） }
// 倒れている間は〇やバーがあっても hold（長押しは起き上がりに使う・バーはためられない）
function sceneLook(st, side) {
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
  if (tac && tac.side !== side && tac.phase === 'warn') return look('stay'); // 予告の間（バーの結果が出た後も続く）は左で跳ねられない＝暗く「待て」
  if (tac && tac.side !== side && tac.id === 'fumbari' && tac.phase === 'act') return look('stay'); // 踏ん張り中は待つ（解けたら連打）
  return look('tap', Math.max(0, 1 - beatOffset(st) / (KAMI.BEAT / 2)));
}

// 主人公の必殺技の帯・漫画の間の、ボタン2つの見た目（暗い灰・「まだ…」）。案内の1行は hintKey でなく呼ぶ側が消す
export const neutralLook = () => look('wait');

// 左のボタン（連打）：押し合いの連打だけ明るい・踏ん張り中は「待て」・立ち合い前と終わりは暗い・〇／バー／はなして／倒れは暗く「→右」
export function leftLook(st, side = 'east') {
  const l = sceneLook(st, side);
  return l.mode === 'tap' || l.mode === 'stay' || l.mode === 'wait' || l.mode === 'done' ? l : off('toRight');
}

// 右のボタン（一押しと長押し）：〇＝「一押し！」・バー＝「長押し！」・はなして もう一度・倒れ＝「長押しで起きる」・立ち合い前と終わりは暗い・連打の間と踏ん張り中は暗い
export function rightLook(st, side = 'east') {
  const l = sceneLook(st, side);
  return l.mode === 'tap' || l.mode === 'stay' ? off('right') : l;
}

// 攻めの場面か（v42 本人「攻めの場面に『こらえ』の字を出さない」）：連打（tap）・立ち合いの〇（go）・決め技の〇（ring）。
// 呼び方：攻め＝連打（左）と一押し（右の〇）／守り＝長押し（右・バー）。この間は「こらえ」を含む吹き出し（相手の攻めの返し方）を閉じる。
// バーの成功の字は「守り成功！」（こらえを使わない）：成功すると相手の攻めはすぐ終わって連打（攻め）になるので、その字は攻めの場面に少し残る
const ATTACK = { tap: true, go: true, ring: true };
export const attackScene = (st, side = 'east') => !!ATTACK[sceneLook(st, side).mode];

// 下の案内の1行の鍵（終わったら null）
export function hintKey(st, side = 'east') {
  const l = sceneLook(st, side);
  return l.mode === 'done' ? null : `kami.hint.${HINT[l.mode]}`;
}

// 練習の一番（1体目）のことねの吹き出しの鍵：立ち合い＝ready・押し合い＝push・〇＝finish・バー＝bar・はなして もう一度＝again・踏ん張り中＝stay・倒れた＝down・終わり＝null
export function coachKey(st, side = 'east') {
  const l = sceneLook(st, side);
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

// 〇の判定の見せ方（st.lastRing の judge：2＝◎→〇の中に「合」（hit）・1＝○・0＝×）：主人公の〇が終わってから IPPON.gapMs の間だけ。無い＝null
// 押した時に相手が届かなかった（reach false・10/15）＝「届かない…」（far true・judge 0）
// resultShown＝取組の勝ち負けの札（勝ち・負け）を出した後：何も出さない（v43 本人「『勝ち』の背後に『合』の字が重なる」。
//   終わると計算の時刻 st.t が止まるので、決め技の◎で勝った時の「合」が消えずに勝ち負けの札と重なっていた）
export function ringFlash(st, side = 'east', resultShown = false) {
  if (resultShown) return null;
  const r = st.lastRing;
  if (!r || r.side !== side || st.t - r.at > IPPON.gapMs / 1000) return null;
  if (r.reach === false) return { judge: 0, key: 'kami.ring.far', far: true };
  if (r.judge === 2) return { judge: 2, key: 'kami.ring.hit', hit: true }; // ◎＝〇の中に大きく「合」（v42 本人）
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

// 大ボス（20体目）の取組の守りの合図（v42 第2段・本人「海賊が勝てない」）：相手の攻めと必殺技の予告のたびに、右のボタンを脈打たせて光らせ、上に大きく「守り！長押し」。
// 予告が終わる（バーの結果が出る・攻めが次へ）か、長押しが始まった（バーをため始めた）ら消す。機械の強さは変えない（画面だけ）
export function bossAlert(st, isBoss, side = 'east') {
  if (!isBoss || !st || st.phase !== 'push') return false;
  const tac = st.tactic, b = st.bar;
  if (!tac || tac.side === side || tac.phase !== 'warn') return false;
  if (!b || b.side !== side || b.result !== null || b.heldFrom !== null) return false;
  if (st.f[side].held) return false; // 押したまま数えられていない指（「まだ」・予告の前から押していた）＝ボタンは「はなして もう一度」。離せの案内を隠さない（v42 最終点検 M2）
  return !st.f[side].down;
}

// 相手の目の帯（予告の始まりに出て画面の時計を止める）を出した予告のバー＝eyeBar の「まだ」の間（予告から BAR.react 秒より前）に右を押した：
// 押したまま待って、その時にため始める（true）。帯が開いていても、時間切れ・たたいて閉じた後でも同じ（v42 最終点検 M1：時計は帯の間 予告の始まりで止まるので、
// 閉じた直後の約0.3秒の押しが「まだ」で数えられず「はなして もう一度」になっていた）。2本目の指も同じ道を通す（先に数えて「はなして」にしない）
export function eyeDeferDue(st, eyeBar, side = 'east') {
  const b = st && st.bar;
  if (!b || b !== eyeBar || b.side !== side || b.result !== null || b.heldFrom !== null) return false;
  if (st.phase !== 'push' || st.f[side].down) return false;
  return st.t < b.from + BAR.react - 1e-6; // もう ため始められる＝ふつうの押し
}

// はじめて見る攻めの返し方の吹き出し（KamiScene.drawTip）の1コマ：tip＝{ until, shown }・t＝取組の時刻・done＝取組が終わった・attack＝攻めの場面・cutin＝帯が出ている。
// 返り値 { close（閉じる）, visible（見せる）, note（今、見たと記録する） }。記録は吹き出しが本当に見えた最初のコマだけ（v42 第2段 D2：
// 主人公の決め技の〇が出ている間に初めての攻めが来ると、見えないまま閉じて「見た」ことになり、二度と出なかった）
export function tipStep(tip, { t, done, attack, cutin }) {
  if (t >= tip.until || done || attack) return { close: true, visible: false, note: false };
  const visible = !cutin;
  return { close: false, visible, note: visible && !tip.shown };
}
