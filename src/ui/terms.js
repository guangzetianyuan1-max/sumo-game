// src/ui/terms.js — 遊ぶ前の同意書の画面（v42 本人「初めの注意書き、昔話と同じ同意書にサインを」・下敷き＝昔話のゲームの src/ui/terms.js）
// 初めて（と同意書の版が変わった時）は全文を出し、「同意する」に印を付けて「同意して はじめる」を押すまで ゲームを始めない（main.js が待つ）
// 同意したことは 端末の中（localStorage の sumo.terms）に 版と日時で残す（src/core/terms.js）。残せない・読めない端末では 毎回 たずねる
// 画面は Phaser でなく ふつうの HTML の上掛け（長い文を読みやすく・指でなぞって送れるように）。文は i18n の terms.*
// 字の大きさ：遊ぶ画面（720×1280 を画面に合わせて縮めた物）の 30px 相当以上（字は28以上の決まり）。携帯の幅 375 で 約16px
import { t } from '../i18n/i18n.js?v=56';
import { TERMS_SECTIONS, TERMS_VERSION, OFFICIAL_URL, needTerms, saveAgreement } from '../core/terms.js?v=56';

const FONT = "'M PLUS Rounded 1c', sans-serif";
// 遊ぶ画面の n px 相当の CSS の大きさ（画面の幅か、高さ×720/1280 の小さい方を 720 として）。下限 min px
export const gamePx = (n, min) => `max(${min}px, calc(min(100vw, 56.25vh) * ${n} / 720))`;
export const TERMS_FONT = { title: 44, head: 34, body: 30, check: 32, button: 36 }; // 遊ぶ画面の px（どれも 28 以上）

function el(tag, css, text) {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function localStore() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

// 同意が済むと解決する Promise を返す（同意済みなら すぐ解決）
export function askTerms(store = localStore()) {
  if (store && !needTerms(store)) return Promise.resolve(false);
  return new Promise((done) => {
    const wrap = el('div', `position:fixed;top:0;left:0;right:0;bottom:0;z-index:20;background:#141a2e;color:#f4ecd8;display:flex;flex-direction:column;align-items:center;font-family:${FONT};font-weight:500;padding:max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));box-sizing:border-box;`);
    wrap.id = 'terms';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'terms-title');
    const box = el('div', 'width:100%;max-width:640px;height:100%;display:flex;flex-direction:column;'); // 間は gap でなく margin（Safari 14.1 より前は flex の gap が効かない）
    const h = el('h1', `margin:0 0 12px;font-size:${gamePx(TERMS_FONT.title, 22)};color:#e3c27a;text-align:center;font-weight:800;`, t('terms.title'));
    h.id = 'terms-title';
    const body = el('div', `flex:1;min-height:0;margin:0 0 12px;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#20285a;border:3px solid #e3c27a;border-radius:14px;padding:14px 16px;font-size:${gamePx(TERMS_FONT.body, 16)};line-height:1.7;`);
    TERMS_SECTIONS.forEach((id, i) => {
      body.appendChild(el('h2', `margin:0 0 4px;font-size:${gamePx(TERMS_FONT.head, 17)};color:#e3c27a;font-weight:800;`, `${i + 1}. ${t(`terms.${id}.head`)}`));
      body.appendChild(el('p', 'margin:0 0 14px;', t(`terms.${id}.body`, { url: OFFICIAL_URL })));
    });
    body.appendChild(el('p', 'margin:0;color:#c9c2b0;', t('terms.version', { v: TERMS_VERSION })));
    const label = el('label', `display:flex;align-items:center;margin:0 0 12px;font-size:${gamePx(TERMS_FONT.check, 17)};padding:6px 2px;cursor:pointer;`);
    const check = el('input', 'width:30px;height:30px;flex:none;margin:0 12px 0 0;accent-color:#c8553d;');
    check.type = 'checkbox';
    check.id = 'terms-check';
    label.append(check, el('span', '', t('terms.check')));
    // 印が無い時に押したら、理由を出して印の所を目立たせる（v44・バグ探し M6「押しても何も起きない」＝押しても進まないボタンは理由を出す）。
    // ⛔ disabled にすると押しても click が来ない＝理由を出せない。灰色の見た目と aria-disabled で「まだ」を示す
    const btn = el('button', `font-family:${FONT};font-weight:800;font-size:${gamePx(TERMS_FONT.button, 19)};padding:16px;border-radius:14px;border:3px solid #e3c27a;background:#3a3f4c;color:#8a8f9c;`, t('terms.button'));
    btn.id = 'terms-ok';
    btn.setAttribute('aria-disabled', 'true');
    const why = el('p', `margin:0 0 12px;font-size:${gamePx(TERMS_FONT.check, 17)};color:#ffb4a2;font-weight:800;text-align:center;white-space:pre-line;display:none;`, t('terms.needCheck'));
    why.id = 'terms-why';
    why.setAttribute('role', 'alert');
    const mark = (on) => {
      label.style.outline = on ? '4px solid #e3c27a' : '';
      label.style.background = on ? 'rgba(227, 194, 122, 0.2)' : '';
      label.style.borderRadius = on ? '10px' : '';
    };
    check.addEventListener('change', () => {
      btn.setAttribute('aria-disabled', check.checked ? 'false' : 'true');
      btn.style.background = check.checked ? '#c8553d' : '#3a3f4c';
      btn.style.color = check.checked ? '#ffffff' : '#8a8f9c';
      if (check.checked) { why.style.display = 'none'; mark(false); }
    });
    btn.addEventListener('click', () => {
      if (!check.checked) {
        why.style.display = 'block';
        mark(true);
        try { check.focus(); } catch { /* 印の所に寄せられなくても理由は出ている */ }
        return;
      }
      saveAgreement(store);
      wrap.remove();
      done(true);
    });
    box.append(h, body, label, why, btn);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
  });
}

// ---- 同意書の画面そのものが出せなかった時の代わり（v42 第2段 D1）：同意なしでは始めない ----
// 文は短く（i18n の terms.plain.*・引けなければ英語の文）・「同意する」の押し1つだけ。古い端末でも動く書き方（inset・gap を使わない）
const PLAIN_EN = {
  'terms.plain.body': 'You play this game by tapping the screen. Please do not tap too hard. Except in cases of intent or gross negligence by the creator, we are not responsible for damage to your device or a cracked screen. Your records stay only on this device. Press the button below to agree.',
  'terms.plain.button': 'I agree',
};
function plainText(key) {
  try {
    const s = t(key);
    if (s && s !== key) return s;
  } catch { /* i18n が使えない＝英語の文 */ }
  return PLAIN_EN[key];
}
export function askTermsPlain(store = localStore(), doc = typeof document !== 'undefined' ? document : null) {
  if (store && !needTerms(store)) return Promise.resolve(false);
  if (!doc || !doc.body) return Promise.reject(new Error('no document'));
  return new Promise((done) => {
    const wrap = doc.createElement('div');
    wrap.id = 'terms-plain';
    wrap.setAttribute('role', 'dialog');
    wrap.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;z-index:21;background:#141a2e;color:#f4ecd8;overflow-y:auto;padding:24px 16px;box-sizing:border-box;font-family:sans-serif;line-height:1.7;font-size:${gamePx(TERMS_FONT.body, 16)};text-align:center;`;
    const p = doc.createElement('p');
    p.style.cssText = 'margin:0 auto 24px;max-width:640px;text-align:left;';
    p.textContent = plainText('terms.plain.body');
    const btn = doc.createElement('button');
    btn.id = 'terms-plain-ok';
    btn.style.cssText = `font-family:sans-serif;font-weight:bold;font-size:${gamePx(TERMS_FONT.button, 19)};padding:16px 32px;border-radius:14px;border:3px solid #e3c27a;background:#c8553d;color:#ffffff;`;
    btn.textContent = plainText('terms.plain.button');
    btn.addEventListener('click', () => {
      saveAgreement(store);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      done(true);
    });
    wrap.appendChild(p);
    wrap.appendChild(btn);
    doc.body.appendChild(wrap);
  });
}
