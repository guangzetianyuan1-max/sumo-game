// src/ui/drillstage.js — 稽古の舞台の置き場所と、長押しの見せ方の計算（10/15 ボタン2つに戻す Task 2・v42 長押しの相手を消す）。Phaser を使わない（node で試験する）
// 主人公は3つの遊びとも右向き（FACE = +1：型紙は右向きなのでそのまま・突く向き・傾ける向きは FACE で決める）。
//   一押し：主人公は真ん中より少し左（右へ突く）
//   連打：主人公は左・鉄砲柱は右・回数は柱のさらに右（主人公にも柱にも重ならない）
//   長押し：主人公ひとり（相手は置かない・v42 本人）。真ん中より少し右。こらえの見せ方は主人公だけ（緑で離す＝四股を踏みしめる／外す＝後ろへよろける）。左端のバー（HUD.bar）にかからない
// ボタン2つは本番（KamiScene）と同じ場所と大きさ：左（連打）・右（一押しと長押し）
import { BUTTON_COLOR } from '../core/kamibutton.js?v=55';

export const FACE = 1;
export const FIG_H = 330; // 型紙の高さ（取組と同じ）
export const FEET_Y = 800; // 型紙の足もと（稽古場の床の上）
export const HERO_W = Math.round((FIG_H * 265) / 432); // 主人公の型紙の幅（265x432）＝約 202
export const HERO_X = { ippon: 340, renda: 270, nagaoshi: 400 }; // 型紙の中心 x
export const PILLAR = { x: 450, w: 64, top: -10 }; // 鉄砲柱（主人公の右）
export const COUNT = { x: 612, y: 470, w: 200 }; // 連打の回数（柱の右・w＝3桁でも収まる幅）
// 連打の目標（v45b・バグ出し2 L2「目標の30回がどこにも出ない・達成に画面の合図が無い」）：回数の真上に「目標 30回」（英語は2行）。
// 見出しの帯（〜256）の下・回数の字（110・真ん中 470）の上。目標に届いたら回数と目標の字が金に光る（pop＝回数の字の一瞬の大きさ・ring＝広がる金の輪）
export const GOAL = { x: COUNT.x, y: 335, size: 32, w: COUNT.w, pop: 1.7, ms: 360, ring: { from: 60, to: 130 } };
export const HOLD = { push: 34 }; // 長押しで外した時、主人公が後ろ（左）へよろける長さ
export const BTN = { left: { x: 190, y: 1104, d: 280 }, right: { x: 530, y: 1104, d: 280 } }; // 本番（KamiScene の LEFT_BTN・RIGHT_BTN）と同じ

// 離した時の結果：緑の帯の中（点が付く）＝こらえる（主人公は踏みしめて動かない）・外＝後ろへよろける
export const holdBlocked = (point) => point > 0;

// 使う方のボタンの色（v42 第2段）：一押し・連打＝朱・長押し＝取組の長押し（守りのバー）と同じ緑（BUTTON_COLOR.bar）
export const DRILL_MAIN = 0xc8553d;
export const drillButtonColor = (kind) => (kind === 'nagaoshi' ? BUTTON_COLOR.bar : DRILL_MAIN);
