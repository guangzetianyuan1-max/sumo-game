// src/ui/cutinband.js — カットインの帯の絵（20体版 Task 5 の KamiScene から切り出した・10/14 稽古の決め技の習得でも使う）
// 横長の帯：左に主人公の顔（src/core/cutin.js の表情）・右に大きな字（と小さな2行目）。左から滑り込む。
// 消す時間・たたいて閉じるは呼ぶ側（取組＝KamiScene・稽古の結果＝DrillScene）が持つ。返すのは帯の container
import { cutinArt } from '../core/cutin.js?v=36';
import { textStyle, fitText, COLORS } from './widgets.js?v=36';

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
    c.add(img);
  }
  const big = scene.add.text(box.textX, line2 ? box.y - 30 : box.y, line1, textStyle(line2 ? 76 : 84, COLORS.gold, { stroke: '#141a2e', strokeThickness: 10 })).setOrigin(0.5);
  c.add(fitText(big, box.textW));
  if (line2) c.add(fitText(scene.add.text(box.textX, box.y + 58, line2, textStyle(40, COLORS.ink, { stroke: '#141a2e', strokeThickness: 6 })).setOrigin(0.5), box.textW));
  c.x = -width;
  scene.tweens.add({ targets: c, x: 0, duration: 140, ease: 'Cubic.easeOut' });
  return c;
}
