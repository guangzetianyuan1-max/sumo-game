// src/core/cutin.js — 主人公のカットインの6表情（tools/prep_cutin.py で切り分けた絵）。画面から切り離した名前と絵の場所
// 出す所：立ち合いで光ってすぐ＝kiai・決め技＝kime・勝ち＝yorokobi・負け＝kuyashii（niyari・funbari は今は使わない）
import { HERO_TYPE } from '../data/heroes.js?v=38';

export const CUTIN = ['kiai', 'niyari', 'kime', 'funbari', 'yorokobi', 'kuyashii'];
export const KIAI_WINDOW = 0.15; // 立ち合いの合図からこの秒数のうちにたたくと「気合」

export const cutinArt = (name) => ({ key: `cutin-${HERO_TYPE}-${name}`, path: `assets/figures/cutin/${HERO_TYPE}_${name}.png` });
