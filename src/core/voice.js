// src/core/voice.js — 取組の声を「いつ・どの声を・どの言葉で・重ならずに」鳴らすかだけを決める（音の再生と日本語の字は持たない・再生は src/ui/voice.js）
// 声は一度に1つ：鳴っている間に来た声は、残りが WAIT 秒以内なら待って鳴らし、それより長ければ捨てる。行司の声（gyoji.js）も同じ並びを使う
// 鳴らす声の持ち主は、主人公（録り済みの稽古の声）・ことね（若女将）・親方。ファイルが無い言葉（英語のことね・親方）は鳴らさない
export const VOICE = {
  base: 0.7, // 声の基本の大きさ（行司の声 0.9 より控えめ）
  quietGain: 1.4, // ことねの声は録りが約 3 dB 小さい＝その分だけ上げる（約 2.9 dB）。上げても 1 を超えない
  wait: 0.6, // 鳴っている声の残りがこの秒数以内なら、次の声は待って鳴らす（それより長ければ捨てる）
  gap: 0.12, // 声と声の間の空き（秒）
};

const H = (dir) => `assets/voice/${dir}`;
// 声の目録：id → { ja・en＝ファイル（無い言葉は鳴らさない）, len＝声の長さ（秒）, quiet＝録りが小さい声 }
// len は ffprobe で測った長さ。ごっつあんです（ja）は稽古の声の後ろ 1 秒余りに短い雑音（約 1.95〜2.05 秒）があるので、1.0 秒で切って終わりを消した写し game/hero_win_ja.mp3 を使う（稽古の元ファイルはそのまま）
export const LINES = {
  heroWin: { ja: `${H('game')}/hero_win_ja.mp3`, en: `${H('game')}/hero_en_thanks.mp3`, len: { ja: 1.0, en: 0.87 } },
  heroFinisher: { ja: `${H('ja')}/balance/train_waza.mp3`, en: `${H('en')}/balance/train_waza.mp3`, len: { ja: 3.0, en: 0.56 } },
  heroTachiai: { ja: `${H('ja')}/balance/train_butsukari.mp3`, en: `${H('en')}/balance/train_butsukari.mp3`, len: { ja: 1.32, en: 1.34 } },
  heroLoss: { ja: `${H('ja')}/balance/train_moushiai.mp3`, en: `${H('en')}/balance/train_moushiai.mp3`, len: { ja: 2.22, en: 1.02 } },
  kotoneYatta: { ja: `${H('game')}/kotone_yatta.mp3`, len: { ja: 1.25 }, quiet: true },
  kotoneNice: { ja: `${H('game')}/kotone_nice.mp3`, len: { ja: 1.25 }, quiet: true },
  kotoneTsugi: { ja: `${H('game')}/kotone_tsugi.mp3`, len: { ja: 1.35 }, quiet: true },
  oyakataYoku: { ja: `${H('game')}/oyakata_yoku.mp3`, len: { ja: 1.29 } },
  oyakataBanzuke: { ja: `${H('game')}/oyakata_banzuke.mp3`, len: { ja: 3.84 } },
};

// 出来事ごとの声（順に鳴る）。昇進＝親方の2言・負けた後＝ことねの1言（親方の「まだまだ」は使わない＝いつも同じ人が励ます）
const EVENTS = {
  win: ['heroWin'], // 大きな勝ちは続けてことね（下の linesFor）
  finisher: ['heroFinisher'], // ◎の決め技
  tachiai: ['heroTachiai'], // 立ち合いの◎
  loss: ['heroLoss'],
  brace: ['kotoneNice'], // 守りのバーのこらえ成功
  promoted: ['oyakataYoku', 'oyakataBanzuke'], // 取組の後の画面・昇進
  afterLoss: ['kotoneTsugi'], // 取組の後の画面・負け
};

export const voiceFile = (id, lang) => (LINES[id] && LINES[id][lang]) || null;
export const voiceLen = (id, lang) => (LINES[id] && LINES[id].len && LINES[id].len[lang]) || 0;
export const voiceKey = (id, lang) => `gv-${lang}-${id}`;
export const voiceVolume = (id) => Math.min(1, VOICE.base * (LINES[id] && LINES[id].quiet ? VOICE.quietGain : 1));

// 出来事（win・finisher・tachiai・loss・brace・promoted・afterLoss）→ 鳴らす声の id の並び。ctx.big＝大きな勝ち（座布団の条件）。その言葉にファイルが無い声は除く
export function linesFor(event, lang, ctx = {}) {
  const ids = (EVENTS[event] || []).slice();
  if (event === 'win' && ctx.big) ids.push('kotoneYatta');
  return ids.filter((id) => !!voiceFile(id, lang));
}

// 〇の判定（kami.js の st.lastRing）→ 出来事。◎（judge 2）だけ・届かなかった物は無し
export function ringEvent(r) {
  if (!r || r.side !== 'east' || r.judge !== 2 || r.reach === false) return null;
  return r.kind === 'kime' ? 'finisher' : r.kind === 'tachiai' ? 'tachiai' : null;
}

// 取組の画面が読んでおく声（今の言葉の物だけ）／取組の後の画面（lb＝session.lastBout）が読んでおく声
const uniq = (a) => [...new Set(a)];
export const boutVoiceIds = (lang) => uniq(['win', 'finisher', 'tachiai', 'loss', 'brace'].flatMap((e) => linesFor(e, lang, { big: true })));
export function afterVoiceIds(lang, lb) {
  if (!lb) return [];
  return linesFor(lb.won ? (lb.promoted ? 'promoted' : '') : 'afterLoss', lang);
}

// ---- 声の並び（時刻 now は実の秒） ----
export const newVoiceQueue = () => ({ until: -Infinity, pending: [] });

// 声の枠だけ取る（行司など、別の仕組みで鳴らす声用）：空いていれば len 秒ふさいで、ふさいだ終わりの時刻を返す・埋まっていれば null（待たない）
export function claimVoice(q, now, len) {
  if (now < q.until || q.pending.length) return null;
  q.until = now + len;
  return q.until;
}

// 取っていた枠を返す（行司の声を途中で止めた時）：まだその枠のまま（その後に別の声が枠を取り直していない）なら、今で空ける
export function releaseVoice(q, now, until) {
  if (Number.isFinite(until) && q.until === until) q.until = Math.min(q.until, now);
  return q;
}

// 声（items＝{ id, len, … } の並び）を鳴らしたい。返す action：'play'（先頭を今すぐ鳴らす・続きは先頭の後に待つ）・'wait'（残りが wait 秒以内＝終わったら鳴らす）・'drop'（捨てる）
// 待っている声がある間に来た物は捨てる（溜めない）。opts.preempt＝勝ち負けの声：鳴っている声・待っている声を押しのけて、今すぐ鳴らす（呼ぶ側が鳴っている音を止める）
export function offerVoices(q, now, items, wait = VOICE.wait, opts = {}) {
  if (!items || !items.length) return { action: 'drop' };
  if (opts.preempt) { q.until = -Infinity; q.pending = []; }
  if (q.pending.length) return { action: 'drop' };
  const busy = Math.max(0, q.until - now);
  if (busy > wait) return { action: 'drop' };
  const [head, ...rest] = items;
  q.pending = rest.map((x) => ({ ...x }));
  if (busy === 0) { q.until = now + head.len + VOICE.gap; return { action: 'play', item: head }; }
  q.pending.unshift({ ...head });
  return { action: 'wait' };
}

// 毎コマ：終わった声の次（待っている物）を返す（無ければ null）
export function nextVoice(q, now) {
  if (!q.pending.length || now < q.until) return null;
  const item = q.pending.shift();
  q.until = now + item.len + VOICE.gap;
  return item;
}

// 全部止める（♪を消した時）
export function clearVoices(q) {
  q.until = -Infinity;
  q.pending = [];
  return q;
}
