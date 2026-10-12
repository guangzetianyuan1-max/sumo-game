// src/ui/music.js — 音楽（2026-10-13 本人「今回の相撲のゲームは音楽にも力を入れたい」）。音のファイルは使わず、Web Audio でその場で合成して鳴らす（sfx.js と同じ流儀）
// 楽器：太鼓（どん・縁のかっ）・拍子木・笛・三味線・低音。曲は SONGS に「1拍＝4つの升」の譜で書く。曲はくり返す
// 音量の山は BGM 全体で 0.22 くらいに抑える（効果音 0.35 が上に乗っても割れない）。鳴らせない端末では何もしない
let ctx = null;
let broken = false;
let master = null;
let timer = null;
let playing = null; // { song, step, nextTime }
let wanted = null; // 今の画面で鳴らしたい曲（消している間・まだ触れていない間も覚えておく）
let current = null; // 今鳴っている曲

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

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function env(c, t0, dur, peak, attack = 0.005, release = null) {
  const g = c.createGain();
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
};

// ---- 1升ぶんの音を時刻 t に予約する（鳴らす時も書き出す時もこれ1つ）
function stepNotes(c, song, s, t) {
  const stepDur = 60 / song.bpm / 4, b = Math.floor(s / 16), i = s % 16;
  const tk = song.rhythm.taiko ? song.rhythm.taiko[b][i] : '.';
  if (tk === 'D') INSTR.taiko(c, t, 1);
  else if (tk === 'd') INSTR.taiko(c, t, 0.55);
  else if (tk === 'k') INSTR.rim(c, t, 1);
  if (song.rhythm.hyoshigi && song.rhythm.hyoshigi[b][i] === 'h') INSTR.hyoshigi(c, t, 1);
  for (const part of ['fue', 'shamisen', 'tsugaru', 'bass', 'lead']) {
    for (const [st, m, len, v = 1, slide = 0] of song[part] || []) if (st === s) INSTR[part](c, t, m, len * stepDur, v, slide);   // 4つ目＝強さ・5つ目＝すり上げ（何半音下から）
  }
}

// ---- 鳴らす（少し先までの音を予約していく）
const LOOKAHEAD = 0.15;
function schedule() {
  const c = ctx;
  if (!c || !playing) return;
  const { song } = playing;
  const stepDur = 60 / song.bpm / 4;
  const total = song.bars * 16;
  while (playing.nextTime < c.currentTime + LOOKAHEAD) {
    stepNotes(c, song, playing.step % total, playing.nextTime);
    playing.step++;
    playing.nextTime += stepDur;
  }
}

export function playMusic(id) {
  const c = audio();
  if (!c || !SONGS[id]) return false;
  if (c.state === 'suspended') c.resume();
  stopMusic();
  playing = { song: SONGS[id], step: 0, nextTime: c.currentTime + 0.08 };
  timer = setInterval(schedule, 25);
  schedule();
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
  if (c.state === 'suspended') c.resume();
  const t = c.currentTime + 0.05;
  if (name === 'taiko' || name === 'rim' || name === 'hyoshigi') INSTR[name](c, t, 1);
  else if (name === 'fue') INSTR.fue(c, t, 81, 1.2, 1);
  else if (name === 'shamisen') INSTR.shamisen(c, t, 62, 0.6, 1);
  else if (name === 'tsugaru') INSTR.tsugaru(c, t, 64, 0.6, 1.2, 2);
  else if (name === 'bass') INSTR.bass(c, t, 45, 0.6, 1);
  else if (name === 'lead') INSTR.lead(c, t, 76, 0.6, 1);
  return true;
}

// 曲を裏で音に書き出す（確かめ用・OfflineAudioContext）：{ peak, rms, buffer } を返す
export function renderSong(id, seconds) {
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
  for (let st = 0, t = 0.05; t < seconds - 0.5; st++, t += stepDur) stepNotes(oc, song, st % total, t);
  ctx = keep.ctx; master = keep.master; noiseBuf = keep.noiseBuf;
  return oc.startRendering().then((buffer) => {
    const d = buffer.getChannelData(0); let peak = 0, sum = 0;
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; }
    return { peak, rms: Math.sqrt(sum / d.length), buffer };
  });
}

// ---- ゲームの画面ごとの曲（10/13 本人「両方OK」「三味線も採用で」）。同じ曲の画面が続く間は止めずに流し続ける
export const SCENE_SONG = {
  guide: 'yagura', guidePick: 'yagura', setup: 'yagura', name: 'yagura',
  banzuke: 'yagura', schedule: 'yagura', result: 'yagura',
  learn: 'tsugaru', // 10/12 稽古の画面の代わりに、節目で技を覚える画面
  opponent: 'torikumi', strategy: 'torikumi', bout: 'torikumi',
};
const MUTE_KEY = 'sumo.music';

function store() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}
export function isMuted() {
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
  const s = store();
  try { if (s) s.setItem(MUTE_KEY, off ? 'off' : 'on'); } catch { /* 覚えられなくても鳴らす・止めるはする */ }
  if (off) { stopMusic(); current = null; } else startWanted();
}
// 最初に画面に触れた時に音を起こす（スマホは触れるまで音を出せない）
export function unlockOnGesture(target) {
  const go = () => {
    const c = audio();
    if (!c) return;
    const p = c.state === 'suspended' ? c.resume() : Promise.resolve();
    p.then(() => { if (!playing) { current = null; startWanted(); } }).catch(() => {});
  };
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) => target.addEventListener(ev, go, { passive: true }));
}
// 確かめ用：今の状態（鳴らしたい曲・鳴っている曲・音が起きているか）
export function musicState() {
  return { wanted, current, running: !!(ctx && ctx.state === 'running'), playing: !!playing, muted: isMuted() };
}
