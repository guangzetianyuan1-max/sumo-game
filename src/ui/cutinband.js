// src/ui/cutinband.js — カットインの帯の絵（20体版 Task 5 の KamiScene から切り出した・10/14 稽古の決め技の習得でも使う）
// 横長の帯：左に主人公の顔（src/core/cutin.js の表情）・右に大きな字（と小さな2行目）。左から滑り込む。
// 消す時間・たたいて閉じるは呼ぶ側（取組＝KamiScene・稽古の結果＝DrillScene）が持つ。返すのは帯の container
import { cutinArt } from '../core/cutin.js?v=44';
import { textStyle, fitText, COLORS } from './widgets.js?v=44';

// box＝{ y, h, faceX, faceH, textX, textW }（帯の真ん中の高さ・帯の高さ・顔の x と高さ・字の真ん中の x と幅）
export function drawCutinBand(scene, box, name, line1, line2 = '', depth = 20) {
  const { width } = scene.scale;
  const c = scene.add.container(0, 0).setDepth(depth);
  const top = box.y - box.h / 2;
  c.add(scene.add.rectangle(width / 2, box.y, width, box.h, 0x141a2e, 0.9));
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.06); // 斜めの流れ線
  for (let x = -box.h; x < width; x += 70) g.fillTriangle(x, top + box.h, x + 26, top + box.h, x + box.h + 26, top);
  g.fillStyle(0xe3c27a, 1).fillRect(0, top - 3, width, 6).fillRect(0, top + box.h - 3, width, 6);
  c.add(g);
  const art = cutinArt(name);
  if (scene.textures.exists(art.key)) {
    const img = scene.add.image(box.faceX, top + box.h, art.key).setOrigin(0.5, 1);
    img.setScale(box.faceH / img.height);
    if (box.keepFace) img.x = Math.max(box.faceX, img.displayWidth / 2); // 顔の絵の左の端を画面の中に（稽古の習得）
    c.add(img);
  }
  const big = scene.add.text(box.textX, line2 ? box.y - 30 : box.y, line1, textStyle(line2 ? 76 : 84, COLORS.gold, { stroke: '#141a2e', strokeThickness: 10 })).setOrigin(0.5);
  c.add(fitText(big, box.textW));
  if (line2) c.add(fitText(scene.add.text(box.textX, box.y + 58, line2, textStyle(40, COLORS.ink, { stroke: '#141a2e', strokeThickness: 6 })).setOrigin(0.5), box.textW));
  c.x = -width;
  scene.tweens.add({ targets: c, x: 0, duration: 140, ease: 'Cubic.easeOut' });
  return c;
}

// ---- 取組の必殺技のカットイン（v42 第2段・本人「目の帯で」）----
// 目の帯：上の線・目の帯の絵（720×200＝画面の幅いっぱい・tools/prep_eyes.py）・その下に技の名前（と小さな2行目）の墨の帯・下の線。左から滑り込む。
// box＝{ top（上の線の y）, eyeH（目の帯の高さ）, stripH（名前の帯の高さ）, textL（字の左の端・既定 0＝真ん中。相手の帯は左端のバーを避ける）}・
//   eyeKey＝目の帯の絵の鍵（null・読めない＝名前の帯だけ）・accent＝線の色（主人公＝金・相手＝赤）
// 字は 28 以上・縁取り（drawCutinBand と同じ決まり）。深さ 20（drawCutinBand と同じ）。返すのは container（消す時間・たたいて閉じるは呼ぶ側）
export function drawEyeBand(scene, box, eyeKey, name, sub = '', { accent = 0xe3c27a, depth = 20 } = {}) {
  const { width } = scene.scale;
  const c = scene.add.container(0, 0).setDepth(depth);
  const eyeTop = box.top + 6;
  const stripTop = eyeTop + box.eyeH;
  const bottom = stripTop + box.stripH;
  c.add(scene.add.rectangle(width / 2, (box.top + bottom) / 2, width, bottom - box.top, 0x141a2e, 0.92));
  if (eyeKey && scene.textures.exists(eyeKey)) {
    const img = scene.add.image(width / 2, eyeTop, eyeKey).setOrigin(0.5, 0);
    img.setDisplaySize(width, box.eyeH);
    c.add(img);
  }
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.06); // 斜めの流れ線（名前の帯）
  for (let x = -box.stripH; x < width; x += 70) g.fillTriangle(x, bottom, x + 26, bottom, x + box.stripH + 26, stripTop);
  g.fillStyle(accent, 1).fillRect(0, box.top, width, 6).fillRect(0, stripTop - 2, width, 4).fillRect(0, bottom, width, 6);
  c.add(g);
  const nameY = sub ? stripTop + box.stripH * 0.4 : stripTop + box.stripH / 2;
  const textL = box.textL || 0;
  const textX = (textL + width) / 2, textW = width - textL - (textL ? 20 : 60);
  c.add(fitText(scene.add.text(textX, nameY, name, textStyle(sub ? 58 : 64, COLORS.gold, { stroke: '#141a2e', strokeThickness: 10 })).setOrigin(0.5), textW));
  if (sub) c.add(fitText(scene.add.text(textX, stripTop + box.stripH * 0.8, sub, textStyle(30, COLORS.ink, { stroke: '#141a2e', strokeThickness: 6 })).setOrigin(0.5), textW));
  c.x = -width;
  scene.tweens.add({ targets: c, x: 0, duration: 140, ease: 'Cubic.easeOut' });
  return c;
}

// 漫画の絵（破いたページの1コマ・tools/prep_manga.py）：少し傾けて、大きめから「どん」と縮んで止まる。読めない＝null
// pos＝{ x, y（真ん中）, w（幅）, angle（度）}
export function drawManga(scene, key, pos, depth = 20) {
  if (!key || !scene.textures.exists(key)) return null;
  const img = scene.add.image(pos.x, pos.y, key).setDepth(depth).setAngle(pos.angle || 0);
  const s = pos.w / img.width;
  img.setScale(s * 1.3).setAlpha(0);
  scene.tweens.add({ targets: img, scale: s, alpha: 1, duration: 170, ease: 'Back.easeOut' });
  return img;
}
