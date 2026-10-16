// 相手の型ごとの攻め（設計書 2026-10-14-sumo-two-buttons-and-foe-tactics-design.md §3）
// 攻めは敵（西）だけが持つ。どれも 予告 warn → 実行 act → 後始末 after → 間 gap → 次の予告。一度に1つ。
// 数字は Task 3 で強さを合わせる時に動かすので、全部ここに並べる。画面の字は i18n（tactic.<id>）。
import { makeRng } from './rng.js?v=49';

export const TACTIC_IDS = ['fumbari', 'hataki', 'tsuppari', 'kumi'];
export const TACTIC_START = 2.5;   // 押し合いが始まってから、最初の予告まで（秒）
export const TACTIC_MIN_GAP = 3;    // 攻めの終わりから次の予告までの最短（秒）
export const TACTIC_LAST = 49;      // この番号（50体目＝大ボス）は4つ全部・攻めの間と強さ・緑の帯の狭め方は 0〜TACTIC_LAST の直線（50体版）
// 体の番号で動く3つ：[1体目, 50体目（TACTIC_LAST）]（間は直線）
// 間 gap は 10/14 Task 3 の強さ合わせで [6, 3]→[4.5, 3]（10体目のはたきが1取組に2回ほど来る＝返さない人は10体目で ふつうの人より15ポイント以上負ける）
// 予告の長さは守りのバーから決める（barWarn）＝ここには持たない（ボタン1つ Task 2 直し・Ruling 8）
// Task 2b 直し：gap の20体目 3→4→4.5（直し2・どの体も同じ間）。必殺技が攻めの順番に入り、攻めの数が増えた分
// 50体版（2026-10-16 Task 7）：power の終わり 1→1.6（大ボスの初挑戦が 54〜62%＝60% の線の上下。1.3 は 53〜56%・1.6 で 45〜51%・2.0 は大ボスが戻った 51〜55%）。
//   後ろの敵ほど攻めが効く＝返す人と返さない人の差も広がる（25体目 counter 0 17%／0.7 56%）
//   v47（解禁の順を入れ替え・最初の決め技＝風車投げ）：power の始め 0.6→0.65。小兵（3〜5体目）は投げに弱い＝早く負けて稽古で風車投げを覚えた「連打の人」（返さない）が、
//   4体目（はたき）で ふつうの人より勝った（98% 対 95%・tests/strength の返しの目標）。0.65 で返さない人がはたきで負けやすい形に戻る（試しの一生60：0.68・0.7 も通る・0.8 はまた外れた・0.7 は「組みを振りほどけば運ばれは30px以下」の試験を 31.5px で外した。はたきの back 36・40 では直らない）
//   v47 の続き：40秒超を 5% 以下へ戻すため連打の技の回数の終わり 8→7（kimeinput.js）にした所、大ボスの初挑戦が 試験の一生60 で 0.73（目標 0.3〜0.6）＝攻めの間の終わり 4.5→4.0（後ろの敵ほど攻めが少し多い）で全部の目標に戻した。
//   試した物（kami_tune --check）：強さの終わり 1.6→1.8／1.9／2.0・大ボスの必殺技の倍率 0.6→0.7・大ボスの必殺技の間 3.5→3.0・大ボスの拍の正確さ・長身の重さ 0.955／0.98／1.0・重量の重さ 1.1・25〜49体目の速さ 0.27→0.35 はどれも大ボスか40秒超か反応の遅い人で外れた
//   v49（新しい記録は風車投げを覚えて始まる＝1体目から決め技で早く勝つ）：攻めの間 [4.5, 4.0]→[3.8, 3.8]（どの体も同じ間）。
//   [4.5, 4.0] のままでは 9体目（農家）0.68 回・13体目（起き上がり）0.69 回＝必殺技の予告が 1番 0.7 回に届かず、4体目（はたき）で返さない人が ふつうの人より勝った（試験の一生60：0.967 対 0.933）。
//   間を詰めると攻め（と順番の必殺技）が早く来る＝予告が増え、はたきを返す得も戻る。試した物（kami_tune --check）：[4.0, 3.6] は34体目の壁（0.233）と天井の差（35体目 5.1点）・
//   [4.0, 3.7] と [4.0, 4.0] は大ボスの初挑戦（試験の一生60 で 0.62）・[4.2, 4.0]・[3.8, 3.6] は4体目の返し・強さの始め 0.65→0.7 は予告が増えない（下見）
export const TACTIC_CURVE = { gap: [3.8, 3.8], power: [0.65, 1.6] };

// 攻めごと：act＝実行の秒・after＝後始末の秒・ほか＝強さの元の数（予告の秒は barWarn）
export const TACTICS = {
  // 踏ん張り：act の間は重さ×mass。くっついて（間 ≤ reach）たたくと跳ね返されてよろける。解けた後 after 秒は重さ×afterMass（act の間に跳ね返されなかった時だけ＝待った褒美）
  // mass は brief の 2.5 だと act の間の連打で 24〜77px 押せ、たたき続ける方が得だった（設計書「押されても動かない」）ので 50。afterMass は 0.6 だと種によって待つ得が 2% しかなかったので 0.5
  // 10/14 Task 3（機械に人の反応 0.3 秒）：afterMass 0.5→0.25・recoilVx 150→700。待つ得・連打の損が小さく、一生の通しでは稽古を多く積んだ返さない人の方が
  // 後ろの重量（13・18体目）に勝ちやすかった（設計書 §4：踏ん張りの敵では どれも ふつうの人が勝ちやすい）
  // 10/14 最終点検：跳ね返しの速さ recoilVx は ×強さ（1体目 0.6 倍＝420・20体目 700）。1体目で連打する人が倒れすぎていた
  // ボタン1つ Task 2 直し1：recoilVx 700→1000（予告の間に跳ねられなくなった分、失敗した後に連打する人と返さない人が、返す人と同じだけ勝っていた＝13体目）
  fumbari: { act: 2, after: 0.8, mass: 50, afterMass: 0.25, reach: 100, recoilVx: 1000, recoilVa: 0.03 },
  // はたき：守りのバーに失敗すると、act の始めに（間 ≤ reach なら）前へはたき落とされ、足もとは slide×強さ÷重さ の速さで自分の後ろへ滑る・敵は back px 下がる（届かなければ はたき損ね）
  // 10/14 ボタン1つ Task 2：拍に合わせて返す形（beat）は無くした（守りは長押しバー1つ）。act は一瞬（はたいたら すぐ after）
  // 滑るのは slideFrom 番（8体目・Task 2b 直し2 で 10体目→8体目）から＝はたかれると、箱の端の近くまで滑る（本物のはたき込み）。それまでは倒れて起き上がる
  // slide は Task 2 の強さ合わせで 4000→2500（守りがバー1つになり、失敗のたびに はたかれる。4000 では10体目からの はたきの敵がどれも壁＝初挑戦 1〜2割だった）
  hataki: { act: 0, after: 0.3, reach: 120, back: 30, fallA: -1.5, slide: 2500, slideFrom: 18 }, // 直し2（Task 2b）：slideFrom 9→7（8体目で返さない人が ふつうの人より勝ちやすかった）／50体版：7→18（20体版の8体目と同じ割合の19体目・Task 7 で動かしてよい）
  // 突っ張り：予告の終わりに（守りのバーに失敗していれば）、間 ≤ reach なら一突き（遠ければ突き損ね）＝速さ push×強さ÷重さ・浮き lift・後ろへ反る va
  // push は 10/14 Task 3 で 520→1100（520 では押し戻されても困らず、予告で こらえて たたけない方が損だった）
  tsuppari: { act: 0.3, after: 0.4, reach: 150, push: 1100, lift: 200, va: 0.05 },
  // 組んで寄る：間 ≤ start で予告。act の間は間 keep のまま、主人公を背中側へ carry×強さ px/秒 運ぶ（act の始めに間 > miss なら組み損ね）
  // 直近 window 秒に taps 回たたくと振りほどける・敵は stun 秒すき。10/14 Task 3：taps 5→6（ふつうの1秒4回では解けない＝速い連打が要る）・stun 0.4→0.8（振りほどいた得）
  kumi: { act: 1.5, after: 0.4, start: 100, keep: 90, miss: 110, carry: 90, taps: 6, window: 1.2, stun: 0.8 },
};

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export const isTactic = (id) => typeof id === 'string' && has(TACTICS, id);

// 型→攻めの並び。バランスは種で4つを並べ替えて先頭2つ・50体目（大ボス・番号 TACTIC_LAST）は4つ全部
const BY_TYPE = { heavy: 'fumbari', small: 'hataki', tall: 'tsuppari', yotsu: 'kumi' };
export function tacticsFor(type, index, seed) {
  if (index >= TACTIC_LAST) return TACTIC_IDS.slice();
  if (has(BY_TYPE, type)) return [BY_TYPE[type]];
  if (type !== 'balance') return [];
  const rng = makeRng(seed);
  const a = TACTIC_IDS.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a.slice(0, 2);
}

// 体の番号 → 次の攻めまでの間の秒・強さ
export function tacticTiming(index) {
  const k = clamp01((Number(index) || 0) / TACTIC_LAST);
  return {
    gap: Math.max(TACTIC_MIN_GAP, lerp(TACTIC_CURVE.gap[0], TACTIC_CURVE.gap[1], k)),
    power: lerp(TACTIC_CURVE.power[0], TACTIC_CURVE.power[1], k),
  };
}

// ---- 守りの長押しバー（10/14 ボタン1つ・設計書 2026-10-14-sumo-one-button-ring-bar-design.md §4） ----
// 相手の攻めの予告が出ると、主人公の左端にバーが出る。押している間 held/fillMs でたまり、緑の帯（center ± half）で離せば こらえ成功（攻めは打ち消し）。
// 帯の外で離す・満タン（1）まで押す・押さないまま予告が終わる＝失敗（攻めがそのまま来る）。稽古の長押し（drills.js の NAGAOSHI）と同じ考え
// fillMs＝型ごとのたまる秒（ms・重量＝ゆっくり〜小兵＝速い）。後の体ほど ×fast まで速く（直線）。half＝帯の半分の幅 [1体目, 50体目]（直線・0〜TACTIC_LAST）
// react＝見てから押し始めるまで（人の反応）・lead＝押し始めまでの余裕。予告は「緑の真ん中に届く秒＋react＋lead」より短くしない（Review Focus #2）
// stun＝こらえ成功で相手が すきになる秒・linger＝結果（成功・失敗）を画面に残す秒
// tapMax＝これより短い押し（連打の一押し）を帯の下で離しても「まだ」（失敗にしない・Ruling 7）。予告から react 秒までの押し始めも「まだ」
// getUp＝起き上がってから次の予告まで待つ秒（指を離すまでも待つ・Ruling 6）
// 強さ合わせ（Task 2・kami_tune）：half [0.12, 0.07]→[0.14, 0.12]・stun 0.5→1.0。細い帯と短い すきでは、10体目からの はたきの敵が壁になり
// （ふつうの人＝7割の攻めで押し、成功 約6割）、こらえ成功の得も小さかった（返さない人との差が出ない）
// Task 2b 直し（20体版の時）：half の大ボス 0.12→0.13（大ボスの初挑戦を 3割の上へ）
// late＝押し始めた押しが帯の上の端に届いてから、予告が終わるまでの最短の秒（最終点検の直し 2：反応の遅い人。予告は押し始めに合わせて延びるだけ）
export const BAR = { fillMs: { heavy: 1700, yotsu: 1500, tall: 1400, small: 1200 }, fast: 0.85, half: [0.14, 0.13], center: 0.75, react: 0.3, lead: 0.5, stun: 1.0, linger: 0.6, tapMax: 0.2, getUp: 0.8, late: 0.15 };
// 攻め → そのバーの型（型ごとの攻めの逆。バランスと大ボスも攻めの型の数を使う）
export const TACTIC_TYPE = { fumbari: 'heavy', hataki: 'small', tsuppari: 'tall', kumi: 'yotsu' };

// ---- 敵の必殺技（10/14 ボタン1つ Task 2b・設計書 §4.5）：攻めと同じ 予告 warn → act → after の形で、id＝FOE_KIME_ID（st.tactic.kime＝必殺技の id） ----
// 攻めの順番の1つ（攻め・必殺技・攻め…・Ruling 10）。順番が来て、相手が届く（KIMETE_REACH＋reach px・うっちゃりは自分の背中側の端から edgeU px の内）なら予告＋主人公のバー。
// 緑で離せば打ち消し（相手は BAR.stun 秒すき）・失敗＝決め技がそのまま決まる（予告の終わりに KIMETE_REACH＋slack px より離れていれば空振り）
// act＝0（予告の終わりに一発）・after＝後始末の秒・next＝必殺技の終わりから次の攻めまでの秒（攻めの間 gap は使わない）
export const FOE_KIME_ID = 'foeKime';
// 強さ合わせ（Task 2b 直し・kami_tune）：next 1.5→1.2（4体目で返さない人が勝ちやすかった）・edgeU 225→205（大ボスのうっちゃりが鍛えた主人公に多すぎた）
// wait＝順番が来て届かない時、届くのを待つ最長の秒（Ruling 12）・downMin＝これより弱い必殺技は倒さない（押すだけ・Ruling 11）
// v42（決め技の勧めを相手ごとの種にした＝17体目の農家に早く勝てて、必殺技の予告が 1番 0.64 回に減った）：edgeU 205→260（農家と大ボスのうっちゃりが届く所を広げた・17体目 0.86 回）
export const FOE_KIME = { act: 0, after: 0.4, reach: 30, slack: 40, edgeU: 260, next: 1.2, wait: 1.0, downMin: 0.5 };
// 必殺技の系統 → そのバーの型（§4.5：重量＝突き・小兵＝はたき・長身＝投げ・四つ＝寄り。うっちゃりは四つの数）
export const KIME_TYPE = { tsuki: 'heavy', hiki: 'small', nage: 'tall', yori: 'yotsu', utchari: 'yotsu' };

// 緑の帯（合格の幅）を、進むほど少しずつ狭める倍率（v43 本人「緑の合格の幅は変更無しで、レベルが上がったら徐々に狭めてゆきます」）：
// 1体目（番号 0）＝1.0（今の幅のまま）→ 50体目（大ボス・番号 TACTIC_LAST＝49）＝0.75（今の幅の 3/4）・間は直線。範囲の外は端へ寄せる・数でない番号は 1体目
// 掛けるのは帯の半分の幅（真ん中 center はそのまま＝両端から詰める）。取組（barSpec）と長押し稽古（次の相手の番号）が使う・遊び方の見本は今の幅のまま
export const BAR_GREEN = { first: 1, last: 0.75 };
export function barGreenScale(index) {
  const i = Number(index);
  const k = Number.isFinite(i) ? clamp01(i / TACTIC_LAST) : 0;
  return lerp(BAR_GREEN.first, BAR_GREEN.last, k);
}

// 型と体の番号 → バーの数 { fillMs, center, half }（知らない型は四つの数＝真ん中）。後の新しい予告（敵の必殺技など）も型を渡せば同じバーを使える
// half＝今までの幅（BAR.half の直線）× barGreenScale（v43）
export function barSpec(type, index) {
  const k = clamp01((Number(index) || 0) / TACTIC_LAST);
  const base = has(BAR.fillMs, type) ? BAR.fillMs[type] : BAR.fillMs.yotsu;
  return { fillMs: base * lerp(1, BAR.fast, k), center: BAR.center, half: lerp(BAR.half[0], BAR.half[1], k) * barGreenScale(index) };
}
// 押し始めてから緑の真ん中に届くまでの秒
export const barReach = (spec) => spec.fillMs * spec.center / 1000;
// そのバーに要る予告の最短（秒）
export const barWarn = (spec) => barReach(spec) + BAR.react + BAR.lead;
