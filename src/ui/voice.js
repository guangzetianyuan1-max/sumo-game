// src/ui/voice.js — 取組の声を鳴らす（どの声をいつ・重ならない決まりは src/core/voice.js・ここは Phaser の音に渡すだけ）
// 声の並びはゲーム全体で1つ（取組の画面の勝ちの声が、次の画面へ変わってもそのまま最後まで鳴る・行司の声も同じ並びで重ならない）
// 鳴らせない所（音が出ない端末・♪を消した時・声が読めていない時）は何もしない。遊びは止めない
import { getLang } from '../i18n/i18n.js?v=56';
import { isMuted } from './music.js?v=56';
import { hushVoices } from '../core/gyoji.js?v=56';
import { voiceFile, voiceLen, voiceKey, voiceVolume, boutVoiceIds, afterVoiceIds, linesFor, newVoiceQueue, claimVoice, releaseVoice, offerVoices, nextVoice, clearVoices } from '../core/voice.js?v=56';

export { boutVoiceIds, afterVoiceIds, linesFor };
const states = new WeakMap(); // game → { q, sounds, hooked }
const nowSec = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

function stateOf(game) {
  let s = states.get(game);
  if (!s) { s = { q: newVoiceQueue(), sounds: [] }; states.set(game, s); }
  return s;
}

// 画面が始まる前（preload）に、使う声だけ読む（今の言葉に無い声は読まない）
export function preloadVoices(scene, ids) {
  const lang = getLang();
  (ids || []).forEach((id) => {
    const file = voiceFile(id, lang);
    const key = voiceKey(id, lang);
    if (file && !scene.cache.audio.exists(key)) scene.load.audio(key, file);
  });
}

function playItem(scene, s, item) {
  try {
    if (!scene.cache.audio.exists(item.key)) return false; // 読めていない＝黙る
    const snd = scene.sound.add(item.key, { volume: item.volume });
    snd.play();
    s.sounds.push(snd);
    while (s.sounds.length > 3) { const old = s.sounds.shift(); try { old.destroy(); } catch { /* 片付けられなくても遊びは続ける */ } }
    return true;
  } catch {
    return false;
  }
}

// 毎コマ（ゲーム全体の poststep）：♪を消した＝止めて並びも空に・終わった声の次を鳴らす
function tick(game, scene) {
  const s = stateOf(game);
  if (isMuted()) {
    if (s.sounds.length) s.sounds = hushVoices(s.sounds);
    clearVoices(s.q);
    return;
  }
  const item = nextVoice(s.q, nowSec());
  if (item) playItem(scene, s, item);
}

function hook(scene) {
  const s = stateOf(scene.game);
  if (s.hooked) return;
  s.hooked = true;
  scene.game.events.on('poststep', () => tick(scene.game, scene));
}

const usable = (scene) => !!scene && !!scene.sound && !scene.sound.noAudio && !isMuted();

// 出来事の声を鳴らしたい（event＝core/voice.js の出来事・ctx.big など）。鳴らせた（または待つ）なら true
// opts.preempt＝勝ち負けの声：鳴っている声を止めて、すぐ鳴らす
export function sayVoice(scene, event, ctx = {}, opts = {}) {
  if (!usable(scene)) return false;
  const lang = getLang();
  const ids = linesFor(event, lang, ctx);
  const items = ids.map((id) => ({ id, len: voiceLen(id, lang), key: voiceKey(id, lang), volume: voiceVolume(id) })).filter((x) => scene.cache.audio.exists(x.key));
  if (!items.length) return false;
  hook(scene);
  const s = stateOf(scene.game);
  if (opts.preempt) s.sounds = hushVoices(s.sounds);
  const r = offerVoices(s.q, nowSec(), items, undefined, { preempt: !!opts.preempt });
  if (r.action === 'play') playItem(scene, s, r.item);
  return r.action !== 'drop';
}

// 別の仕組み（行司の声）が鳴らす前に、声の枠を取る。空いていれば、ふさいだ終わりの時刻を返す（len 秒ふさぐ）・埋まっていれば null（待たない・鳴らさない）
export function claimVoiceSlot(scene, len) {
  if (!usable(scene)) return null;
  return claimVoice(stateOf(scene.game).q, nowSec(), len);
}

// 取っていた枠を返す（その声を止めた時）
export function releaseVoiceSlot(scene, until) {
  if (!scene || !scene.game) return;
  releaseVoice(stateOf(scene.game).q, nowSec(), until);
}

// 全部止める（画面を離れる時）
export function hushGameVoices(scene) {
  if (!scene || !scene.game) return;
  const s = stateOf(scene.game);
  s.sounds = hushVoices(s.sounds);
  clearVoices(s.q);
}
