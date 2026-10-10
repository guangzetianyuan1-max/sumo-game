// src/ui/widgets.js — 字体・色・丸い箱・ボタン・字を枠に収める・保存の口
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

// 角の丸い箱（やわらかい影つき）。Graphics を返す
export function roundBox(scene, x, y, w, h, fill, { radius = 18, stroke = null, strokeAlpha = 1, shadow = true } = {}) {
  const g = scene.add.graphics();
  if (shadow) {
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(x - w / 2, y - h / 2 + 4, w, h, radius);
  }
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  if (stroke !== null) {
    g.lineStyle(3, stroke, strokeAlpha);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  }
  return g;
}

// 見えない押し当たり
export function hitZone(scene, x, y, w, h) {
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
