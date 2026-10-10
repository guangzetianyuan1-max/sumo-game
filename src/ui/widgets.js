// src/ui/widgets.js — 字体・色・丸い箱・ボタン・字を枠に収める・保存の口
import { TYPE_IDS } from '../data/types.js?v=11';
import { GUIDE_IDS } from '../data/guides.js?v=11';
import { t } from '../i18n/i18n.js?v=11';
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
