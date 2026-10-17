// src/ui/sfx.js — 効果音（10/11 本人「効果音付きで」）。音のファイルは使わず、Web Audio でその場で作る
// どの音も 0.8 秒以内・重なった時も含めて音量の山は 0.35 以下。鳴らせない端末（AudioContext が無い・作ると例外）では何もしない
import { isMuted } from './music.js?v=55'; // 右下の ♪ 札で消した時は、効果音も鳴らさない
import { WHINE, whineFreq } from '../core/whine.js?v=55';

let ctx = null;
let broken = false; // 作ろうとして例外が出た端末では、2度目からは試さない
let level = 1; // 今鳴らす音の音量の倍率（声が付く稽古では下げる・playTraining が音ごとに決める）
let away = false; // 画面が裏へ回っている間（v44）：音を起こさない
let pendingSuspend = null; // suspend() がまだ終わっていない間の約束（すぐ戻った時は終わるのを待ってから起こす）

function audio() {
  if (ctx || broken) return ctx;
  const w = typeof window !== 'undefined' ? window : null;
  const AC = w ? w.AudioContext || w.webkitAudioContext : null;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    broken = true;
    ctx = null;
  }
  return ctx;
}

// 音を起こす（v44）：suspended だけでなく iPhone の 'interrupted' からも。裏へ回っている間・閉じた音は起こさない。古い端末は Promise を返さない・失敗しても投げない
function wake(c) {
  // suspend がまだ終わっていなければ、終わるのを待ってから起こす（先に起こすと running に見えて空振りし、後から止まったままになる）
  if (pendingSuspend) {
    pendingSuspend.then(() => { if (!away && !isMuted()) wake(c); }).catch(() => {});
    return;
  }
  if (!c || away || c.state === 'running' || c.state === 'closed' || !c.resume) return;
  try {
    const p = c.resume();
    if (p && p.catch) p.catch(() => {});
  } catch {
    // 起こせなくても遊びは続ける
  }
}

// 画面が裏へ回った（true）・戻った（false）時に呼ぶ（v44・main.js の visibilitychange）：裏の間は止める（suspend）・戻ったら消音でなければ起こす。まだ鳴らしていない時は何もしない
export function sfxHidden(hidden) {
  away = !!hidden;
  const c = ctx;
  if (!c) return;
  if (away) {
    whineStop();
    if (c.state === 'running' && c.suspend) {
      try {
        const p = c.suspend();
        if (p && p.then) {
          const mine = p.then(() => {}, () => {}).then(() => { if (pendingSuspend === mine) pendingSuspend = null; });
          pendingSuspend = mine;
        }
      } catch { /* 止められなくても続ける */ }
    }
    return;
  }
  if (isMuted()) return;
  wake(c);
}

// 画面に触れた時に呼ぶ（v44・main.js）：止まっている・中断された効果音の音を起こす（触れた＝画面は見えている）
export function sfxWake() {
  away = false;
  if (ctx && !isMuted()) wake(ctx);
}

// 山の形の音量：attack 秒で peak まで上げ、dur 秒の終わりへ向けて消える
function envelope(c, t0, dur, peak, attack = 0.005) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak * level, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(c.destination);
  return g;
}

// 音程のある短い音（freq から freqEnd へ滑らせる）
function tone(c, t0, { freq, freqEnd = freq, dur, peak, type = 'sine', attack }) {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  osc.connect(envelope(c, t0, dur, peak, attack));
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// ざっという音（白い雑音を filter に通す・中心の周波数を f から fEnd へ動かせる）
let noiseBuf = null;
function noise(c, t0, { dur, peak, filter = 'bandpass', f, fEnd = f, q = 1, attack }) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.8), c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const bq = c.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f, t0);
  if (fEnd !== f) bq.frequency.exponentialRampToValueAtTime(fEnd, t0 + dur);
  src.connect(bq);
  bq.connect(envelope(c, t0, dur, peak, attack));
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// 箱から落ちる「ひゅー」（下がる風切り）と、木の底に当たる「ことん」（drop は2つを続けて鳴らす）
const hyu = (c, t) => noise(c, t, { dur: 0.45, peak: 0.18, f: 1800, fEnd: 300, q: 1.2, attack: 0.12 });
const koton = (c, t) => {
  tone(c, t, { freq: 260, freqEnd: 140, dur: 0.1, peak: 0.22, type: 'triangle', attack: 0.002 });
  noise(c, t, { dur: 0.05, peak: 0.1, f: 700, q: 2, attack: 0.001 });
};

const SOUNDS = {
  // 四股：足を土俵に踏み下ろす「どん」1つ（低い正弦波・すぐ消える）
  shiko: (c, t) => tone(c, t, { freq: 90, freqEnd: 55, dur: 0.35, peak: 0.35 }),
  // 鉄砲：柱を手のひらで突く「かん、かん」（短い雑音を木の高さに絞って2回）
  teppo: (c, t) => {
    noise(c, t, { dur: 0.06, peak: 0.3, f: 1800, q: 4 });
    noise(c, t + 0.12, { dur: 0.06, peak: 0.3, f: 1600, q: 4 });
  },
  // ちゃんこ：鍋が煮える「ぽこぽこ」（上がる短い音を5つ・間はわざとばらつかせる）
  chanko: (c, t) => {
    [[0, 300], [0.09, 340], [0.22, 280], [0.3, 360], [0.43, 320]].forEach(([dt, f]) => {
      tone(c, t + dt, { freq: f, freqEnd: f * 2, dur: 0.07, peak: 0.15 });
    });
  },
  // 技の稽古：体をさばく「ひゅっ」（帯を通した雑音を低い所から高い所へ）
  waza: (c, t) => noise(c, t, { dur: 0.45, peak: 0.25, f: 400, fEnd: 3000, q: 1.5, attack: 0.15 }),
  // ぶつかり稽古：体と体が当たる重い「どすっ」（低い正弦波＋短い当たりの雑音・足して 0.35）
  butsukari: (c, t) => {
    tone(c, t, { freq: 75, freqEnd: 45, dur: 0.4, peak: 0.25 });
    noise(c, t, { dur: 0.08, peak: 0.1, filter: 'lowpass', f: 900 });
  },
  // 申し合い：2人が代わる代わる当たる「どん・どん」（高さを変えて2つ）
  moushiai: (c, t) => {
    tone(c, t, { freq: 85, freqEnd: 60, dur: 0.25, peak: 0.3 });
    tone(c, t + 0.22, { freq: 120, freqEnd: 80, dur: 0.25, peak: 0.3 });
  },
  // 休み：眠りに入る、やさしく下がる3つの鈴（ソ・ミ・ド）
  rest: (c, t) => {
    [[0, 784], [0.22, 659], [0.44, 523]].forEach(([dt, f]) => tone(c, t + dt, { freq: f, dur: 0.35, peak: 0.12, attack: 0.02 }));
  },
};

// 取組の画面の音（10/11 見本 bout_video.py の音を Web Audio で作り直した）
const BOUT = {
  // 当たり・倒れて落ちる「どん」（低い正弦波が下がる＋短い当たりの雑音・足して 0.35）
  thud: (c, t) => {
    tone(c, t, { freq: 130, freqEnd: 50, dur: 0.35, peak: 0.25 });
    noise(c, t, { dur: 0.06, peak: 0.1, filter: 'lowpass', f: 800 });
  },
  // 突っ張りの平手「ぱん」（高めの短い雑音）
  slap: (c, t) => noise(c, t, { dur: 0.12, peak: 0.3, filter: 'highpass', f: 1200, q: 0.7, attack: 0.002 }),
  // 俵まで押し込む すり足「ずざざ」（低く絞った雑音が少しずつ消える）
  scrape: (c, t) => noise(c, t, { dur: 0.75, peak: 0.2, filter: 'lowpass', f: 1400, fEnd: 500, q: 0.8, attack: 0.08 }),
  // 決め技が出た「シャキーン＋拍子木」（設計書 9.7 の緑の段・足して 0.35 を超えない。2つのボタンで kumi から kime へ名前を替えた＝kumi は組みつきの音）
  kime: (c, t) => {
    tone(c, t, { freq: 1800, freqEnd: 3200, dur: 0.25, peak: 0.12 });
    noise(c, t, { dur: 0.3, peak: 0.08, filter: 'highpass', f: 4000, q: 0.7, attack: 0.002 });
    noise(c, t + 0.28, { dur: 0.05, peak: 0.15, filter: 'bandpass', f: 1800, q: 4, attack: 0.001 });
  },
  // 決め技のゲージの段（20体版 Task 5）：段が上がるほど重なりと長さが増える。どれも足して 0.35 以下
  // 1＝青：短い風切り「ひゅっ」
  gauge1: (c, t) => noise(c, t, { dur: 0.18, peak: 0.22, f: 600, fEnd: 2600, q: 1.5, attack: 0.04 }),
  // 2＝赤：シャキーン＋拍子木
  gauge2: (c, t) => {
    tone(c, t, { freq: 1800, freqEnd: 3200, dur: 0.25, peak: 0.12 });
    noise(c, t, { dur: 0.3, peak: 0.08, filter: 'highpass', f: 4000, q: 0.7, attack: 0.002 });
    noise(c, t + 0.28, { dur: 0.05, peak: 0.15, filter: 'bandpass', f: 1800, q: 4, attack: 0.001 });
  },
  // 3＝金：シャキーン2重＋太鼓「どん」
  gauge3: (c, t) => {
    tone(c, t, { freq: 1800, freqEnd: 3200, dur: 0.25, peak: 0.08 });
    tone(c, t + 0.1, { freq: 2200, freqEnd: 3800, dur: 0.25, peak: 0.08 });
    noise(c, t, { dur: 0.3, peak: 0.05, filter: 'highpass', f: 4000, q: 0.7, attack: 0.002 });
    tone(c, t + 0.25, { freq: 110, freqEnd: 60, dur: 0.2, peak: 0.2 });
  },
  // 4＝虹：太鼓の連打（5つ）＋金属の「キィーン」。0.3秒から先は静かにして、続けて鳴らす確定音（gaugeMax）の場所を空ける
  gauge4: (c, t) => {
    [0, 0.06, 0.12, 0.18, 0.24].forEach((dt, i) => tone(c, t + dt, { freq: 120 + i * 6, freqEnd: 60, dur: 0.1, peak: 0.12 }));
    tone(c, t, { freq: 3000, freqEnd: 3150, dur: 0.5, peak: 0.05, type: 'triangle', attack: 0.01 });
  },
  // 大きなボタンを押した「カチッ」（立体のボタン・20体版 Task 5b）：短い雑音のクリック＋小さな高い音。足して 0.15 以下・0.05秒で消える（同じ瞬間に鳴る dosu / hopBeat と足して 0.4 / 0.35 以下：試験が数える）
  press: (c, t) => {
    noise(c, t, { dur: 0.035, peak: 0.1, f: 2600, q: 3, attack: 0.001 });
    tone(c, t, { freq: 1500, freqEnd: 700, dur: 0.04, peak: 0.05, attack: 0.001 });
  },
  // ---- 20体版 Task 6b（10/13 本人「効果音もいろいろ付けてください」）。どれも足して 0.35 以下・0.8秒以内（試験が数える）----
  // 立ち合いのぶつかり：低い「ドン」＋紙のはじける音
  tachiai: (c, t) => {
    tone(c, t, { freq: 100, freqEnd: 45, dur: 0.4, peak: 0.22 });
    noise(c, t, { dur: 0.1, peak: 0.08, filter: 'highpass', f: 2500, q: 0.7, attack: 0.002 });
    noise(c, t, { dur: 0.06, peak: 0.04, filter: 'bandpass', f: 1500, q: 2, attack: 0.002 });
  },
  // 跳ねるたび：軽い「トン」／拍にぴったりの時は高めの「カン」
  hop: (c, t) => tone(c, t, { freq: 520, freqEnd: 330, dur: 0.07, peak: 0.12 }),
  hopBeat: (c, t) => {
    tone(c, t, { freq: 1320, freqEnd: 1000, dur: 0.1, peak: 0.12, type: 'triangle', attack: 0.002 });
    tone(c, t, { freq: 1980, freqEnd: 1980, dur: 0.06, peak: 0.04, attack: 0.002 });
  },
  // 着地：小さな「ぱた」
  land: (c, t) => {
    noise(c, t, { dur: 0.05, peak: 0.14, f: 900, q: 2, attack: 0.002 });
    tone(c, t, { freq: 220, freqEnd: 140, dur: 0.05, peak: 0.06, attack: 0.002 });
  },
  // ぶつかり合い：「ばしっ」
  clash: (c, t) => {
    noise(c, t, { dur: 0.1, peak: 0.22, filter: 'highpass', f: 1500, q: 0.7, attack: 0.001 });
    tone(c, t, { freq: 160, freqEnd: 90, dur: 0.12, peak: 0.1, attack: 0.002 });
  },
  // 倒れる：紙が倒れる「ぱたん」（こもった雑音が下へ＋軽い低音）
  topple: (c, t) => {
    noise(c, t, { dur: 0.22, peak: 0.16, filter: 'lowpass', f: 1800, fEnd: 400, q: 0.8, attack: 0.01 });
    tone(c, t + 0.05, { freq: 180, freqEnd: 80, dur: 0.2, peak: 0.1, attack: 0.004 });
  },
  // 箱から落ちる：「ひゅー」（下がる風切り）の後に「ことん」（木の底に当たる）
  drop: (c, t) => {
    hyu(c, t);
    koton(c, t + 0.46);
  },
  // 手ごたえ（10/15 設計書 §12）：取組では「ひゅー」と「ことん」を分けて鳴らす（スローで舞って着地した時に「ことん」）
  hyu: (c, t) => hyu(c, t),
  koton: (c, t) => koton(c, t),
  // ◎の一押し・必殺技が決まった瞬間の強い「バシッ！」（乾いた平手の雑音＋低い当たり・足して 0.35 以下）
  bashi: (c, t) => {
    noise(c, t, { dur: 0.12, peak: 0.2, filter: 'highpass', f: 1800, q: 0.7, attack: 0.001 });
    tone(c, t, { freq: 140, freqEnd: 60, dur: 0.2, peak: 0.13, attack: 0.002 });
  },
  // 座布団が舞う時の大きなどよめき：太鼓「ドドン」と、win より大きく長くふくらむ歓声（2つの高さの雑音）。足して 0.35 以下・0.8秒以内
  roar: (c, t) => {
    tone(c, t, { freq: 110, freqEnd: 60, dur: 0.22, peak: 0.12 });
    tone(c, t + 0.26, { freq: 100, freqEnd: 55, dur: 0.3, peak: 0.12 });
    noise(c, t + 0.02, { dur: 0.76, peak: 0.14, f: 1400, q: 0.5, attack: 0.35 });
    noise(c, t + 0.06, { dur: 0.7, peak: 0.08, f: 600, q: 0.7, attack: 0.3 });
  },
  // 起き上がる：上がっていく「しゅっ」
  rise: (c, t) => noise(c, t, { dur: 0.22, peak: 0.2, f: 500, fEnd: 3500, q: 1.5, attack: 0.06 }),
  // 勝ち：太鼓「ドドン」＋歓声のような雑音のふくらみ
  win: (c, t) => {
    tone(c, t, { freq: 110, freqEnd: 60, dur: 0.22, peak: 0.2 });
    tone(c, t + 0.26, { freq: 100, freqEnd: 55, dur: 0.3, peak: 0.2 });
    noise(c, t + 0.05, { dur: 0.7, peak: 0.1, f: 1400, q: 0.6, attack: 0.3 });
  },
  // 負け：低く下がる「ぼーん」
  lose: (c, t) => {
    tone(c, t, { freq: 260, freqEnd: 80, dur: 0.75, peak: 0.22, attack: 0.01 });
    tone(c, t, { freq: 130, freqEnd: 65, dur: 0.7, peak: 0.1, attack: 0.01 });
  },
  // 昇進：拍子木2つ＋太鼓の短いファンファーレ（ソ・シ・ドの笛を太鼓に重ねる）
  promo: (c, t) => {
    [0, 0.13].forEach((dt) => noise(c, t + dt, { dur: 0.05, peak: 0.2, f: 1800, q: 4, attack: 0.001 }));
    tone(c, t + 0.3, { freq: 110, freqEnd: 60, dur: 0.11, peak: 0.2 });
    tone(c, t + 0.3, { freq: 659, dur: 0.11, peak: 0.08, type: 'triangle', attack: 0.01 });
    tone(c, t + 0.425, { freq: 110, freqEnd: 60, dur: 0.11, peak: 0.2 });
    tone(c, t + 0.425, { freq: 784, dur: 0.11, peak: 0.08, type: 'triangle', attack: 0.01 });
    tone(c, t + 0.55, { freq: 100, freqEnd: 55, dur: 0.25, peak: 0.22 });
    tone(c, t + 0.55, { freq: 1047, dur: 0.25, peak: 0.08, type: 'triangle', attack: 0.01 });
  },
  // 懸賞旗：旗のはためき「ばさばさ」（短い帯雑音を、間をばらつかせて5つ）
  flags: (c, t) => {
    [[0, 700], [0.09, 1100], [0.21, 800], [0.3, 1300], [0.43, 900]].forEach(([dt, f]) => noise(c, t + dt, { dur: 0.08, peak: 0.13, f, fEnd: f * 1.5, q: 0.8, attack: 0.01 }));
  },
  // ボタン（画面を選ぶ所）：小さな「ぽん」
  pon: (c, t) => {
    tone(c, t, { freq: 660, freqEnd: 880, dur: 0.08, peak: 0.1, attack: 0.004 });
    tone(c, t, { freq: 1320, dur: 0.05, peak: 0.03, attack: 0.004 });
  },
  // 稽古：一押しぴったり「カーン」（金属の高い響き）／外れ「ぼすっ」
  kan: (c, t) => {
    tone(c, t, { freq: 1568, dur: 0.6, peak: 0.15, type: 'triangle', attack: 0.002 });
    tone(c, t, { freq: 2349, dur: 0.35, peak: 0.08, attack: 0.002 });
    noise(c, t, { dur: 0.03, peak: 0.1, filter: 'highpass', f: 3000, q: 0.7, attack: 0.001 });
  },
  bosu: (c, t) => {
    tone(c, t, { freq: 140, freqEnd: 70, dur: 0.18, peak: 0.18 });
    noise(c, t, { dur: 0.12, peak: 0.12, filter: 'lowpass', f: 500, q: 0.7, attack: 0.002 });
  },
  // 稽古：鉄砲（連打）柱を突く「どすっ」（連打で鳴るので 0.12秒で消える）／四股（長押しを離す）足を下ろす「ずしん」
  dosu: (c, t) => {
    tone(c, t, { freq: 100, freqEnd: 55, dur: 0.12, peak: 0.16 });
    noise(c, t, { dur: 0.05, peak: 0.08, filter: 'lowpass', f: 700, q: 0.7, attack: 0.002 });
  },
  zushin: (c, t) => {
    tone(c, t, { freq: 70, freqEnd: 35, dur: 0.55, peak: 0.27 });
    noise(c, t, { dur: 0.12, peak: 0.07, filter: 'lowpass', f: 400, q: 0.7, attack: 0.002 });
  },
  // ---- 2つのボタン（10/14・設計書 2026-10-14-sumo-two-buttons-and-foe-tactics-design.md）。どれも足して 0.35 以下・0.8秒以内（試験が数える）----
  // 相手の攻めの予告：短く高い「ピッ」2つ（耳に付くが小さく）
  warn: (c, t) => {
    tone(c, t, { freq: 1760, dur: 0.06, peak: 0.12, type: 'square', attack: 0.002 });
    tone(c, t + 0.1, { freq: 1760, dur: 0.06, peak: 0.12, type: 'square', attack: 0.002 });
  },
  // 踏ん張り：低く重い「ずん」（足を据える）
  fumbari: (c, t) => {
    tone(c, t, { freq: 65, freqEnd: 40, dur: 0.5, peak: 0.25, attack: 0.01 });
    noise(c, t, { dur: 0.15, peak: 0.08, filter: 'lowpass', f: 300, q: 0.7, attack: 0.005 });
  },
  // はたき：乾いた平手「ぱしっ」
  hataki: (c, t) => {
    noise(c, t, { dur: 0.08, peak: 0.26, filter: 'highpass', f: 2000, q: 0.7, attack: 0.001 });
    tone(c, t, { freq: 900, freqEnd: 500, dur: 0.05, peak: 0.06, attack: 0.001 });
  },
  // 突っ張り：胸を突く「ドッ」（低い当たり＋短い雑音）
  tsuppari: (c, t) => {
    tone(c, t, { freq: 150, freqEnd: 70, dur: 0.18, peak: 0.24, attack: 0.002 });
    noise(c, t, { dur: 0.05, peak: 0.1, filter: 'bandpass', f: 1200, q: 1.5, attack: 0.001 });
  },
  // 組みつき：まわしをつかむ「がしっ」（こもった雑音2つ＋低い音）
  kumi: (c, t) => {
    noise(c, t, { dur: 0.05, peak: 0.16, f: 700, q: 2, attack: 0.002 });
    noise(c, t + 0.06, { dur: 0.09, peak: 0.12, filter: 'lowpass', f: 900, q: 0.8, attack: 0.002 });
    tone(c, t, { freq: 120, freqEnd: 80, dur: 0.15, peak: 0.1, attack: 0.003 });
  },
  // こらえる：腰を落とす「ぐっ」（下がる低い音）
  brace: (c, t) => tone(c, t, { freq: 220, freqEnd: 110, dur: 0.16, peak: 0.18, type: 'triangle', attack: 0.01 }),
  // 踏ん張りが解けた「ふっ」（最終点検・押しどきの合図）：上がる短い音＋息の雑音。小さく（山 0.2 以下）
  release: (c, t) => {
    tone(c, t, { freq: 330, freqEnd: 660, dur: 0.18, peak: 0.12, type: 'triangle', attack: 0.01 });
    noise(c, t, { dur: 0.12, peak: 0.05, filter: 'highpass', f: 1500, q: 0.7, attack: 0.005 });
  },
  // 光っていない右を押した「ぼすっ」（小さく短い・押しても損はしない合図）
  dud: (c, t) => {
    tone(c, t, { freq: 120, freqEnd: 70, dur: 0.12, peak: 0.1 });
    noise(c, t, { dur: 0.08, peak: 0.06, filter: 'lowpass', f: 450, q: 0.7, attack: 0.002 });
  },
  // ---- v45（10/16 本人）。どれも足して 0.35 以下・0.8秒以内（試験が数える）----
  // 「ここだ」：長押しのバーが緑の帯に入った瞬間の、明るく澄んだ「ピコーン」（短い低い粒から5度上の鈴へ跳ぶ）。
  // 予告の「ピッ」（四角の波・1760）とは音色も高さも違えて紛れないように。「ギュイーン」（山 0.06）と重ねても 0.35 以下
  koko: (c, t) => {
    tone(c, t, { freq: 1319, dur: 0.08, peak: 0.12, type: 'triangle', attack: 0.002 });
    tone(c, t + 0.06, { freq: 1976, dur: 0.38, peak: 0.14, attack: 0.003 });
  },
  // 連打の目標に届いた：上がっていく4つの鈴（ド・ミ・ソ・ド）の短いファンファーレ。
  // 同じたたきの「どすっ」と「カチッ」（0.12秒で消える）の後から始めて、足しすぎない
  tassei: (c, t) => {
    [[0.12, 1047], [0.19, 1319], [0.26, 1568]].forEach(([dt, f]) => tone(c, t + dt, { freq: f, dur: 0.15, peak: 0.09, type: 'triangle', attack: 0.004 }));
    tone(c, t + 0.33, { freq: 2093, dur: 0.45, peak: 0.12, type: 'triangle', attack: 0.004 });
    tone(c, t + 0.33, { freq: 3136, dur: 0.3, peak: 0.03, attack: 0.004 });
  },
  // 確定：0.3秒の無音のあと、太鼓と笛（虹の時に gauge4 と一緒に鳴らす）
  gaugeMax: (c, t) => {
    tone(c, t + 0.3, { freq: 100, freqEnd: 55, dur: 0.45, peak: 0.16 });
    tone(c, t + 0.34, { freq: 1047, freqEnd: 1175, dur: 0.4, peak: 0.08, type: 'triangle', attack: 0.03 });
  },
};
export const BOUT_SOUNDS = Object.keys(BOUT);

// 表 table の kind の音を鳴らす（知らない名前・鳴らせない端末では何もしない＝遊びは止めない）
function play(table, kind, volume) {
  if (!Object.prototype.hasOwnProperty.call(table, kind)) return;
  const make = table[kind];
  if (isMuted()) return;
  const c = audio();
  if (!c) return;
  try {
    wake(c); // スマホは押した時に起こさないと鳴らない
    level = typeof volume === 'number' && volume >= 0 && volume <= 1 ? volume : 1;
    make(c, c.currentTime + 0.01);
  } catch {
    // 鳴らせなくても遊びは続ける
  }
}

// 稽古の札を押した時の音
// volume＝今までの音量に掛ける倍率（0〜1・既定 1）。声のファイルが付く稽古では 0.6 に下げて声を聞こえやすくする
export function playTraining(kind, volume = 1) {
  play(SOUNDS, kind, volume);
}

// 取組の音：thud（当たり・落ちる）・slap（突っ張り）・scrape（すり足）・kime（決め技が出た）・gauge1〜4（ゲージの段）・gaugeMax（虹の確定）・press（大きなボタンの「カチッ」）・20体版 Task 6b の音（tachiai hop hopBeat land clash topple drop rise win lose promo flags pon kan bosu dosu zushin）・2つのボタンの音（warn fumbari hataki tsuppari kumi brace dud release）・手ごたえの音（bashi roar hyu koton）・v45 の音（koko＝緑の帯に入った「ここだ」・tassei＝連打の目標に届いた）。volume は playTraining と同じ
export function playBout(kind, volume = 1) {
  play(BOUT, kind, volume);
}

// ---- 「ギュイーン」（v43 本人「一押しの〇が小さくなる時、長押しのゲージが上がる時に『ギュイーン』の音」）----
// 上がっていく機械の唸り：のこぎりの波（基の高さ）と、少しずらした四角の波（唸りのうなり）を低い所だけ通して、1つの音量の弁で鳴らす。1つだけ（重ならない）
// 画面は毎コマ whine(p) を呼ぶ（p＝src/core/whine.js の進み 0〜over・null＝止める）。高さは p に合わせて滑らかに動く。
// 鳴り残らない決まり：①毎回「今の音量へ上げ、WHINE.hang 秒後に消える」を書き直す＝呼ばれなくなったら（画面が止まった・裏へ回った・画面を離れた）自然に消える
// ②null・♪を消した・鳴らせない端末＝すぐ止めて片付ける（whineStop）。山は WHINE.peak（0.35 よりずっと小さく・声やほかの効果音より小さい）
let wh = null; // { osc, osc2, filt, gain }

export function whine(p) {
  if (p === null || p === undefined || !Number.isFinite(p) || isMuted()) { whineStop(); return; }
  const c = audio();
  if (!c) return;
  try {
    wake(c);
    const now = c.currentTime;
    if (!wh) {
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.connect(c.destination);
      const filt = c.createBiquadFilter();
      filt.type = 'lowpass';
      filt.Q.value = 4;
      filt.connect(gain);
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      const osc2 = c.createOscillator();
      osc2.type = 'square';
      const g2 = c.createGain();
      g2.gain.setValueAtTime(0.35, now); // 四角の波は小さく混ぜる
      osc.connect(filt);
      osc2.connect(g2);
      g2.connect(filt);
      const f0 = whineFreq(p);
      osc.frequency.setValueAtTime(f0, now);
      osc2.frequency.setValueAtTime(f0 * 1.012, now);
      filt.frequency.setValueAtTime(f0 * 3, now);
      osc.start(now);
      osc2.start(now);
      wh = { osc, osc2, filt, gain };
    }
    const f = whineFreq(p);
    wh.osc.frequency.setTargetAtTime(f, now, 0.02);
    wh.osc2.frequency.setTargetAtTime(f * 1.012, now, 0.02);
    wh.filt.frequency.setTargetAtTime(f * 3, now, 0.02);
    const g = wh.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, Math.min(WHINE.peak, g.value || 0.0001)), now);
    g.linearRampToValueAtTime(WHINE.peak, now + 0.03);
    g.setValueAtTime(WHINE.peak, now + WHINE.hang);
    g.linearRampToValueAtTime(0.0001, now + WHINE.hang + 0.08); // 呼ばれ続ければ、この前に書き直される
  } catch {
    whineStop(); // 鳴らせなくても遊びは続ける
  }
}

// すぐ止めて片付ける（短く消してから止める＝ぷつっと鳴らない）。鳴っていなければ何もしない
export function whineStop() {
  const w = wh;
  if (!w) return;
  wh = null;
  try {
    const now = ctx ? ctx.currentTime : 0;
    w.gain.gain.cancelScheduledValues(now);
    w.gain.gain.setValueAtTime(Math.max(0.0001, Math.min(WHINE.peak, w.gain.gain.value || 0.0001)), now);
    w.gain.gain.linearRampToValueAtTime(0.0001, now + 0.04);
    w.osc.stop(now + 0.06);
    w.osc2.stop(now + 0.06);
  } catch {
    // 止められなくても続ける（音量は hang 秒で消えている）
  }
}

// 鳴っているか（試験と画面の確かめ用）
export const whineOn = () => !!wh;
