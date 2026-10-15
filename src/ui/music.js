// src/ui/music.js — 音楽（2026-10-13 本人「今回の相撲のゲームは音楽にも力を入れたい」）。音のファイルは使わず、Web Audio でその場で合成して鳴らす（sfx.js と同じ流儀）
// 楽器：太鼓（どん・縁のかっ）・拍子木・笛・三味線・低音。曲は SONGS に「1拍＝4つの升」の譜で書く。曲はくり返す
// 音量の山は BGM 全体で 0.22 くらいに抑える（効果音 0.35 が上に乗っても割れない）。鳴らせない端末では何もしない
// 取組の曲 nokotta（10/15 本人「のこったでもっとアップテンポの曲など」・設計書 §12）は、跳ねる拍 KAMI.BEAT（0.52秒）に拍の頭を合わせる＝beatLock。
//   取組の画面が毎コマ musicBeat(st.t) を呼ぶ：曲の升 s が鳴る音の時刻 ＝ off ＋ g(s)（g＝その升が重なる取組の時刻・off＝音の時計 − 出口の遅れ − 取組の時刻）。
//   拍の升（4升ごと）の g は必ず KAMI.BEAT の整数倍＝beatOffset(st) の 0 と同じ所。止め・コマ落ち・裏へ回った後のずれは、次の升を遅らせる／飛ばす（半拍以内の近い方）で直す
import { KAMI } from '../core/kami.js?v=45';
let ctx = null;
let broken = false;
let master = null;
let timer = null;
let playing = null; // { song, step, nextTime }
let wanted = null; // 今の画面で鳴らしたい曲（消している間・まだ触れていない間も覚えておく）
let current = null; // 今鳴っている曲
let away = false; // 画面が裏へ回っている間（v44）：音を起こさない（戻った時・触れた時に起こす）
let pendingSuspend = null; // suspend() がまだ終わっていない間の約束（state が変わるのは少し後＝すぐ戻ると resume が空振りする）
let muted = null; // ♪の消音の印（v44）：まず memory に持つ。保存（localStorage）は次に開いた時に覚えておくためだけ＝保存できない端末でも効く

function audio() {
  if (ctx || broken) return ctx;
  const w = typeof window !== 'undefined' ? window : null;
  const AC = w ? w.AudioContext || w.webkitAudioContext : null;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.36;
    const comp = ctx.createDynamicsCompressor(); // 太鼓が重なった時の山をならす
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);
  } catch {
    broken = true;
    ctx = null;
  }
  return ctx;
}

// 音を起こす（v44）：止まっている（suspended）だけでなく、iPhone の電話・Siri の後の 'interrupted' からも起こす。裏へ回っている間・閉じた音は起こさない。失敗しても投げない
function resumeCtx(c) {
  if (!c || away || c.state === 'running' || c.state === 'closed' || !c.resume) return Promise.resolve();
  try {
    const p = c.resume(); // 古い端末は Promise を返さない
    return p && p.then ? p.catch(() => {}) : Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function env(c, t0, dur, peak, attack = 0.005, release = null) {
  const g = c.createGain();
  g.gain.value = 0.0001; // 鳴り始めより前も小さく（升の時刻が1サンプルの途中だと、雑音の最初の1サンプルが音量1のまま出て「プチッ」となった・10/15 鉦で測った）
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  if (release == null) g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  else {
    g.gain.setValueAtTime(peak, t0 + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  g.connect(master);
  return g;
}

let noiseBuf = null;
function noiseSrc(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 1.0), c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  return s;
}

// ---- 楽器
const INSTR = {
  // 太鼓の「どん」：低い正弦波が下がる＋皮の当たりの雑音（強さ v＝0〜1）
  taiko(c, t, v = 1) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(115, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.35);
    o.connect(env(c, t, 0.55, 0.42 * v, 0.004));
    o.start(t);
    o.stop(t + 0.6);
    const n = noiseSrc(c);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    n.connect(f);
    f.connect(env(c, t, 0.09, 0.22 * v, 0.002));
    n.start(t);
    n.stop(t + 0.12);
  },
  // 太鼓の縁の「かっ」
  rim(c, t, v = 1) {
    const n = noiseSrc(c);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1900;
    f.Q.value = 6;
    n.connect(f);
    f.connect(env(c, t, 0.05, 0.2 * v, 0.001));
    n.start(t);
    n.stop(t + 0.07);
  },
  // 拍子木：硬い木の「カン」（高い正弦波＋細く絞った雑音・とても短い）
  hyoshigi(c, t, v = 1) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(2350, t);
    o.connect(env(c, t, 0.07, 0.16 * v, 0.001));
    o.start(t);
    o.stop(t + 0.09);
    const n = noiseSrc(c);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3100;
    f.Q.value = 9;
    n.connect(f);
    f.connect(env(c, t, 0.04, 0.3 * v, 0.001));
    n.start(t);
    n.stop(t + 0.06);
  },
  // 笛：三角波＋少しの正弦の倍音・ゆっくり入ってビブラート・息の雑音を少し
  fue(c, t, m, dur, v = 1) {
    const hz = midiHz(m);
    const lfo = c.createOscillator();
    lfo.frequency.value = 5.2;
    const lg = c.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(hz * 0.012, t + Math.min(0.25, dur * 0.6)); // 伸ばす音ほど揺れが付く
    lfo.connect(lg);
    const g = env(c, t, dur, 0.12 * v, 0.035, Math.min(0.12, dur * 0.4));
    [['triangle', 1, 1], ['sine', 2, 0.25]].forEach(([type, mul, amp]) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(hz * mul, t);
      o.frequency.setValueAtTime(hz * mul * 0.985, t); // 吹き始めは少し低く、すぐ上がる（笛らしい入り）
      o.frequency.linearRampToValueAtTime(hz * mul, t + 0.05);
      lg.connect(o.frequency);
      const a = c.createGain();
      a.gain.value = amp;
      o.connect(a);
      a.connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    const n = noiseSrc(c);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = hz * 2;
    f.Q.value = 2;
    n.connect(f);
    f.connect(env(c, t, Math.min(dur, 0.3), 0.025 * v, 0.02));
    n.start(t);
    n.stop(t + Math.min(dur, 0.3) + 0.02);
  },
  // 三味線：のこぎり波を絞った「べん」・すぐ消える・はじいた直後に少し音程が下がる（さわり）
  shamisen(c, t, m, dur, v = 1) {
    const hz = midiHz(m);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(hz * 1.012, t);
    o.frequency.exponentialRampToValueAtTime(hz, t + 0.04);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(hz * 9, t);
    f.frequency.exponentialRampToValueAtTime(hz * 2, t + 0.25);
    o.connect(f);
    const len = Math.min(dur, 0.45);
    f.connect(env(c, t, len, 0.11 * v, 0.002));
    o.start(t);
    o.stop(t + len + 0.02);
  },
  // 津軽三味線（10/13 本人「三味線の音楽も追加したい」）：撥で皮をたたく「バチン」＋弦のびりつき（さわり）＋下からすくい上げ（slide＝何半音下から）
  // ⭐やぐら太鼓・取組の三味線（上の shamisen）は本人OK の音なので変えずに、別の楽器として足した
  tsugaru(c, t, m, dur, v = 1, slide = 0) {
    const hz = midiHz(m);
    const len = Math.min(dur * 1.6, 0.9);
    const g = env(c, t, len, 0.12 * v, 0.002);   // ⛔0.17 にしても平均はほぼ同じで山だけ 0.30 に出た（休みの多い独奏なので平均が低いのは曲の性格）
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(hz * 14, t);
    f.frequency.exponentialRampToValueAtTime(hz * 2.5, t + 0.35);
    f.connect(g);
    [['sawtooth', 1, 1], ['square', 2.003, 0.18]].forEach(([type, mul, amp]) => {   // 2倍の少しずれた四角い波＝びりつき
      const o = c.createOscillator();
      o.type = type;
      const from = slide ? hz * mul * Math.pow(2, -slide / 12) : hz * mul * 1.015;
      o.frequency.setValueAtTime(from, t);
      o.frequency.exponentialRampToValueAtTime(hz * mul, t + (slide ? 0.09 : 0.03));
      const a = c.createGain();
      a.gain.value = amp;
      o.connect(a);
      a.connect(f);
      o.start(t);
      o.stop(t + len + 0.02);
    });
    const n = noiseSrc(c);                                                // 撥が皮に当たる「バチン」
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 1.5;
    n.connect(bp);
    bp.connect(env(c, t, 0.035, 0.16 * v, 0.001));
    n.start(t);
    n.stop(t + 0.05);
  },
  // 低音：四角い波（ファミコンの低音のような）
  bass(c, t, m, dur, v = 1) {
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = midiHz(m);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    o.connect(f);
    f.connect(env(c, t, dur * 0.9, 0.07 * v, 0.004, 0.03));
    o.start(t);
    o.stop(t + dur);
  },
  // 締太鼓（祭り囃子の細かい刻み「テンツク」）：高めに張った皮の短い「てん」＝三角波が少し下がる＋皮の当たりの雑音
  shime(c, t, v = 1) {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(340, t);
    o.frequency.exponentialRampToValueAtTime(230, t + 0.06);
    o.connect(env(c, t, 0.09, 0.11 * v, 0.001));
    o.start(t);
    o.stop(t + 0.11);
    const n = noiseSrc(c);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500;
    f.Q.value = 1.4;
    n.connect(f);
    f.connect(env(c, t, 0.035, 0.07 * v, 0.001));
    n.start(t);
    n.stop(t + 0.05);
  },
  // 鉦（当たり鉦・チャッパの「チャン」）：倍音がずれた金属の響き（正弦波3つ）＋高い雑音・短く
  kane(c, t, v = 1) {
    [[1260, 0.04], [2090, 0.028], [3310, 0.02]].forEach(([hz, amp]) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz;
      o.connect(env(c, t, 0.16, amp * v, 0.001));
      o.start(t);
      o.stop(t + 0.18);
    });
    const n = noiseSrc(c);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 5000;
    n.connect(f);
    f.connect(env(c, t, 0.05, 0.045 * v, 0.001));
    n.start(t);
    n.stop(t + 0.07);
  },
  // 先頭の旋律（チップチューン）：細い四角い波（25%）
  lead(c, t, m, dur, v = 1) {
    const hz = midiHz(m);
    const real = new Float32Array(16), imag = new Float32Array(16);
    for (let k = 1; k < 16; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25); // 25% の四角い波
    const o = c.createOscillator();
    o.setPeriodicWave(c.createPeriodicWave(real, imag));
    o.frequency.value = hz;
    o.connect(env(c, t, dur * 0.95, 0.065 * v, 0.004, 0.04));
    o.start(t);
    o.stop(t + dur);
  },
};

// ---- 譜：rhythm＝1小節16升の文字（D＝太鼓・d＝太鼓弱め・k＝縁・h＝拍子木・.＝休み）。notes＝[升, 音の高さ(MIDI), 長さ(升)]
const bar = (s) => s.replace(/\s/g, '');
export const SONGS = {
  // やぐら太鼓（場所の始まり・番付）：明るい陽音階（レ ミ ソ ラ シ）・104拍・8小節
  yagura: {
    bpm: 104,
    bars: 8,
    rhythm: {
      taiko: [
        'D..d..d.D...d.k.', 'D..d..d.D...d.k.', 'D..d..d.D...d.k.', 'D..d..d.D.d.d.k.',
        'D..d..d.D...d.k.', 'D..d..d.D...d.k.', 'D..d..d.D...d.k.', 'D.d.d.d.D.ddDdDd',
      ].map(bar),
    },
    fue: [
      [0, 81, 6], [6, 83, 2], [8, 86, 8],
      [16, 83, 4], [20, 81, 4], [24, 79, 8],
      [32, 76, 4], [36, 79, 4], [40, 81, 6], [46, 79, 2],
      [48, 76, 12], [60, 74, 4],
      [64, 74, 4], [68, 76, 4], [72, 79, 6], [78, 81, 2],
      [80, 83, 4], [84, 81, 4], [88, 79, 4], [92, 76, 4],
      [96, 79, 6], [102, 76, 2], [104, 74, 4], [108, 71, 4],
      [112, 74, 16],
    ],
    shamisen: Array.from({ length: 8 }, (_, b) => [[b * 16, 62, 2], [b * 16 + 4, 69, 2], [b * 16 + 8, 74, 2], [b * 16 + 10, 69, 2], [b * 16 + 12, 62, 2]]).flat(),
  },
  // 取組（取組の最中）：都節（ラ シ♭ レ ミ ファ）の暗め・150拍・8小節・拍子木で始まる
  torikumi: {
    bpm: 150,
    bars: 8,
    rhythm: {
      taiko: [
        'D...d.k.D.d.d.k.', 'D...d.k.D.d.d.k.', 'D...d.k.D.d.d.k.', 'D...d.k.D.d.ddkk',
        'D...d.k.D.d.d.k.', 'D...d.k.D.d.d.k.', 'D...d.k.D.d.d.k.', 'D.d.D.d.DdDdDDDD',
      ].map(bar),
      hyoshigi: ['h.h.............', '................', '................', '................',
        'h...............', '................', '................', '................'].map(bar),
    },
    lead: [
      [0, 76, 4], [4, 77, 2], [6, 76, 2], [8, 74, 4], [12, 70, 4],
      [16, 69, 8], [24, 64, 4], [28, 65, 4],
      [32, 69, 4], [36, 70, 2], [38, 69, 2], [40, 74, 4], [44, 76, 4],
      [48, 77, 8], [56, 76, 4], [60, 74, 4],
      [64, 81, 4], [68, 82, 2], [70, 81, 2], [72, 77, 4], [76, 76, 4],
      [80, 74, 6], [86, 76, 2], [88, 77, 4], [92, 74, 4],
      [96, 70, 4], [100, 69, 4], [104, 65, 4], [108, 64, 4],
      [112, 69, 12], [124, 64, 4],
    ],
    shamisen: Array.from({ length: 8 }, (_, b) => [57, 0, 64, 57, 62, 57, 64, 65, 57, 0, 64, 57, 62, 58, 57, 52]
      .map((m, i) => [b * 16 + i, m, 1]).filter((n) => n[1] > 0)).flat(),
    bass: Array.from({ length: 8 }, (_, b) => {
      const root = [45, 45, 46, 45, 45, 45, 46, 40][b];
      return [[b * 16, root, 3], [b * 16 + 4, root + 12, 2], [b * 16 + 8, root, 3], [b * 16 + 12, root + 7, 2]];
    }).flat(),
  },
  // 津軽（稽古の画面向けの案）：津軽三味線が主役・民謡音階（ミ ソ ラ シ レ）・132拍・8小節。小節の頭は強く、伸ばす音は下からすくい上げる。低い弦の「ぼん」と軽い太鼓
  tsugaru: {
    bpm: 132,
    bars: 8,
    rhythm: { taiko: ['D.......d.......', 'D.......d.......', 'D.......d.......', 'D.......d...d.k.',
      'D.......d.......', 'D.......d.......', 'D.......d.......', 'D...d...D.d.D...'].map(bar) },
    tsugaru: [
      [64, 0, 64, 0, 59, 0, 64, 0, 67, 64, 0, 0, 69, 67, 64, 0],
      [71, 0, 69, 0, 67, 0, 64, 0, 62, 0, 64, 0, 59, 0, 0, 0],
      [64, 0, 64, 0, 59, 0, 64, 0, 67, 64, 0, 0, 69, 67, 64, 0],
      [71, 0, 74, 0, 76, 0, 74, 71, 69, 0, 67, 0, 64, 0, 0, 0],
      [76, 0, 76, 74, 71, 0, 74, 0, 76, 0, 79, 0, 76, 74, 71, 0],
      [69, 0, 71, 0, 69, 67, 64, 0, 67, 0, 69, 0, 71, 0, 0, 0],
      [64, 64, 0, 64, 59, 0, 62, 0, 64, 0, 67, 0, 69, 0, 67, 64],
      [62, 0, 59, 0, 57, 0, 59, 0, 64, 0, 0, 0, 52, 0, 0, 0],
    ].map((row, b) => row.map((m, i) => {
      if (!m) return null;
      let len = 1; while (i + len < 16 && !row[i + len]) len++;           // 次の音までの長さ
      const head = i === 0, long = len >= 3;
      return [b * 16 + i, m, len, head ? 1.25 : 0.9, long ? 2 : 0];       // 小節の頭は強く・3升以上伸ばす音は2半音下からすくう
    }).filter(Boolean)).flat()
      .concat(Array.from({ length: 8 }, (_, b) => [[b * 16, 52, 2, 0.7, 0], [b * 16 + 8, 52, 2, 0.6, 0]]).flat()),   // 低い弦（ミ）を拍の頭で
  },
  // のこった（取組の最中・10/15 本人「のこったでもっとアップテンポの曲など」）：明るい祭り囃子ふう・陽音階（レ ミ ソ ラ シ）の篠笛ふうの旋律・
  //   締太鼓の16分の刻み（テンツク）・鉦・拍子木・大太鼓は跳ねる拍ごと。
  //   テンポ＝跳ねる拍にぴったり：4分音符（4升）＝KAMI.BEAT＝0.52秒＝約115.4拍／1升＝0.13秒の16分の刻み。1小節＝4拍＝2.08秒・8小節＝16.64秒でくり返す
  //   layers＝その段から鳴る（0＝立ち合い前も・1＝押し合い・2＝追い込み＝端の近く／30秒過ぎ）。テンポは変えずに重ねるだけ
  nokotta: {
    bpm: 60 / KAMI.BEAT,
    beat: KAMI.BEAT,
    beatLock: true,
    bars: 8,
    layers: { shime: 1, kane: 1, fue: 1, taiko2: 2, shime2: 2 },
    rhythm: {
      taiko: ['D...d...D...d...', 'D...d...D...d...', 'D...d...D...d...', 'D...d...D.d.DdDd',
        'D...d...D...d...', 'D...d...D...d...', 'D...d...D...d...', 'D...d...D.d.DdDd'].map(bar),
      shime: ['S.ssS.ssS.ssS.ss', 'S.ssS.ssS.ssS.ss', 'S.ssS.ssS.ssS.ss', 'S.ssS.ssSsSsSSSS',
        'S.ssS.ssS.ssS.ss', 'S.ssS.ssS.ssS.ss', 'S.ssS.ssS.ssS.ss', 'S.ssS.ssSsSsSSSS'].map(bar),
      kane: ['C.c...c...c...c.', '..c...c...c...c.', '..c...c...c...c.', '..c...c...C.C.C.',
        'C.c...c...c...c.', '..c...c...c...c.', '..c...c...c...c.', '..c...c...C.C.C.'].map(bar),
      hyoshigi: ['h.h.............', '................', '................', '................',
        'h...............', '................', '................', '................'].map(bar),
      // 追い込みの層：大太鼓の裏拍と、締太鼓の空いた升を埋めて16分を切れ目なく。元の列が鳴る升には重ねない（同じ升で2つ鳴ると山が 0.33 に出た・10/15 測定）＝4・8小節目の締めの手は後ろ半分を元の列に任せる
      taiko2: ['..d...d...d...d.', '..d...d...d...d.', '..d...d...d...d.', '..d...d.........',
        '..d...d...d...d.', '..d...d...d...d.', '..d...d...d...d.', '..d...d.........'].map(bar),
      shime2: ['.S...S...S...S..', '.S...S...S...S..', '.S...S...S...S..', '.S...S..........',
        '.S...S...S...S..', '.S...S...S...S..', '.S...S...S...S..', '.S...S..........'].map(bar),
    },
    fue: [
      [0, 81, 2], [2, 83, 2], [4, 86, 2], [6, 83, 1], [7, 81, 1], [8, 79, 2], [10, 81, 2], [12, 83, 4],
      [16, 86, 2], [18, 88, 2], [20, 86, 2], [22, 83, 2], [24, 81, 4], [28, 79, 2], [30, 76, 2],
      [32, 79, 2], [34, 81, 2], [36, 83, 1], [37, 81, 1], [38, 79, 2], [40, 76, 2], [42, 74, 2], [44, 76, 4],
      [48, 79, 3], [51, 81, 1], [52, 79, 2], [54, 76, 2], [56, 74, 8],
      [64, 86, 2], [66, 86, 2], [68, 88, 2], [70, 86, 2], [72, 83, 2], [74, 86, 2], [76, 88, 4],
      [80, 91, 2], [82, 88, 2], [84, 86, 2], [86, 83, 2], [88, 81, 2], [90, 83, 2], [92, 86, 4],
      [96, 83, 2], [98, 81, 2], [100, 79, 2], [102, 81, 1], [103, 83, 1], [104, 81, 2], [106, 79, 2], [108, 76, 2], [110, 79, 2],
      [112, 81, 4], [116, 79, 2], [118, 76, 2], [120, 74, 8],
    ],
  },
};

// 取組の終わりの短い節（nokotta と同じテンポ・1小節の中）：勝ち＝駆け上がって高いレで決める約1.8秒／負け＝静かに下りる約1.6秒
export const ENDINGS = {
  win: {
    rhythm: {
      taiko: [bar('D..dD.ddD.......')],
      shime: [bar('S.ssSsSsS.......')],
      kane: [bar('C.c.C.c.C.......')],
      hyoshigi: [bar('........h.......')],
    },
    fue: [[0, 74, 1], [1, 76, 1], [2, 79, 1], [3, 81, 1], [4, 83, 2], [6, 81, 1], [7, 83, 1], [8, 86, 6]],
  },
  lose: {
    rhythm: { taiko: [bar('d.....d.........')] },
    fue: [[0, 79, 3, 0.7], [3, 76, 3, 0.6], [6, 74, 6, 0.5]],
  },
};
// 節の長さ（秒）：最後の音の終わりまで
export function endingSecs(kind, song = SONGS.nokotta) {
  const e = ENDINGS[kind];
  const stepDur = 60 / song.bpm / 4;
  const last = Math.max(...(e.fue || []).map(([s, , len]) => s + len), ...Object.values(e.rhythm).map((r) => r[0].replace(/\.+$/, '').length));
  return last * stepDur;
}

// ---- 1升ぶんの音を時刻 t に予約する（鳴らす時も書き出す時もこれ1つ）
// level＝重ねる段（song.layers に書いた段より低いと、その列・その楽器は鳴らさない）。layers の無い曲は全部鳴る
// 刻みの列：taiko（D＝太鼓・d＝弱め・k＝縁）・hyoshigi（h）・ほか（shime・kane など）は大文字＝強く・小文字＝弱め。列の名の後ろの数字は同じ楽器の重ねる層（taiko2）
function stepNotes(c, song, s, t, level = 1) {
  const stepDur = 60 / song.bpm / 4, b = Math.floor(s / 16), i = s % 16;
  const layers = song.layers || {};
  const on = (name) => level >= (layers[name] || 0);
  for (const row of Object.keys(song.rhythm)) {
    if (!on(row)) continue;
    const ch = song.rhythm[row][b][i];
    if (ch === '.') continue;
    const inst = row.replace(/\d+$/, '');
    if (inst === 'taiko') {
      if (ch === 'D') INSTR.taiko(c, t, 1);
      else if (ch === 'd') INSTR.taiko(c, t, 0.55);
      else if (ch === 'k') INSTR.rim(c, t, 1);
    } else if (inst === 'hyoshigi') INSTR.hyoshigi(c, t, 1);
    else if (INSTR[inst]) INSTR[inst](c, t, ch === ch.toUpperCase() ? 1 : 0.55);
  }
  for (const part of ['fue', 'shamisen', 'tsugaru', 'bass', 'lead']) {
    if (!on(part)) continue;
    for (const [st, m, len, v = 1, slide = 0] of song[part] || []) if (st === s) INSTR[part](c, t, m, len * stepDur, v, slide);   // 4つ目＝強さ・5つ目＝すり上げ（何半音下から）
  }
}

// ---- 拍に合わせる（純粋な計算・試験で数を確かめる）
// p＝{ nextTime（次の升を鳴らす音の時刻）, step（次の升の番号）, g（次の升が重なる取組の時刻）}・off＝音の時刻 − 取組の時刻（出口の遅れを引いた物）
export const LOCK = { tol: 0.012, snap: 0.06, follow: 0.15, ahead: 0.005 };
// 出口の遅れ（予約した時刻から耳に届くまで）：outputLatency（無い端末は baseLatency・それも無い＝0）・0〜0.25秒に収める
export function outLatency(c) {
  const v = c && (Number.isFinite(c.outputLatency) && c.outputLatency > 0 ? c.outputLatency : c.baseLatency);
  return Number.isFinite(v) ? Math.max(0, Math.min(0.25, v)) : 0;
}
// off のなだらかな見積もり：コマの揺れ（数ms〜十数ms）は少しずつ追い、止め・コマ落ちの大きな跳び（snap 秒より大きい）はすぐ合わせる
export function lockOffset(prev, raw) {
  if (!Number.isFinite(prev) || Math.abs(raw - prev) > LOCK.snap) return raw;
  return prev + (raw - prev) * LOCK.follow;
}
// 曲の頭を置く所：音の時刻 audioNow＋margin より後の、一番早い拍の頭（取組の時刻＝beat の整数倍）。{ g, at }（at＝その音の時刻）
export function gridStart(off, audioNow, beat, margin) {
  const g = Math.ceil((audioNow + margin - off) / beat - 1e-9) * beat;
  return { g, at: off + g };
}
// ずれを直す：次の升の正しい音の時刻 off＋g と今の予約 nextTime の差 e を、拍の整数倍を足し引きして半拍以内にする（どの拍に当たるかは変えてよい・拍の頭は拍の頭のまま）。
// |e| が tol より大きい時だけ動かす（e＞0＝待つ・e＜0＝早める）。もう過ぎた升は飛ばす（升と g は一緒に進める＝拍の頭はずれない）
export function beatAlign(p, off, audioNow, beat, stepDur) {
  let e = off + p.g - p.nextTime;
  const k = Math.round(e / beat);
  let g = p.g - k * beat;
  e -= k * beat;
  let { nextTime, step } = p;
  if (Math.abs(e) > LOCK.tol) nextTime += e;
  const late = audioNow + LOCK.ahead - nextTime;
  if (late > 0) { const n = Math.ceil(late / stepDur - 1e-9); nextTime += n * stepDur; step += n; g += n * stepDur; }
  return { nextTime, step, g };
}
// 予約：horizon（音の時刻）より前の升を [{ s, t }] で返し、p を進める。restartAt（取組の時刻）に来たら曲の頭（升 0）から（押し合いの始まり）
// 遅れの追いつき：予約の時刻が音の今より 1 升以上遅れた（隠れたタブで止まっていた）ら、遅れた升を一度に鳴らさず飛ばして今に合わせる
export function catchUp(p, audioNow, stepDur) {
  if (p.nextTime >= audioNow - stepDur) return 0;
  const n = Math.ceil((audioNow - p.nextTime) / stepDur - 1e-9);
  p.nextTime += n * stepDur;
  p.step += n;
  p.g += n * stepDur;
  return n;
}
export function takeSteps(p, horizon, stepDur) {
  const out = [];
  while (p.nextTime < horizon) {
    if (p.restartAt != null && p.g >= p.restartAt - 1e-6) { p.step = 0; p.restartAt = null; }
    out.push({ s: p.step, t: p.nextTime });
    p.step += 1;
    p.nextTime += stepDur;
    p.g += stepDur;
  }
  return out;
}

// ---- 鳴らす（少し先までの音を予約していく）
const LOOKAHEAD = 0.15;
// 今の重ねる段：追い込み（段2）は一度入ったら1小節は続ける（端を出たり入ったりで層がちらつかない）
function levelNow(c) {
  if (!playing) return 1;
  return playing.hotUntil > c.currentTime ? Math.max(playing.level, 2) : playing.level;
}
function schedule() {
  const c = ctx;
  if (!c || !playing || playing.wait) return; // 拍に合わせる曲は、取組の時刻が来るまで鳴らさない（musicBeat が頭を置く）
  const { song } = playing;
  const stepDur = 60 / song.bpm / 4;
  const total = song.bars * 16;
  const lv = levelNow(c);
  catchUp(playing, c.currentTime, stepDur);
  for (const { s, t } of takeSteps(playing, c.currentTime + LOOKAHEAD, stepDur)) stepNotes(c, song, s % total, t, lv);
}

export function playMusic(id) {
  const c = audio();
  if (!c || !SONGS[id]) return false;
  resumeCtx(c);
  stopMusic();
  const song = SONGS[id];
  playing = { song, step: 0, nextTime: c.currentTime + 0.08, g: 0, wait: !!song.beatLock, off: NaN, level: 1, hotUntil: -Infinity, restartAt: null };
  timer = setInterval(schedule, 25);
  schedule();
  return true;
}

// 取組の画面が毎コマ呼ぶ：gameNow＝取組の時刻 st.t。拍に合わせる曲（beatLock）が鳴っている時だけ働く（消音・音が無い・別の曲＝何もしない）
// level＝重ねる段（0＝立ち合い前・1＝押し合い・2＝追い込み）・cue＝押し合いの始まり：次の拍の頭から曲を頭（1小節目）に戻す
// 止め・スローの間は呼ばない（曲はそのままの速さで流れる）＝時間が動き出した時の1回で、半拍以内の近い方へ合わせ直す
export function musicBeat(gameNow, { level = 1, cue = false } = {}) {
  const c = ctx;
  if (!c || !playing || !playing.song.beatLock || !Number.isFinite(gameNow)) return false;
  const song = playing.song, beat = song.beat, stepDur = 60 / song.bpm / 4;
  const now = c.currentTime;
  playing.off = lockOffset(playing.off, now - outLatency(c) - gameNow);
  playing.level = level;
  if (level >= 2) playing.hotUntil = now + 16 * stepDur;
  if (playing.wait) {
    const s = gridStart(playing.off, now, beat, 0.03);
    Object.assign(playing, { g: s.g, nextTime: s.at, step: 0, wait: false });
  } else {
    Object.assign(playing, beatAlign(playing, playing.off, now, beat, stepDur));
    if (cue) playing.restartAt = Math.ceil(playing.g / beat - 1e-9) * beat; // 次の拍の頭（取組の時刻）
  }
  schedule();
  return true;
}

// 取組の終わり：くり返しを次の拍の頭まで流してから、短い節（勝ち／負け）で閉じる。鳴っていない（消音・音が無い）＝何もしない。その後この画面では鳴らし直さない
export function musicEnd(won) {
  const c = ctx;
  if (!c || !playing) return false;
  if (isMuted()) { stopMusic(); wanted = null; return false; } // 消音中は終わりの節も鳴らさない
  const song = playing.song, stepDur = 60 / song.bpm / 4, total = song.bars * 16;
  const end = ENDINGS[won ? 'win' : 'lose'];
  if (!playing.wait && song.beatLock) {
    const toBeat = Math.ceil(playing.g / song.beat - 1e-9) * song.beat - playing.g; // 次の拍の頭まで（秒）
    const lv = levelNow(c);
    for (const { s, t } of takeSteps(playing, playing.nextTime + toBeat - 1e-6, stepDur)) stepNotes(c, song, s % total, t, lv);
  }
  const at = playing.wait ? c.currentTime + 0.05 : Math.max(playing.nextTime, c.currentTime + 0.02);
  const phrase = { bpm: song.bpm, bars: 1, rhythm: end.rhythm, fue: end.fue };
  for (let s = 0; s < 16; s++) stepNotes(c, phrase, s, at + s * stepDur, 1);
  stopMusic();
  wanted = null; // 節の後は無音（次の画面の setScene がその画面の曲を鳴らす）
  return true;
}

export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null;
  playing = null;
  current = null;
}

// 楽器を1つだけ鳴らす（試聴ページ用）
export function playInstrument(name) {
  const c = audio();
  if (!c) return false;
  resumeCtx(c);
  const t = c.currentTime + 0.05;
  if (name === 'taiko' || name === 'rim' || name === 'hyoshigi' || name === 'shime' || name === 'kane') INSTR[name](c, t, 1);
  else if (name === 'fue') INSTR.fue(c, t, 81, 1.2, 1);
  else if (name === 'shamisen') INSTR.shamisen(c, t, 62, 0.6, 1);
  else if (name === 'tsugaru') INSTR.tsugaru(c, t, 64, 0.6, 1.2, 2);
  else if (name === 'bass') INSTR.bass(c, t, 45, 0.6, 1);
  else if (name === 'lead') INSTR.lead(c, t, 76, 0.6, 1);
  return true;
}

// 曲を裏で音に書き出す（確かめ用・OfflineAudioContext）：{ peak, rms, buffer } を返す。level＝重ねる段（nokotta の追い込みは 2）
export function renderSong(id, seconds, level = 1) {
  const w = typeof window !== 'undefined' ? window : null;
  const OAC = w ? w.OfflineAudioContext || w.webkitOfflineAudioContext : null;
  if (!OAC || !SONGS[id]) return Promise.resolve(null);
  const keep = { ctx, master, noiseBuf };
  const oc = new OAC(1, Math.floor(44100 * seconds), 44100);
  ctx = oc; noiseBuf = null;
  master = oc.createGain(); master.gain.value = 0.36;
  const comp = oc.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(oc.destination);
  const song = SONGS[id], stepDur = 60 / song.bpm / 4, total = song.bars * 16;
  for (let st = 0, t = 0.05; t < seconds - 0.5; st++, t += stepDur) stepNotes(oc, song, st % total, t, level);
  ctx = keep.ctx; master = keep.master; noiseBuf = keep.noiseBuf;
  return oc.startRendering().then((buffer) => {
    const d = buffer.getChannelData(0); let peak = 0, sum = 0;
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; }
    return { peak, rms: Math.sqrt(sum / d.length), buffer };
  });
}

// ---- ゲームの画面ごとの曲（10/13 本人「両方OK」「三味線も採用で」）。同じ曲の画面が続く間は止めずに流し続ける
// caution＝null は「わざと無音」（注意書きの札はまだ画面に触れていないので鳴らせない）。cover は記録を選ぶ画面と同じ曲で、そのまま記録を選ぶ画面へ流れる
export const SCENE_SONG = {
  caution: null, cover: 'yagura',
  guide: 'yagura', guidePick: 'yagura', setup: 'yagura', help: 'yagura', ladder: 'yagura', after: 'yagura', clear: 'yagura',
  learn: 'tsugaru', training: 'tsugaru', drill: 'tsugaru', // 10/12 夜 稽古が戻った＝津軽三味線（稽古の遊びも同じ曲を流し続ける）
  opponent: 'torikumi', strategy: 'torikumi', bout: 'torikumi', kensho: 'torikumi',
  kami: 'nokotta', // 10/15 本人「のこったでもっとアップテンポの曲など」＝取組の最中は明るく速い祭り囃子（暗い torikumi は相手の情報・懸賞旗に残す）
};
const MUTE_KEY = 'sumo.music';

function store() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}
export function isMuted() {
  if (muted !== null) return muted;
  const s = store();
  try { return !!s && s.getItem(MUTE_KEY) === 'off'; } catch { return false; }
}
function startWanted() {
  if (!wanted || isMuted()) return;
  if (current === wanted && playing) return;
  if (playMusic(wanted)) current = wanted;
}
// 画面が始まった時に呼ぶ
export function setScene(key) {
  wanted = SCENE_SONG[key] || null;
  if (!wanted) { stopMusic(); current = null; return; }
  const c = audio();
  if (!c || c.state !== 'running') return; // まだ画面に触れていない＝触れた時に鳴らす
  startWanted();
}
export function setMuted(off) {
  muted = !!off; // まず memory（保存に失敗しても、この画面からは効く）
  const s = store();
  try { if (s) s.setItem(MUTE_KEY, off ? 'off' : 'on'); } catch { /* 覚えられなくても鳴らす・止めるはする */ }
  if (off) { stopMusic(); current = null; } else startWanted();
}
// 起こした後：曲が鳴っていない・今の画面の曲と違う曲が残っている時は、今の画面の曲へ（resume が終わる前に画面が変わった時）
function settleMusic() {
  if (!playing || current !== wanted) { current = null; startWanted(); }
}
// 音を起こして曲を整える。suspend がまだ終わっていなければ、終わるのを待ってから起こす（先に起こすと running に見えて空振りし、後から止まったままになる）
function wakeMusic(c) {
  const go = () => (away ? null : resumeCtx(c).then(settleMusic));
  Promise.resolve(pendingSuspend ? pendingSuspend.then(go) : go()).catch(() => {});
}
// 最初に画面に触れた時に音を起こす（スマホは触れるまで音を出せない）。触れるたびに試す（v44）：iPhone の 'interrupted'（電話・Siri・画面ロックの後）も、次に触れた時に起こす
export function unlockOnGesture(target) {
  const go = () => {
    const c = audio();
    if (!c) return;
    away = false; // 触れた＝画面は見えている
    wakeMusic(c);
  };
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) => target.addEventListener(ev, go, { passive: true }));
}
// 画面が裏へ回った（hidden＝true）・戻った（false）時に呼ぶ（v44・main.js の visibilitychange）：裏の間は曲の音を止める（suspend）。
// 戻ったら消音でなければ起こす（消音なら起こさない＝♪を鳴らす時に playMusic が起こす）。まだ触れていない（音が無い）時は何もしない
export function musicHidden(hidden) {
  away = !!hidden;
  const c = ctx;
  if (!c) return;
  if (away) {
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
  wakeMusic(c);
}
// 確かめ用：今の状態（鳴らしたい曲・鳴っている曲・音が起きているか）
export function musicState() {
  return { wanted, current, running: !!(ctx && ctx.state === 'running'), playing: !!playing, muted: isMuted(), away,
    level: playing && ctx ? levelNow(ctx) : null, waiting: !!(playing && playing.wait) };
}
