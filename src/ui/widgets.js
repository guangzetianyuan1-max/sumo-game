// src/ui/widgets.js — 字体・色・丸い箱・ボタン・字を枠に収める・保存の口
import { TYPE_IDS } from '../data/types.js?v=50';
import { HERO_IDS } from '../data/heroes.js?v=50';
import { heroArt } from '../core/foeart.js?v=50';
import { GUIDE_IDS } from '../data/guides.js?v=50';
import { HEYA_IDS } from '../data/heya.js?v=50';
import { t, getLang } from '../i18n/i18n.js?v=50';
import { jaWrap, jaWrapBalanced } from '../data/wrap.js?v=50';
import { WORD_IDS, wordArt, voiceSet, voiceKey, voicePath } from '../data/words.js?v=50';
import { TRAININGS } from '../core/career.js?v=50';
import { saveNow } from '../state.js?v=50';
import { playBout } from './sfx.js?v=50';
import { armOpenGuard, openGuarded } from './openguard.js?v=50';
export const FONT = '"M PLUS Rounded 1c", sans-serif';

// 夜の藍の地に、生成りの字・金の縁・朱の決め色（10/10 本人「色をおしゃれに」）
export const COLORS = {
  bg: '#141a2e', // 地（夜の藍）
  panel: 0x222b47, // 札の地
  panelOn: 0xc8553d, // 選んだ札（朱）
  ink: '#f6efe2', // 字（生成り）
  sub: '#b9b3a6', // 小さな字
  gold: '#e3c27a', // 見出し・縁
  frame: 0xe3c27a,
  button: 0xc8553d, // 決めのボタン（朱）
  buttonSub: 0x39436a, // もどる等
  empty: 0x1b2238, // 空いた枠
};

// 調子の色（疲れの目盛りと調子の字）：好調＝緑・普通＝金・不調＝赤・休場＝深い赤
export const CONDITION_COLOR = { good: 0x6fb26f, normal: 0xe3c27a, poor: 0xd9644a, out: 0xa8322d };
export const cssColor = (n) => `#${n.toString(16).padStart(6, '0')}`;

// 組ごとの色（和の色）
export const GROUP_COLOR = { kihon: 0xc8553d, kake: 0x4f8a68, nage: 0x3f6aa8, hineri: 0x8a6fb0, sori: 0xcf9a3c, tokushu: 0x6c7487 };

// 5タイプの絵を読み込む（場面ごとに呼んでよい・読み込み済みの鍵は Phaser が飛ばす）
export function preloadTypeArt(scene) {
  TYPE_IDS.forEach((id) => scene.load.image(`type-${id}`, `assets/types/${id}.png`));
}

// フィギュア風の主人公5人（10/12 夜）。届いていなければ type- のドットの絵で代える（heroKey）
export function preloadHeroFigures(scene) {
  HERO_IDS.forEach((id) => {
    const a = heroArt(id);
    if (!scene.textures.exists(a.key)) scene.load.image(a.key, a.path);
  });
}
export const heroKey = (scene, type) => (scene.textures.exists(heroArt(type).key) ? heroArt(type).key : `type-${type}`);

// 段階の光るオーラ（WebGL の時だけ・'rainbow' は色が回る）。color が無ければ何もしない
// 色が回る時だけ、その tween を返す（絵を消す前に止めたい呼び出し側用・それ以外は null）
export function addAura(scene, img, color) {
  if (!color || !img.preFX) return null;
  const glow = img.preFX.addGlow(color === 'rainbow' ? 0xff4d4d : color, 6, 0, false, 0.1, 16);
  if (color !== 'rainbow') return null;
  const o = { h: 0 };
  return scene.tweens.add({
    targets: o, h: 1, duration: 2400, repeat: -1,
    onUpdate: () => { glow.color = Phaser.Display.Color.HSVToRGB(o.h, 0.8, 1).color; },
  });
}

// 案内役の顔（通常）を読み込む
export function preloadGuideArt(scene) {
  GUIDE_IDS.forEach((id) => scene.load.image(`guide-${id}`, `assets/guides/${id}_normal.png`));
}

// 本人が Gemini で描いて少しずつ足す絵（決まり手の図解・稽古の絵）。あるものだけを <dir>/index.json（id の並び）に書く。
// 1段目＝目録を preload で読む／2段目＝create から目録にある絵だけを読む（無い絵を読みに行って 404 を出さない）
function preloadArtIndex(scene, key, dir) {
  if (!scene.cache.json.exists(key)) scene.load.json(key, `${dir}/index.json`);
}

function loadIndexedArt(scene, key, prefix, dir) {
  const ids = scene.cache.json.get(key);
  if (!Array.isArray(ids)) return;
  const todo = ids.filter((id) => typeof id === 'string' && !scene.textures.exists(`${prefix}${id}`));
  if (!todo.length) return;
  todo.forEach((id) => scene.load.image(`${prefix}${id}`, `${dir}/${id}.png`));
  scene.load.start();
}

// 決まり手の図解：絵の鍵は kim-<id>
export const preloadKimariteIndex = (scene) => preloadArtIndex(scene, 'kim-index', 'assets/kimarite');
export const loadKimariteArt = (scene) => loadIndexedArt(scene, 'kim-index', 'kim-', 'assets/kimarite');
// 稽古の絵：絵の鍵は train-<kind>
export const preloadTrainingIndex = (scene) => preloadArtIndex(scene, 'train-index', 'assets/training');
export const loadTrainingArt = (scene) => loadIndexedArt(scene, 'train-index', 'train-', 'assets/training');
// 効果文字（アニメの言葉の絵・10/11）：日本語＝assets/words/<id>.png・英語＝assets/words/en/<id>.png。絵の鍵は word-<言葉>-<id>
// 英語の絵が無い言葉は日本語の絵で代える（wordArt）。目録にある物だけ読む
export const preloadWordsIndex = (scene) => {
  preloadArtIndex(scene, 'word-index', 'assets/words');
  preloadArtIndex(scene, 'word-en-index', 'assets/words/en');
};
export function loadWordsArt(scene, lang) {
  const ja = scene.cache.json.get('word-index');
  const en = scene.cache.json.get('word-en-index');
  const todo = new Map();
  WORD_IDS.forEach((id) => {
    const art = wordArt(lang, id, ja, en);
    if (art && !scene.textures.exists(art.key)) todo.set(art.key, art.path);
  });
  if (!todo.size) return;
  todo.forEach((path, key) => scene.load.image(key, path));
  scene.load.start();
}
// 稽古の声：assets/voice/<言葉>/<タイプ>/train_<kind>.mp3。音の鍵は voice-<言葉>-<タイプ>-<kind>。使う組（voiceSet）の7つだけ読む
export const preloadVoiceIndex = (scene) => preloadArtIndex(scene, 'voice-index', 'assets/voice');
export function loadVoice(scene, lang, type) {
  const set = voiceSet(scene.cache.json.get('voice-index'), lang, type);
  if (!set) return null;
  const kinds = TRAININGS.filter((k) => !scene.cache.audio.exists(voiceKey(set, k)));
  if (kinds.length) {
    kinds.forEach((k) => scene.load.audio(voiceKey(set, k), voicePath(set, k)));
    scene.load.start();
  }
  return set;
}
// 親方の顔（本人の絵・10/11）：assets/guides/oyakata_<部屋の id>_<normal|shout|smile>.png。絵の鍵は oyakata-<id>-<顔>
export const OYAKATA_MOODS = ['normal', 'shout', 'smile'];
export function preloadOyakataArt(scene) {
  HEYA_IDS.forEach((id) => OYAKATA_MOODS.forEach((m) => scene.load.image(`oyakata-${id}-${m}`, `assets/guides/oyakata_${id}_${m}.png`)));
}

// 話す人の顔（四角 size×size の中に収める）。who＝娘の id（案内役の顔）か部屋の id（親方の顔・mood＝normal|shout|smile）。
// 親方の顔が読めなかった時は普通の顔、それも無ければ名前入りの丸い札で代える
export function speakerFace(scene, who, x, y, size, mood = 'normal') {
  const isHeya = HEYA_IDS.includes(who);
  // 親方は顔の下に小さく「親方」の札（10/11 本人）。全体の高さ size は変えず、顔をその分だけ小さくして上に寄せる
  const tagH = isHeya ? OYAKATA_TAG_H : 0;
  const face = size - tagH;
  const fy = y - tagH / 2;
  const objs = [];
  let key = isHeya ? `oyakata-${who}-${mood}` : `guide-${who}`;
  if (isHeya && !scene.textures.exists(key)) key = `oyakata-${who}-normal`;
  if (scene.textures.exists(key)) {
    const img = scene.add.image(x, fy, key);
    img.setScale(Math.min(face / img.width, face / img.height));
    objs.push(img);
  } else {
    const box = roundBox(scene, x, fy, face, face, COLORS.buttonSub, { radius: 22, stroke: COLORS.frame });
    const label = isHeya ? t(`heya.${who}.oyakata`) : t(`guide.${who}.name`);
    const text = scene.add.text(x, fy, label, textStyle(Math.max(28, Math.round(face / 5)), COLORS.ink, {
      align: 'center', wordWrap: { width: face - 16, useAdvancedWrap: true },
    })).setOrigin(0.5);
    fitText(text, face - 16);
    if (text.displayHeight > face - 16) text.setScale(text.scaleX * (face - 16) / text.displayHeight);
    objs.push(box, text);
  }
  if (isHeya) {
    const tag = scene.add.text(x, y + size / 2 - tagH / 2, t('oyakata.label'), textStyle(28, COLORS.gold)).setOrigin(0.5);
    objs.push(fitText(tag, size));
  }
  return objs;
}
const OYAKATA_TAG_H = 36; // 顔の下の「親方」の札の高さ（字28px）

// 吹き出しの字。日本語は行頭禁則つきで自分で折り（jaWrap）、英語は Phaser の折り返し。収まるまで字を一段ずつ小さくする
export function bubbleText(scene, x, y, str, inner, { size = 28, min = 28, lineSpacing = 4 } = {}) {
  const ja = getLang() === 'ja';
  const style = { fontStyle: '500', lineSpacing, ...(ja ? {} : { wordWrap: { width: inner.w, useAdvancedWrap: true } }) };
  const text = scene.add.text(x, y, str, textStyle(size, COLORS.ink, style)).setOrigin(0.5);
  const probe = ja ? scene.add.text(0, 0, '', textStyle(size, COLORS.ink, { fontStyle: '500' })).setVisible(false) : null;
  const set = (s) => {
    text.setFontSize(s);
    if (!ja) return;
    probe.setFontSize(s);
    text.setText(jaWrapBalanced(str, inner.w, (v) => {
      probe.setText(v);
      return probe.width;
    }, s / 2));
  };
  let s = size;
  set(s);
  while (text.height > inner.h && s > min) {
    s -= 2;
    set(s);
  }
  if (probe) probe.destroy();
  fitText(text, inner.w + 16); // 区切りの無い長い語が残っても枠の幅に収める（吹き出しの内側の余白 14 までは字がはみ出してよい＝行末の句読点のぶら下げで縮めない）
  if (text.displayHeight > inner.h) text.setScale(text.scaleX * inner.h / text.displayHeight); // 最後の守り
  return text;
}

// 折り返す字（真ん中そろえ・上の端が y）。日本語は行頭禁則つきで自分で折り、英語は Phaser の折り返し。maxW を越えない（長い語は縮める）
export function wrapText(scene, x, y, str, maxW, size, color, extra = {}) {
  const ja = getLang() === 'ja';
  const text = scene.add.text(x, y, str, textStyle(size, color, { align: 'center', lineSpacing: 4, ...extra, ...(ja ? {} : { wordWrap: { width: maxW, useAdvancedWrap: true } }) })).setOrigin(0.5, 0);
  if (ja) {
    const probe = scene.add.text(0, 0, '', textStyle(size, color, extra)).setVisible(false);
    const measure = (v) => {
      probe.setText(v);
      return probe.width;
    };
    // 2行以上になる時は行の長さをそろえる（最後の行に2〜3字だけ残さない）
    const wrapped = jaWrapBalanced(str, maxW, measure, size / 2);
    text.setText(wrapped);
    probe.destroy();
  }
  return fitText(text, maxW);
}

// 吹き出し（札の地・金の縁・左に顔へ向くしっぽ）。left,top,w,h の中に str を折り返し、収まるまで字を小さくする。部品の配列を返す
export function speechBubble(scene, left, top, w, h, str, { size = 28, min = 28 } = {}) {
  const cy = top + h / 2;
  const box = roundBox(scene, left + w / 2, cy, w, h, COLORS.panel, { radius: 22, stroke: COLORS.frame });
  const tail = scene.add.graphics();
  tail.fillStyle(COLORS.panel, 1);
  tail.fillTriangle(left + 3, cy - 12, left + 3, cy + 12, left - 14, cy);
  tail.lineStyle(3, COLORS.frame, 1);
  tail.lineBetween(left, cy - 12, left - 14, cy);
  tail.lineBetween(left - 14, cy, left, cy + 12);
  const text = bubbleText(scene, left + w / 2, cy, str, { w: w - 28, h: h - 20 }, { size, min, lineSpacing: 4 });
  return [box, tail, text];
}

// 丸みのある太字（本人 10/10「ドット字ではなく、少し丸みを帯びた字で」）。小さな補足の行だけ extra で fontStyle: '500'
export const textStyle = (size, color, extra = {}) => ({
  fontFamily: FONT, fontSize: size, fontStyle: '800', color, ...extra,
});

export function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// 字が maxW を越えたら縮める（英語の長いローマ字を四角に収める）
export function fitText(text, maxW) {
  if (text.width > maxW) text.setScale(maxW / text.width);
  return text;
}

// 角の丸い四角の輪郭の点（時計回り・角ごとに8刻み）
export function roundPoints(l, t, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  const pts = [];
  const corners = [[l + w - r, t + r, -Math.PI / 2], [l + w - r, t + h - r, 0], [l + r, t + h - r, Math.PI / 2], [l + r, t + r, Math.PI]];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (Math.PI / 2) * (i / 8);
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  }
  return pts;
}

// 角の丸い箱（やわらかい影つき）。Graphics を返す
export function roundBox(scene, x, y, w, h, fill, { radius = 18, stroke = null, strokeAlpha = 1, shadow = true } = {}) {
  const g = scene.add.graphics();
  if (shadow) {
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(x - w / 2, y - h / 2 + 4, w, h, radius);
  }
  g.fillStyle(fill, 1);
  // fillRoundedRect は三角形の継ぎ目にすき間ができ、下の影の黒が細い線で透ける（番付表で見えた）。
  // 四角と円を重ねて塗ると、薄く（setAlpha）した時に重なりが濃く見える（使い切った稽古の札で見えた）。
  // ⇒ 角を細かく刻んだ1枚の凸多角形で塗る（重なりもすき間も無い）
  g.fillPoints(roundPoints(x - w / 2, y - h / 2, w, h, radius), true);
  if (stroke !== null) {
    g.lineStyle(3, stroke, strokeAlpha);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  }
  return g;
}

// 見えない押し当たり
export function hitZone(scene, x, y, w, h) {
  // 描き直しや画面の切り替えで、止まったマウスの下に新しく置いた札は、マウスが動くまで押しても効かなかった
  // （10/10 本人のパソコンで稽古の札が2回目から効かない）⇒ マウスが止まっていても毎回当たりを調べ直す
  scene.input.setPollAlways();
  return scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
}

// 丸薬の形のボタン。sub を渡すと2行目（小さな字）が付く
// 2本の指で別々のボタンを同時にたたいた時、2つ目は数えない（画面の移り先が2つ重ならない）。同じボタンの2本の指は down で1回だけ
const MULTI_TAP_MS = 150;
const lastTap = new WeakMap(); // 画面 → { at, zone }

export function button(scene, x, y, w, h, label, onTap, { color = COLORS.button, size = 30, sub = null, subSize = 28 } = {}) {
  const gfx = roundBox(scene, x, y, w, h, color, { radius: h / 2, stroke: COLORS.frame });
  const zone = hitZone(scene, x, y, w, h);
  const text = scene.add.text(x, sub ? y - h * 0.2 : y, label, textStyle(size, COLORS.ink, { align: 'center' })).setOrigin(0.5);
  fitText(text, w - 36);
  if (sub) {
    const subText = scene.add.text(x, y + h * 0.22, sub, textStyle(subSize, COLORS.sub, { align: 'center', fontStyle: '500' })).setOrigin(0.5);
    fitText(subText, w - 36);
  }
  bindPress(scene, zone, gfx, () => {
    const prev = lastTap.get(scene), at = scene.time.now;
    if (prev && prev.zone !== zone && at - prev.at < MULTI_TAP_MS) return; // 別のボタンが今 押されたばかり
    lastTap.set(scene, { at, zone });
    playBout('pon'); // 画面を選ぶ小さな「ぽん」
    onTap();
  });
  return { box: zone, text };
}

// ボタンと札の押し（button と各画面の札が同じ物を使う）：
//   押しはこの当たりの上で始まったものだけ数える（外で押して滑り込んだ離しは無視）。
//   画面が開いた直後（openguard.js・ふつう 0.3秒）に始まった押しも数えない（前の画面の連打が、ここのボタンに落ちない・10/15 バグ出し）
export function bindPress(scene, zone, gfx, onUp) {
  armOpenGuard(scene);
  let down = false;
  zone.on('pointerdown', () => {
    if (openGuarded(scene)) return;
    down = true;
    gfx.setAlpha(0.8);
  });
  zone.on('pointerout', () => {
    down = false;
    gfx.setAlpha(1);
  });
  zone.on('pointerup', () => {
    gfx.setAlpha(1);
    if (!down) return;
    down = false;
    onUp();
  });
}

// 左上の「もどる」（10/11 本人「初め以外の画面に『戻る』を入れて、前の画面に戻ることができるように」）。
// どの画面でも同じ場所（左20・上20・150×56）。押した時の行き先は画面ごとに onTap で渡す（遊びの状態は戻さない）
export const BACK = { x: 20, y: 20, w: 150, h: 56 };
export const TOP_LEFT_FREE = BACK.x + BACK.w + 16; // 左上の「もどる」の右の端＋すき間＝上の段の字はここから右に置く

export function backButton(scene, onTap) {
  return button(scene, BACK.x + BACK.w / 2, BACK.y + BACK.h / 2, BACK.w, BACK.h, t('common.backTop'), onTap, { color: COLORS.buttonSub, size: 28 });
}

// 右上の「セーブ」（10/11 本人「セーブボタンを要所に入れて欲しい」）。「もどる」と左右対称（右20・上20・150×56）。
// 稽古・番付・取組の順・場所の結果の4つだけに置く。押すと今の記録（session.slot）へ書き、下に1.5秒だけ知らせる（自動の保存はそのまま）
export const SAVE = { right: 20, y: 20, w: 150, h: 56 };
export const TOP_RIGHT_FREE = SAVE.right + SAVE.w + 16; // 右上の「セーブ」の左の端＋すき間（画面の右からの幅）
const TOAST_MS = 1500;

export function saveButton(scene) {
  const { width } = scene.scale;
  const x = width - SAVE.right - SAVE.w / 2;
  return button(scene, x, SAVE.y + SAVE.h / 2, SAVE.w, SAVE.h, t('save.button'), () => showSaveToast(scene, saveNow()), { color: COLORS.buttonSub, size: 28 });
}

// 画面の下・大きなボタンのすぐ上に出す小さな札（押しても進まない時の理由の1行と同じ所）。
// ボタンのすぐ下に出すと場所の名に重なった（10/11 バグ出し）。もう一度押したら前の札は消して出し直す
function showSaveToast(scene, ok) {
  const { width } = scene.scale;
  const old = scene.saveToast;
  if (old) {
    old.timer.remove(false);
    old.objs.forEach((o) => o.destroy());
  }
  const D = 900;
  const cy = SAVE.y + SAVE.h + 36; // 「セーブ」のすぐ下（10/15 バグ出し：画面の下 1100 では番付の「遊び方」を隠した）
  const text = scene.add.text(width / 2, cy, t(ok ? 'save.done' : 'save.fail'), textStyle(28, ok ? COLORS.gold : COLORS.ink, { fontStyle: '500' }))
    .setOrigin(0.5).setDepth(D + 1);
  fitText(text, width - 2 * SAVE.right - 36);
  const w = text.displayWidth + 40;
  const box = roundBox(scene, width / 2, cy, w, 52, ok ? COLORS.panel : COLORS.panelOn, { radius: 26, stroke: COLORS.frame }).setDepth(D);
  const objs = [box, text];
  const timer = scene.time.delayedCall(TOAST_MS, () => {
    objs.forEach((o) => o.destroy());
    if (scene.saveToast && scene.saveToast.objs === objs) scene.saveToast = null;
  });
  scene.saveToast = { objs, timer };
}

// 画面の一番上の見出し：真ん中に置いて「もどる」に掛からなければそのまま。掛かる長さなら「もどる」の右から左そろえで置き、右の余白までに縮める。
// save＝右上に「セーブ」がある画面（左そろえの時の右の端を「セーブ」の左の手前までにする。真ん中の時は左右対称なので元から掛からない）
export function topTitle(scene, y, str, size, color, { save = false } = {}) {
  const { width } = scene.scale;
  const text = scene.add.text(width / 2, y, str, textStyle(size, color)).setOrigin(0.5);
  if (text.width <= (width / 2 - TOP_LEFT_FREE) * 2) return text;
  text.setOrigin(0, 0.5).setX(TOP_LEFT_FREE);
  return fitText(text, width - (save ? TOP_RIGHT_FREE : 30) - TOP_LEFT_FREE);
}

// 心・技・体の3本の横棒（金の棒＋暗い溝・値は 0〜100 で棒の長さ・右に数）。x,y は左上。使った高さを返す。
// ラベルの文は stat.shin / stat.gi / stat.tai（字 28：日本語は1字なので狭く、英語は Spirit が収まる幅）
// 天井の印の x（v47）：0〜100 で描いた棒（左の端 bx・幅 bw）の上で、天井 ceil がどこか。数でない・0以下は null（印を出さない）・100 より上は右の端
export function ceilMarkX(bx, bw, ceil) {
  if (!Number.isFinite(ceil) || ceil <= 0) return null;
  return bx + bw * Math.min(100, ceil) / 100;
}

// opts.ceil＝今の番付の天井（v47 本人「稽古のナビがまちまち」）：棒の上に細い縦の線（白・墨のふち）を出す＝100 で描いた棒の上で天井がどこか分かる
export function statBars(scene, x, y, w, stats, opts = {}) {
  const keys = ['shin', 'gi', 'tai'];
  const GOLD = 0xe3c27a;
  const track = (cx, cy, tw, th) => roundBox(scene, cx + tw / 2, cy, tw, th, 0x2f3858, { radius: th / 2, shadow: false });
  const fill = (cx, cy, tw, th, v) => {
    const fw = Math.max(th, tw * Math.max(0, Math.min(100, v)) / 100);
    return roundBox(scene, cx + fw / 2, cy, fw, th, GOLD, { radius: th / 2, shadow: false });
  };
  const ROWH = 44;
  const labelW = getLang() === 'ja' ? 64 : 124;
  const numW = 58;
  keys.forEach((k, i) => {
    const cy = y + i * ROWH + ROWH / 2;
    fitText(scene.add.text(x, cy, t(`stat.${k}`), textStyle(28, COLORS.ink)).setOrigin(0, 0.5), labelW - 6);
    const bx = x + labelW;
    const bw = w - labelW - numW;
    track(bx, cy, bw, 18);
    fill(bx, cy, bw, 18, stats[k]);
    const cx = ceilMarkX(bx, bw, opts && opts.ceil);
    if (cx !== null) scene.add.rectangle(cx, cy, 4, 32, 0xffffff, 1).setStrokeStyle(2, 0x141a2e, 1);
    scene.add.text(x + w, cy, String(Math.round(stats[k])), textStyle(28, COLORS.gold)).setOrigin(1, 0.5);
  });
  return ROWH * keys.length;
}

// 画面を描き直す前に、今の部品を全部こわす。⚠ this.children.removeAll(true) は「こわす」でなく「知らせを省く」の意味で、
// 見えない古い札や暗幕が押せる部品として裏に残り、押しを横取りしていた（10/11 稽古の札が効かない）
export function clearScene(scene) {
  scene.children.list.slice().forEach((o) => o.destroy());
}
