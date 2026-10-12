// src/ui/sfx.js — 効果音（10/11 本人「効果音付きで」）。音のファイルは使わず、Web Audio でその場で作る
// どの音も 0.8 秒以内・重なった時も含めて音量の山は 0.35 以下。鳴らせない端末（AudioContext が無い・作ると例外）では何もしない
let ctx = null;
let broken = false; // 作ろうとして例外が出た端末では、2度目からは試さない
let level = 1; // 今鳴らす音の音量の倍率（声が付く稽古では下げる・playTraining が音ごとに決める）

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
  // 組み絵のカットイン「シャキーン＋拍子木」（設計書 9.7 の緑の段・足して 0.35 を超えない）
  kumi: (c, t) => {
    tone(c, t, { freq: 1800, freqEnd: 3200, dur: 0.25, peak: 0.12 });
    noise(c, t, { dur: 0.3, peak: 0.08, filter: 'highpass', f: 4000, q: 0.7, attack: 0.002 });
    noise(c, t + 0.28, { dur: 0.05, peak: 0.15, filter: 'bandpass', f: 1800, q: 4, attack: 0.001 });
  },
};
export const BOUT_SOUNDS = Object.keys(BOUT);

// 表 table の kind の音を鳴らす（知らない名前・鳴らせない端末では何もしない＝遊びは止めない）
function play(table, kind, volume) {
  if (!Object.prototype.hasOwnProperty.call(table, kind)) return;
  const make = table[kind];
  const c = audio();
  if (!c) return;
  try {
    // スマホは押した時に起こさないと鳴らない
    if (c.state === 'suspended' && c.resume) {
      const p = c.resume(); // 古い端末は Promise を返さない
      if (p && p.catch) p.catch(() => {});
    }
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

// 取組の音：thud（当たり・落ちる）・slap（突っ張り）・scrape（すり足）・kumi（組み絵のカットイン）。volume は playTraining と同じ
export function playBout(kind, volume = 1) {
  play(BOUT, kind, volume);
}
