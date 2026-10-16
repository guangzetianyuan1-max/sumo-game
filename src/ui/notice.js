// src/ui/notice.js — 画面の下に一度だけ出す知らせの札（HTML の上掛け・どの画面の上にも出る・たたくと閉じる・ms 後に消える）
// v44：保存に失敗した時の「この端末では記録を残せません」（src/state.js の onSaveFail から main.js が呼ぶ）。文は呼ぶ側が i18n から渡す
// 字は遊ぶ画面の 30px 相当（src/ui/terms.js の gamePx・字は28以上）。古い Safari のため inset と flex の gap は使わない
import { gamePx } from './terms.js?v=48';

export const NOTICE_MS = 6000;
export const NOTICE_FONT = 30; // 遊ぶ画面の px（360幅で 15px。下限 15px＝遊ぶ画面の 30 以上）
export const NOTICE_MIN_PX = 15;
export const NOTICE_SIDE = 8; // 画面の左右のすき間（px）。狭い端末でも2行に収める（360幅で字の幅 314px）
export const NOTICE_PAD = { x: 12, border: 3 };
export const NOTICE_LIFT = 84; // 遊ぶ画面の下の端から札の下の端までの高さ（遊ぶ画面の px）。♪の札（右下の角 〜60）と、記録の画面の一番下の「もう一度押すと…」の行（〜74）の上

// 札を置く場所：遊ぶ画面（#game の canvas）の上。画面の下の端から NOTICE_LIFT の上・左右は NOTICE_SIDE。canvas が無ければ（試験など）画面の下の端
export function noticePlace(rect, vw, vh) {
  if (!rect || !(rect.width > 0)) return { left: 16, right: 16, bottom: null };
  const k = rect.width / 720;
  return {
    left: Math.max(0, Math.round(rect.left + NOTICE_SIDE)),
    right: Math.max(0, Math.round(vw - rect.right + NOTICE_SIDE)),
    bottom: Math.max(16, Math.round(vh - rect.bottom + NOTICE_LIFT * k)),
  };
}

export function showNotice(text, { ms = NOTICE_MS, doc = typeof document !== 'undefined' ? document : null } = {}) {
  if (!doc || !doc.body || !text) return null;
  const old = doc.getElementById ? doc.getElementById('notice') : null;
  if (old && old.parentNode) old.parentNode.removeChild(old);
  let place = { left: 16, right: 16, bottom: null };
  try {
    const cv = doc.querySelector ? doc.querySelector('#game canvas') : null;
    const el = doc.documentElement;
    if (cv && el) place = noticePlace(cv.getBoundingClientRect(), el.clientWidth, el.clientHeight);
  } catch { /* 置き場所が分からなければ画面の下の端 */ }
  const box = doc.createElement('div');
  box.id = 'notice';
  box.setAttribute('role', 'status');
  box.style.cssText = `position:fixed;left:${place.left}px;right:${place.right}px;bottom:${place.bottom === null ? 'max(16px, env(safe-area-inset-bottom))' : `${place.bottom}px`};z-index:30;margin:0 auto;max-width:640px;box-sizing:border-box;`
    + `padding:12px ${NOTICE_PAD.x}px;border-radius:14px;border:${NOTICE_PAD.border}px solid #e3c27a;background:#20285a;color:#f4ecd8;text-align:center;white-space:pre-line;`
    + `font-family:'M PLUS Rounded 1c', sans-serif;font-weight:800;font-size:${gamePx(NOTICE_FONT, NOTICE_MIN_PX)};line-height:1.5;`;
  box.textContent = text;
  const close = () => { if (box.parentNode) box.parentNode.removeChild(box); };
  box.addEventListener('click', close);
  doc.body.appendChild(box);
  setTimeout(close, ms);
  return box;
}
