// src/ui/finisherfx.js — 必殺技の演出の飾りを描く（設計書 2026-10-16 §6.5）。形と時間は src/core/finisherfx.js（純粋な関数）が決める。ここは描くだけ
// 型紙の動き（回る・跳ぶ）と残像は取組の画面（KamiScene）が型紙の絵に掛ける。画面全体は回さない・光は 0.5 以下
import { decorAt } from '../core/finisherfx.js?v=58';

const DEPTH = { decor: 6.5, edge: 29 }; // 飾り＝型紙（0）と座布団（8）の間・縁の光＝白い光（30）の下
const EDGE_ALPHA = 0.45; // 画面の縁の色の光（4段目から・山でもこの濃さまで）
const EDGE_W = 24;

export function createFinisherFx(scene) {
  const { width, height } = scene.scale;
  const g = scene.add.graphics().setDepth(DEPTH.decor);
  const edge = scene.add.graphics().setDepth(DEPTH.edge);
  let alive = true;
  const shape = (s) => {
    g.fillStyle(s.color, s.alpha);
    g.lineStyle(4, s.color, s.alpha);
    if (s.type === 'line') g.lineBetween(s.x, s.y, s.x + Math.cos(s.rot) * s.size, s.y + Math.sin(s.rot) * s.size);
    else if (s.type === 'circle') g.strokeCircle(s.x, s.y, s.size);
    else if (s.type === 'dot') g.fillCircle(s.x, s.y, s.size / 2);
    else if (s.type === 'ellipse') g.fillEllipse(s.x, s.y, s.size, s.size * 0.55);
    else if (s.type === 'tri') g.fillTriangle(s.x, s.y - s.size, s.x - s.size * 0.45, s.y, s.x + s.size * 0.45, s.y);
    else if (s.type === 'rect') g.fillRect(s.x - s.size / 2, s.y - s.size, s.size, s.size);
    else if (s.type === 'arc') { g.beginPath(); g.arc(s.x, s.y, s.size, s.rot, s.rot + Math.PI * 0.8, false); g.strokePath(); }
    else if (s.type === 'blade') g.fillTriangle(s.x, s.y, s.x + Math.cos(s.rot) * s.size, s.y + Math.sin(s.rot) * s.size, s.x + Math.cos(s.rot + 0.35) * s.size, s.y + Math.sin(s.rot + 0.35) * s.size);
    else if (s.type === 'bolt') { const h = s.size; g.beginPath(); g.moveTo(s.x, s.y - h); g.lineTo(s.x + 18, s.y - h * 0.55); g.lineTo(s.x - 10, s.y - h * 0.45); g.lineTo(s.x + 8, s.y); g.strokePath(); }
    else if (s.type === 'star') {
      const pts = [];
      for (let i = 0; i < 10; i++) { const r = i % 2 ? s.size * 0.45 : s.size; const a = -Math.PI / 2 + (i * Math.PI) / 5; pts.push({ x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r }); }
      g.fillPoints(pts, true);
    }
  };
  return {
    // plan＝finisherPlan・t＝始まりからの秒・at＝技の当たる所（画面の座標）
    draw(plan, t, at) {
      if (!alive) return;
      g.clear();
      edge.clear();
      if (!plan) return;
      decorAt(plan, t, at).forEach(shape);
      if (plan.edge) {
        const u = Math.max(0, Math.min(1, t / plan.secs));
        edge.lineStyle(EDGE_W, plan.decor.color, EDGE_ALPHA * Math.sin(Math.PI * u)).strokeRect(EDGE_W / 2, EDGE_W / 2, width - EDGE_W, height - EDGE_W);
      }
    },
    clear() { if (alive) { g.clear(); edge.clear(); } },
    destroy() { alive = false; g.destroy(); edge.destroy(); },
  };
}
