// src/core/cutin.js — 主人公のカットインの6表情（tools/prep_cutin.py で切り分けた絵）。画面から切り離した名前と絵の場所
// 出す所：立ち合いで光ってすぐ＝kiai・決め技＝kime・勝ち＝yorokobi・負け＝kuyashii（niyari・funbari は今は使わない）
import { HERO_TYPE } from '../data/heroes.js?v=42';

export const CUTIN = ['kiai', 'niyari', 'kime', 'funbari', 'yorokobi', 'kuyashii'];
export const KIAI_WINDOW = 0.15; // 立ち合いの合図からこの秒数のうちにたたくと「気合」

export const cutinArt = (name) => ({ key: `cutin-${HERO_TYPE}-${name}`, path: `assets/figures/cutin/${HERO_TYPE}_${name}.png` });

// ---- 取組の必殺技のカットイン（v42 第2段・本人 ③⑥⑦⑧ と 10/15「目の帯で」）----
// 目の帯＝怒り顔の目のあたり（tools/prep_eyes.py・720×200）：相手20体は foe の id・主人公は hero
// 漫画の絵＝破いたページの1コマ（tools/prep_manga.py・横720・透明の地）：主人公の決め技の id（samidare など）と守り成功の korae
export const EYE_HERO = 'hero';
export const MANGA_KORAE = 'korae';
export const eyeArt = (id) => ({ key: `eyes-${id}`, path: `assets/figures/eyes/${id}.jpg` });
export const mangaArt = (id) => ({ key: `manga-${id}`, path: `assets/figures/manga/${id}.png` });
// 見せる長さ（ms）：主人公の必殺技＝目の帯 heroEye の後に漫画 heroManga（この間は取組の時計を止める）・相手の必殺技の予告＝目の帯 foeEye（時計を止める）・
// 守り成功＝漫画 korae（時計は止めない）。守り成功が koraeGap 以内に続いたら2回目は出さない
export const MANGA_MS = { heroEye: 500, heroManga: 900, foeEye: 900, korae: 700, koraeGap: 4000 };
// 守り成功の漫画を出すか（前に出した時刻 lastAt・今 now・どちらも ms）
export const koraeDue = (lastAt, now) => !(now - lastAt < MANGA_MS.koraeGap);
