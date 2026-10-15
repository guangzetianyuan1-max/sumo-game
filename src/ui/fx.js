// src/ui/fx.js — 勝ちの手ごたえの演出の部品（10/15 本人「勝っても気持ちよくない」・設計書 2026-10-14-sumo-one-button-ring-bar-design.md §12）
// 白い一瞬の光（flash）・画面の揺れ（shake）・紙の土ぼこり（dust）・座布団（zabuton）・負けの暗がり（dim）。新しい絵は使わず、図形で描く
// いつ・どれだけ出すかは src/core/feel.js（純粋な関数）が決める。ここは描くだけ。粒の動きは update(dt) に渡された秒で進む
// （取組の画面はスローの間は遅くした秒を渡す＝土ぼこりもゆっくり舞う）
const DEPTH = { dim: 4, dust: 4.5, zabuton: 8, flash: 30 }; // ボタン（5）の下に土ぼこり・暗がり／座布団はボタンの上・勝ち負けの字（10）とカットインの帯（20）の下／光はいちばん上
const MAX_FLASH = 0.5; // 白い光の濃さの上限（強すぎない）
const MAX_SHAKE_MS = 200; // 揺れの長さの上限
const DUST_COLORS = [0xe8d6a6, 0xd9c08a, 0xf3ead2, 0xb9a27a]; // 紙と箱の土ぼこり（明るい）
const DUST_DARK = [0x8a7a62, 0x6e604c, 0x9a8a70]; // 負けた時は暗めに
const ZABUTON = [[0x7a2e45, 0xe0b0bd], [0x5b3a7a, 0xc9b3e0], [0x2f4f7a, 0xb3c9e0], [0x8a5a2b, 0xe8c99a]]; // 座布団の色と、ふちの色
const ZAB_G = 2200; // 座布団の重さ（px/秒²）

export function createFx(scene) {
  const { width, height } = scene.scale;
  const low = scene.add.graphics().setDepth(DEPTH.dust);
  const high = scene.add.graphics().setDepth(DEPTH.zabuton);
  const white = scene.add.rectangle(-80, -80, width + 160, height + 160, 0xffffff, 1).setOrigin(0, 0).setDepth(DEPTH.flash).setAlpha(0).setVisible(false);
  const dark = scene.add.rectangle(-80, -80, width + 160, height + 160, 0x000000, 1).setOrigin(0, 0).setDepth(DEPTH.dim).setAlpha(0).setVisible(false);
  let parts = [];
  let alive = true;
  const rand = (a, b) => a + Math.random() * (b - a);

  const fx = {
    // 白い一瞬の光（1回・すぐ消える）
    flash(alpha) {
      const a = Math.min(MAX_FLASH, alpha > 0 ? alpha : 0);
      if (!alive || !a) return;
      scene.tweens.killTweensOf(white);
      white.setVisible(true).setAlpha(a);
      scene.tweens.add({ targets: white, alpha: 0, duration: 170, ease: 'Quad.Out', onComplete: () => white.setVisible(false) });
    },
    // 画面の揺れ（数px・0.2秒以内）。カメラの揺れは描く所だけずらす（指の場所は変わらない）
    shake(px, secs) {
      if (!alive || !(px > 0)) return;
      const ms = Math.min(MAX_SHAKE_MS, Math.max(0, secs * 1000));
      scene.cameras.main.shake(ms, new Phaser.Math.Vector2(px / width, px / height), true);
    },
    // 負けた時の暗がり（alpha まで ms で暗く・0 で戻す）
    dim(alpha, ms = 200) {
      if (!alive) return;
      scene.tweens.killTweensOf(dark);
      dark.setVisible(true);
      scene.tweens.add({ targets: dark, alpha: Math.max(0, Math.min(0.5, alpha)), duration: ms, onComplete: () => { if (dark.alpha <= 0) dark.setVisible(false); } });
    },
    // 紙の土ぼこり：着地した所から左右へ広がる丸いもや＋紙の小さなかけら
    dust(x, y, { n = 12, dark: isDark = false } = {}) {
      if (!alive) return;
      const cols = isDark ? DUST_DARK : DUST_COLORS;
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        parts.push({ kind: 'puff', x: x + rand(-20, 20), y: y - rand(0, 10), vx: side * rand(60, 220), vy: -rand(20, 90), r: rand(10, 18), grow: rand(30, 60), age: 0, life: rand(0.45, 0.7), color: cols[i % cols.length], a: isDark ? 0.55 : 0.75 });
      }
      for (let i = 0; i < Math.ceil(n / 2); i++) {
        parts.push({ kind: 'bit', x: x + rand(-15, 15), y: y - 4, vx: rand(-240, 240), vy: -rand(180, 420), s: rand(5, 9), rot: rand(0, 6), va: rand(-12, 12), age: 0, life: rand(0.5, 0.8), color: cols[(i + 1) % cols.length], a: 0.95 });
      }
    },
    // 座布団：画面の下（客席）から何枚も投げ上がり、回りながら舞って落ちる（少しずつずらして投げる）
    zabuton(n = 18) {
      if (!alive) return;
      for (let i = 0; i < n; i++) {
        const fromLeft = i % 2 === 0;
        const c = ZABUTON[i % ZABUTON.length];
        parts.push({
          kind: 'zab', x: fromLeft ? rand(-20, width * 0.45) : rand(width * 0.55, width + 20), y: height + 40,
          vx: (fromLeft ? 1 : -1) * rand(40, 220), vy: -rand(1700, 2150), rot: rand(0, 6), va: rand(-7, 7), flip: rand(0, 6), vf: rand(5, 11),
          w: rand(56, 70), h: rand(48, 58), wait: (i / n) * 0.5, age: 0, life: 2.2, color: c[0], edge: c[1],
        });
      }
    },
    busy: () => parts.length > 0,
    update(dt) {
      if (!alive) return;
      const s = dt > 0 ? dt : 0;
      low.clear();
      high.clear();
      parts = parts.filter((p) => {
        if (p.wait > 0) { p.wait -= s; return true; }
        p.age += s;
        if (p.age >= p.life) return false;
        const k = 1 - p.age / p.life;
        if (p.kind === 'puff') {
          p.vx *= Math.pow(0.04, s); p.vy *= Math.pow(0.1, s);
          p.x += p.vx * s; p.y += p.vy * s;
          low.fillStyle(p.color, p.a * k).fillCircle(p.x, p.y, p.r + p.grow * (1 - k));
        } else if (p.kind === 'bit') {
          p.vy += 1400 * s; p.vx *= Math.pow(0.3, s);
          p.x += p.vx * s; p.y += p.vy * s; p.rot += p.va * s;
          low.save().translateCanvas(p.x, p.y).rotateCanvas(p.rot);
          low.fillStyle(p.color, p.a * k).fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.7);
          low.restore();
        } else {
          p.vy += ZAB_G * s; p.vx *= Math.pow(0.7, s);
          p.x += p.vx * s; p.y += p.vy * s; p.rot += p.va * s; p.flip += p.vf * s;
          if (p.vy > 0 && p.y > height + 80) return false; // 落ちきった
          const sy = Math.max(0.18, Math.abs(Math.cos(p.flip))); // 裏返りながら舞う（縦につぶれて見える）
          const a = Math.min(1, k * 3);
          high.save().translateCanvas(p.x, p.y).rotateCanvas(p.rot).scaleCanvas(1, sy);
          high.fillStyle(p.color, a).fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          high.lineStyle(4, p.edge, a).strokeRect(-p.w / 2 + 5, -p.h / 2 + 5, p.w - 10, p.h - 10);
          high.fillStyle(p.edge, a);
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([u, v]) => high.fillCircle(u * p.w / 2, v * p.h / 2, 4)); // 四隅の房
          high.restore();
        }
        return true;
      });
    },
    destroy() {
      alive = false;
      parts = [];
      [low, high, white, dark].forEach((o) => { scene.tweens.killTweensOf(o); o.destroy(); });
    },
  };
  return fx;
}
