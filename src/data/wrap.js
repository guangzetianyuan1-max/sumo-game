// src/data/wrap.js — 日本語の吹き出しの折り返し（行頭禁則）。画面を使わない部分（node で試せる）
// 行の頭に来てはいけない字：句読点・！？・閉じ括弧・…・長音・小さい仮名。来そうな時は前の行の終わりに付ける（ぶら下げ）
export const NO_LINE_START = '\u3002\u3001\uff0c\uff0e\uff01\uff1f!?\uff09)\u300d\u300f\u3011\u3015\u3009\u300b\uff5d\u2026\u2025\u30fc\u30fb\uff1a\uff1b\u3041\u3043\u3045\u3047\u3049\u3063\u3083\u3085\u3087\u308e\u3095\u3096\u30a1\u30a3\u30a5\u30a7\u30a9\u30c3\u30e3\u30e5\u30e7\u30ee\u30f5\u30f6';

// text を幅 maxWidth に収まるよう字ごとに折る。measure(s)＝その文字列の幅。\n はそのまま段落の切れ目。壊れた入力は ''
export function jaWrap(text, maxWidth, measure) {
  if (typeof text !== 'string') return '';
  return text.split('\n').map((para) => {
    const lines = [];
    let cur = '';
    for (const ch of Array.from(para)) {
      if (cur === '') cur = ch;
      else if (NO_LINE_START.includes(ch) || measure(cur + ch) <= maxWidth) cur += ch;
      else {
        lines.push(cur);
        cur = ch;
      }
    }
    lines.push(cur);
    return lines.join('\n');
  }).join('\n');
}
