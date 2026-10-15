// src/core/gyoji.js — 行司の掛け声を「いつ鳴らすか」だけを決める（音の再生と日本語の字は持たない・画面 KamiScene が鳴らす）
// 立ち合い：「はっけよーい、のこった！」の声の「のこった」が合図（〇が出る時）に重なるよう、合図より LEAD 秒先に鳴らし始める（取組の始まりより前には戻れない＝合図が早い時は少し遅れて重なる）
// 押し合い：「のこった、のこった！」を約 GAP 秒ごと。予告・バー・〇が出ている間と、誰かが倒れている間、立ち合いの声の直後は黙る。終わったら止める
// v43 本人「取組の『のこった』の直前に少し間があるのが気になる」：間は2つあった。①はっけよい.mp3 の中の「よーい」と「のこった」の間の無音 0.26秒と
//   「の」の頭の長い鼻の音 0.14秒（→ tools/make_gyoji_voice.py が 0.03秒＋0.08秒に詰める）②合図（〇が出る時）が lead より早い取組（合図 1.0〜1.8秒・lead 1.58）では、
//   声は取組の 0 秒からしか始められず「のこった」が合図より最大 0.58秒遅れた（→ tachiaiPreRoll：画面は取組の時計を動かす前に、その分だけ声を先に鳴らして待つ。
//   取組の計算と合図の時刻は変えない＝強さは同じ）
export const GYOJI = {
  tachiaiLen: 2.51, // はっけよい.mp3 の長さ（秒）
  lead: 1.3, // はっけよい.mp3 の中で「のこった」が始まる所（秒・make_gyoji_voice.py mp3 が出す lead）
  gap: 3.5, // 「のこった」を鳴らしてから次までの最短（秒）
  afterTachiai: 1, // 立ち合いの声の「のこった」からこの秒数は、押し合いの声を鳴らさない
  nokottaLen: 1.87, // のこった.mp3 の長さ（秒・頭の無音は 0.01秒）
};

// 立ち合いの声を鳴らし始める取組の時刻（秒）：合図より lead 先・0 より前にはならない
export const tachiaiVoiceAt = (signalAt, lead = GYOJI.lead) => Math.max(0, signalAt - lead);
// 取組の時計（st.t）を動かし始める前に待つ実の秒（声だけ先に鳴らす）：合図が lead より早い取組で、声の「のこった」がちょうど合図に重なるように
export const tachiaiPreRoll = (signalAt, lead = GYOJI.lead) => Math.max(0, lead - signalAt);

// 押し合いの「のこった」を今鳴らすか
// st＝取組の状態（kami.js の newBout）・lastAt＝前の声を鳴らし始めた取組の時刻（無ければ −Infinity）・landAt＝立ち合いの声の「のこった」が重なる時刻（無ければ −Infinity）
export function nokottaDue(st, lastAt = -Infinity, landAt = -Infinity) {
  if (!st || st.phase !== 'push') return false; // 押し合いの間だけ（ready＝立ち合い前・done＝終わりは黙る）
  const e = st.f.east, w = st.f.west;
  if (e.down || w.down || e.fell || w.fell) return false; // 二人とも立っている時だけ
  if (e.ring || w.ring || st.bar || st.tactic) return false; // 〇・守りのバー・相手の攻め（予告から後始末まで）が出ている間は黙る
  if (st.t - lastAt < GYOJI.gap) return false;
  if (st.t - landAt < GYOJI.afterTachiai) return false;
  return true;
}

// 鳴っている声を止めて片付ける（♪を消した時・取組の終わり）。声の物＝stop と destroy を持つ物（片付けられない物があっても続ける）。空の並びを返す
export function hushVoices(sounds) {
  (Array.isArray(sounds) ? sounds : []).forEach((s) => {
    try { s.stop(); } catch (e) { void e; } // 止められなくても続ける
    try { s.destroy(); } catch (e) { void e; } // 片付けられなくても続ける
  });
  return [];
}
