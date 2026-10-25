// コレクション（10/17 本人「倒した敵はコレクションとして見れるように。昔話方式」＝福島昔話クエストの図鑑と同じ形）
// 50体を番号の順に並べる。倒した相手は姿と名前・まだの相手は黒い影と「？？？」（番号だけ見せる）
// 勝ち抜きは1体目から順に戦う＝倒した相手は「勝った数より前の番号」。記録に新しい物は足さない（古い記録もそのまま読める）
// 画面は CollectionScene（3列×3段＝1ページ9体）
import { FOE_IDS, foeAt } from '../data/foes.js?v=61';

export const PER_PAGE = 9;

export function collectionOf(run) {
  const w = run && Number.isFinite(run.wins) ? Math.max(0, Math.floor(run.wins)) : 0;
  const items = FOE_IDS.map((id, i) => ({ ...foeAt(i), got: i < w }));
  return { items, got: Math.min(w, items.length), total: items.length, pages: Math.ceil(items.length / PER_PAGE) };
}

// その番号の相手が載るページ（0から）。範囲の外は端のページ
export function pageOf(index) {
  const last = Math.ceil(FOE_IDS.length / PER_PAGE) - 1;
  const n = Math.floor(Number(index));
  return Number.isFinite(n) ? Math.max(0, Math.min(last, Math.floor(n / PER_PAGE))) : 0;
}
