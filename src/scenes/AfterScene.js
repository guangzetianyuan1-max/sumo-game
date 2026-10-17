// src/scenes/AfterScene.js — 取組の後（10/12 夜）：勝ち＝倒した相手・心技体の伸び・昇進・新技の解禁・クリア → 番付表
// 負け＝心技体の伸び（少し）・「もう一度」（相手の情報へ）か「稽古へ」。同じ相手に3連敗したら案内役が稽古を勧める（選ぶのは本人）
import { t, foeLabel, getLang } from '../i18n/i18n.js?v=57';
import { session, suggestTraining, nothingToTrain, trainBegin, trainFreeBegin } from '../state.js?v=57';
import { playBout } from '../ui/sfx.js?v=57';
import { preloadVoices, afterVoiceIds, sayVoice, hushGameVoices } from '../ui/voice.js?v=57';
import { guardOpen, OPEN_GUARD_LONG_MS } from '../ui/openguard.js?v=57';
import { menuBgKey } from '../core/bgkey.js?v=57';
import { preloadBackdrop, drawBackdrop, inkPanel } from '../ui/backdrop.js?v=57';
import { button, topTitle, fitText, wrapText, textStyle, speechBubble, speakerFace, preloadGuideArt, preloadOyakataArt, COLORS } from '../ui/widgets.js?v=57';

const STATS = ['shin', 'gi', 'tai'];
const BAND = 140; // 見出し（勝ち・負け 72）の帯の下の端（倒した相手の行 190 の字の上の端 170 より上）
// 背景＝今取った相手の場所
const bgKey = (lb) => menuBgKey('after', { foeIndex: lb && lb.foe ? lb.foe.index : null });

export class AfterScene extends Phaser.Scene {
  constructor() {
    super('after');
  }

  preload() {
    preloadGuideArt(this);
    preloadOyakataArt(this);
    if (session.lastBout) preloadBackdrop(this, bgKey(session.lastBout));
    preloadVoices(this, afterVoiceIds(getLang(), session.lastBout)); // 昇進＝親方の声・負け＝ことねの声（今の言葉に無ければ読まない）
  }

  create() {
    // 下のボタンは取組の大きなボタンの真下＝取組の終わりの連打がそのまま落ちないよう、開いてから 0.6秒は押しを受けない
    guardOpen(this, OPEN_GUARD_LONG_MS);
    const lb = session.lastBout;
    const r = session.run;
    if (!r) { this.scene.start('guide'); return; }
    if (!lb) { this.scene.start('ladder'); return; }
    // 声：昇進＝親方「よくやった！」「今日から上の番付だ」・負け＝ことね「次もいけるよ！」。画面が落ち着いてから（取組の勝ちの声がまだ鳴っていれば、終わるのを待つ）。画面を離れたら止める
    this.time.delayedCall(350, () => sayVoice(this, lb.won ? (lb.promoted ? 'promoted' : '') : 'afterLoss'));
    this.events.once('shutdown', () => hushGameVoices(this));
    const { width } = this.scale;
    drawBackdrop(this, bgKey(lb), { band: BAND });
    const line = (y, str, size, color, extra) => fitText(this.add.text(width / 2, y, str, textStyle(size, color, extra)).setOrigin(0.5), width - 60);
    topTitle(this, 90, t(lb.won ? 'after.win' : 'after.lose'), 72, lb.won ? COLORS.gold : COLORS.ink);
    if (lb.won) line(190, t('after.beat', { name: foeLabel(lb.foe) }), 38, COLORS.ink);
    // 心技体の伸び（1行ずつ）
    STATS.forEach((s, i) => line(278 + i * 58, t('after.growth', { stat: t(`stat.${s}`), from: lb.before[s].toFixed(1), to: lb.after[s].toFixed(1) }), 36, COLORS.ink, { fontStyle: '500' }));
    let y = 480;
    let bottom = 424; // 字の後ろの墨の板の下の端（心技体の伸びの最後の行 394 の下）
    if (lb.promoted) { playBout('promo'); line(y, t('after.promoted', { rank: t(`div.${lb.promoted}`) }), 44, COLORS.gold); bottom = y + 38; y += 70; }
    if (lb.unlocked) { // 長い英語は2行に折る
      const u = wrapText(this, width / 2, y - 18, t('after.unlocked', { tech: t(`newtech.${lb.unlocked}`) }), width - 60, 32, COLORS.gold);
      bottom = u.y + u.displayHeight + 14;
      y += Math.max(64, Math.round(u.displayHeight) + 24);
    }
    if (lb.cleared) { line(y, t('after.cleared'), 48, COLORS.gold); bottom = y + 40; y += 70; }
    const top = lb.won ? 160 : 250; // 倒した相手の行（190）から・負けは心技体の伸び（278）から
    inkPanel(this, 24, top, 672, bottom - top);

    if (lb.won) {
      if (lb.promoted) {
        inkPanel(this, 28, 738, 164, 166); // 親方の顔と「親方」の札の後ろ
        speakerFace(this, 'kotonami', 110, 820, 150, 'smile');
        speechBubble(this, 210, 730, 470, 180, t('after.promoOyakata', { rank: t(`div.${lb.promoted}`) }), { size: 32, min: 28 });
      }
      // 勝った相手はコレクションの札に判子を押してから先へ（10/17 本人「昔話方式」＝昔話の図鑑と同じ流れ）
      // 50体目を倒した＝判子の後にクリアの画面（横綱の土俵入り）へ
      const stamp = (then) => () => this.scene.start('collection', { stamp: lb.foe.id, then });
      if (lb.cleared) button(this, width / 2, 1190, 460, 110, t('after.toClear'), stamp('clear'), { size: 38 });
      else button(this, width / 2, 1190, 460, 110, t('after.next'), stamp('ladder'), { size: 38 });
      return;
    }
    if (suggestTraining(r)) {
      // 案内役の勧め：左に顔・右に吹き出し
      speakerFace(this, r.guide, 110, 820, 150);
      speechBubble(this, 210, 730, 470, 180, t(`after.suggest.${r.guide}`), { size: 32, min: 28 });
    }
    button(this, width / 2 - 170, 1190, 320, 110, t('after.retry'), () => this.scene.start('opponent'), { size: 36, color: COLORS.buttonSub });
    button(this, width / 2 + 170, 1190, 320, 110, t('after.train'), () => {
      // 伸ばせる物が無い時は自分から入る稽古（途中で番付へ戻れる・親方が「天井だ。土俵で勝て」と言う）
      if (nothingToTrain(r)) trainFreeBegin(); else trainBegin();
      this.scene.start('training');
    }, { size: 36 });
  }
}
