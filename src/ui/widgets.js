// src/ui/widgets.js — 字体・色・丸い箱・ボタン・字を枠に収める・保存の口
import { TYPE_IDS } from '../data/types.js?v=16';
import { GUIDE_IDS } from '../data/guides.js?v=16';
import { HEYA_IDS } from '../data/heya.js?v=16';
import { t } from '../i18n/i18n.js?v=16';
import { listedWords, listedVoiceKinds } from '../data/words.js?v=16';
import { saveNow } from '../state.js?v=16';
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
// 効果文字（アニメの言葉の絵・10/11）：assets/words/<id>.png。絵の鍵は word-<id>（目録に書いた id のうち知っている物だけ読む）
export const preloadWordsIndex = (scene) => preloadArtIndex(scene, 'word-index', 'assets/words');
export function loadWordsArt(scene) {
  const ids = listedWords(scene.cache.json.get('word-index')).filter((id) => !scene.textures.exists(`word-${id}`));
  if (!ids.length) return;
  ids.forEach((id) => scene.load.image(`word-${id}`, `assets/words/${id}.png`));
  scene.load.start();
}
// 稽古の声：assets/voice/train_<kind>.mp3。音の鍵は voice-<kind>（目録にある物だけ読む）
export const preloadVoiceIndex = (scene) => preloadArtIndex(scene, 'voice-index', 'assets/voice');
export function loadVoice(scene) {
  const kinds = listedVoiceKinds(scene.cache.json.get('voice-index')).filter((k) => !scene.cache.audio.exists(`voice-${k}`));
  if (!kinds.length) return;
  kinds.forEach((k) => scene.load.audio(`voice-${k}`, `assets/voice/train_${k}.mp3`));
  scene.load.start();
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
  let key = isHeya ? `oyakata-${who}-${mood}` : `guide-${who}`;
  if (isHeya && !scene.textures.exists(key)) key = `oyakata-${who}-normal`;
  if (scene.textures.exists(key)) {
    const img = scene.add.image(x, y, key);
    img.setScale(Math.min(size / img.width, size / img.height));
    return [img];
  }
  const box = roundBox(scene, x, y, size, size, COLORS.buttonSub, { radius: 22, stroke: COLORS.frame });
  const label = isHeya ? t(`heya.${who}.oyakata`) : t(`guide.${who}.name`);
  const text = scene.add.text(x, y, label, textStyle(Math.round(size / 5), COLORS.ink, {
    align: 'center', wordWrap: { width: size - 16, useAdvancedWrap: true },
  })).setOrigin(0.5);
  fitText(text, size - 16);
  if (text.displayHeight > size - 16) text.setScale(text.scaleX * (size - 16) / text.displayHeight);
  return [box, text];
}

// 吹き出し（札の地・金の縁・左に顔へ向くしっぽ）。left,top,w,h の中に str を折り返し、収まるまで字を小さくする。部品の配列を返す
export function speechBubble(scene, left, top, w, h, str, { size = 26, min = 14 } = {}) {
  const cy = top + h / 2;
  const box = roundBox(scene, left + w / 2, cy, w, h, COLORS.panel, { radius: 22, stroke: COLORS.frame });
  const tail = scene.add.graphics();
  tail.fillStyle(COLORS.panel, 1);
  tail.fillTriangle(left + 3, cy - 12, left + 3, cy + 12, left - 14, cy);
  tail.lineStyle(3, COLORS.frame, 1);
  tail.lineBetween(left, cy - 12, left - 14, cy);
  tail.lineBetween(left - 14, cy, left, cy + 12);
  const inner = { w: w - 28, h: h - 20 };
  let s = size;
  const text = scene.add.text(left + w / 2, cy, str, textStyle(s, COLORS.ink, {
    fontStyle: '500', lineSpacing: 4, wordWrap: { width: inner.w, useAdvancedWrap: true },
  })).setOrigin(0.5);
  while (text.height > inner.h && s > min) {
    s -= 2;
    text.setFontSize(s);
  }
  fitText(text, inner.w);
  if (text.displayHeight > inner.h) text.setScale(text.scaleX * inner.h / text.displayHeight); // 最後の守り
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
function roundPoints(l, t, w, h, radius) {
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
export function button(scene, x, y, w, h, label, onTap, { color = COLORS.button, size = 30, sub = null, subSize = 24 } = {}) {
  const gfx = roundBox(scene, x, y, w, h, color, { radius: h / 2, stroke: COLORS.frame });
  const zone = hitZone(scene, x, y, w, h);
  const text = scene.add.text(x, sub ? y - h * 0.2 : y, label, textStyle(size, COLORS.ink, { align: 'center' })).setOrigin(0.5);
  fitText(text, w - 48);
  if (sub) {
    const subText = scene.add.text(x, y + h * 0.22, sub, textStyle(subSize, COLORS.sub, { align: 'center', fontStyle: '500' })).setOrigin(0.5);
    fitText(subText, w - 48);
  }
  // 押しはこのボタンの上で始まったものだけ数える（外で押して滑り込んだ離しは無視）
  let down = false;
  zone.on('pointerdown', () => {
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
    onTap();
  });
  return { box: zone, text };
}

// 左上の「もどる」（10/11 本人「初め以外の画面に『戻る』を入れて、前の画面に戻ることができるように」）。
// どの画面でも同じ場所（左20・上20・150×56）。押した時の行き先は画面ごとに onTap で渡す（遊びの状態は戻さない）
export const BACK = { x: 20, y: 20, w: 150, h: 56 };
export const TOP_LEFT_FREE = BACK.x + BACK.w + 16; // 左上の「もどる」の右の端＋すき間＝上の段の字はここから右に置く

export function backButton(scene, onTap) {
  return button(scene, BACK.x + BACK.w / 2, BACK.y + BACK.h / 2, BACK.w, BACK.h, t('common.backTop'), onTap, { color: COLORS.buttonSub, size: 24 });
}

// 右上の「セーブ」（10/11 本人「セーブボタンを要所に入れて欲しい」）。「もどる」と左右対称（右20・上20・150×56）。
// 稽古・番付・取組の順・場所の結果の4つだけに置く。押すと今の記録（session.slot）へ書き、下に1.5秒だけ知らせる（自動の保存はそのまま）
export const SAVE = { right: 20, y: 20, w: 150, h: 56 };
export const TOP_RIGHT_FREE = SAVE.right + SAVE.w + 16; // 右上の「セーブ」の左の端＋すき間（画面の右からの幅）
const TOAST_MS = 1500;

export function saveButton(scene) {
  const { width } = scene.scale;
  const x = width - SAVE.right - SAVE.w / 2;
  return button(scene, x, SAVE.y + SAVE.h / 2, SAVE.w, SAVE.h, t('save.button'), () => showSaveToast(scene, saveNow()), { color: COLORS.buttonSub, size: 24 });
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
  const cy = 1100;
  const text = scene.add.text(width / 2, cy, t(ok ? 'save.done' : 'save.fail'), textStyle(26, ok ? COLORS.gold : COLORS.ink, { fontStyle: '500' }))
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
// compact＝3本を横に1列に並べた小さい版（取組の画面用）。ラベルの文は stat.shin / stat.gi / stat.tai
export function statBars(scene, x, y, w, stats, { compact = false } = {}) {
  const keys = ['shin', 'gi', 'tai'];
  const GOLD = 0xe3c27a;
  const track = (cx, cy, tw, th) => roundBox(scene, cx + tw / 2, cy, tw, th, 0x2f3858, { radius: th / 2, shadow: false });
  const fill = (cx, cy, tw, th, v) => {
    const fw = Math.max(th, tw * Math.max(0, Math.min(100, v)) / 100);
    return roundBox(scene, cx + fw / 2, cy, fw, th, GOLD, { radius: th / 2, shadow: false });
  };
  if (compact) {
    const col = w / 3;
    const size = 18;
    keys.forEach((k, i) => {
      const cx = x + i * col;
      const label = scene.add.text(cx, y, t(`stat.${k}`), textStyle(size, COLORS.ink)).setOrigin(0, 0);
      fitText(label, col * 0.5);
      scene.add.text(cx + col - 10, y, String(Math.round(stats[k])), textStyle(size, COLORS.gold)).setOrigin(1, 0);
      track(cx, y + 30, col - 10, 10);
      fill(cx, y + 30, col - 10, 10, stats[k]);
    });
    return 38;
  }
  const ROWH = 44;
  const labelW = 96;
  const numW = 46;
  keys.forEach((k, i) => {
    const cy = y + i * ROWH + ROWH / 2;
    fitText(scene.add.text(x, cy, t(`stat.${k}`), textStyle(26, COLORS.ink)).setOrigin(0, 0.5), labelW - 6);
    const bx = x + labelW;
    const bw = w - labelW - numW;
    track(bx, cy, bw, 18);
    fill(bx, cy, bw, 18, stats[k]);
    scene.add.text(x + w, cy, String(Math.round(stats[k])), textStyle(26, COLORS.gold)).setOrigin(1, 0.5);
  });
  return ROWH * keys.length;
}

// 画面を描き直す前に、今の部品を全部こわす。⚠ this.children.removeAll(true) は「こわす」でなく「知らせを省く」の意味で、
// 見えない古い札や暗幕が押せる部品として裏に残り、押しを横取りしていた（10/11 稽古の札が効かない）
export function clearScene(scene) {
  scene.children.list.slice().forEach((o) => o.destroy());
}
