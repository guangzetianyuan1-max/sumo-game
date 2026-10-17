// src/scenes/ScheduleScene.js — 取組の順：日ごとの行（日・相手のしこ名・番付・タイプ・済んだ日は ○● と決まり手）。今日の行を光らせる
// 幕下以下は2番目から相手が前の日に決まる：未定の日は「未定」・決まった相手はタイプの横に星（自分と同じ星）
// 全部済むまで「次の取組へ」→ 相手の情報。全部済んだら「場所の結果へ」＝ここで1度だけ締めて保存してから結果の画面へ
// 休場の場所（疲れ10で入った）は全部の行が「休」で、始めから済んでいる＝すぐ「場所の結果へ」
// 取組が残っている間は下の段の左に「自動で取る」（10/11 本人「場所において自動モード」）：今日の相手のお勧めの作戦表で、結果だけの速さで1番取って
// ここへ戻り、0.6秒おいて次へ（session.autoBasho）。最中は左のボタンが「止める」・取組で画面を押しても止まる。全部済んだら止まる
import { t, techLabel, rankLabel, shikonaLabel, bashoLabel, dayLabel } from '../i18n/i18n.js?v=54';
import { recordNote } from '../core/honors.js?v=54';
import { session, prepareOpponent, closeBasho, decideNow } from '../state.js?v=54';
import { nextAutoStep } from '../core/auto.js?v=54';
import { button, backButton, saveButton, topTitle, fitText, roundBox, textStyle, COLORS } from '../ui/widgets.js?v=54';

const LIST = { top: 146, bottom: 1126, w: 664 }; // 15日でも1行65（番付の字22を入れる）
const COL = { day: 46, who: 152, type: 404, mark: 650, right: 618 }; // 左から：日／しこ名・番付／タイプ・決まり手／○●
const TODAY = 0x39436a;
const BOTTOM = { y: 1190, w: 320, h: 110, dx: 170 }; // 取組が残っている時の下の段の2つ（左＝自動で取る／止める・右＝次の取組へ）
const AUTO_WAIT_MS = 600; // 自動の時、戻って来た取組の順（新しい ○●）を見せる長さ

export class ScheduleScene extends Phaser.Scene {
  constructor() {
    super('schedule');
  }

  create() {
    decideNow(); // 今日の相手が未定のまま読み直した記録でも、ここで決めて保存（ふだんは前の取組の後に決まっている）
    const c = session.career;
    if (!c?.basho) {
      this.scene.start(c ? 'banzuke' : 'guide');
      return;
    }
    const b = c.basho;
    const { width } = this.scale;
    backButton(this, () => {
      session.autoBasho = false;
      this.scene.start('banzuke');
    });
    saveButton(this);
    topTitle(this, 52, t('sched.title'), 56, COLORS.gold, { save: true });
    const wins = b.results.filter((r) => r === 'win').length;
    const losses = b.results.filter((r) => r === 'loss' || r === 'absent').length; // 休みは負けに数える
    // 見出しの段：右から 星・星の印（勝ち越し・負け越し・全勝）・左に場所の名（印の手前まで）
    const rec = fitText(this.add.text(width - 30, 116, t('result.record', { w: wins, l: losses }), textStyle(32, COLORS.gold)).setOrigin(1, 0.5), 170);
    let room = width - 30 - rec.displayWidth;
    const note = recordNote(wins, losses, b.days.length);
    if (note) {
      const nt = fitText(this.add.text(room - 16, 116, t(`note.${note}`), textStyle(26, note === 'makekoshi' ? COLORS.sub : COLORS.gold)).setOrigin(1, 0.5), 220);
      room = room - 16 - nt.displayWidth;
    }
    fitText(this.add.text(30, 116, bashoLabel(b), textStyle(30, COLORS.ink)).setOrigin(0, 0.5), room - 16 - 30);

    const listTop = LIST.top; // 10/12 休場は無くした
    const n = b.days.length;
    const rowH = Math.min(110, (LIST.bottom - listTop) / n);
    b.days.forEach((d, i) => this.row(b, i, Math.round(listTop + rowH * (i + 0.5)), Math.floor(rowH - 6)));

    const finished = b.day >= n;
    if (finished) {
      session.autoBasho = false; // 全部済んだら自動は止まる（結果へは本人が押す）
      button(this, width / 2, 1190, 460, 110, t('sched.done'), () => {
        closeBasho(); // 全部済んだ場所を1度だけ締めて保存（結果は session.lastResult）
        this.scene.start('result');
      }, { size: 38 });
    } else {
      const auto = session.autoBasho;
      button(this, width / 2 - BOTTOM.dx, BOTTOM.y, BOTTOM.w, BOTTOM.h, t(auto ? 'auto.stop' : 'auto.bouts'), () => {
        if (session.autoBasho) {
          session.autoBasho = false; // 止める：待ちを消して描き直す
          this.scene.restart();
          return;
        }
        session.autoBasho = true;
        this.autoBout();
      }, { size: 34, color: COLORS.buttonSub });
      button(this, width / 2 + BOTTOM.dx, BOTTOM.y, BOTTOM.w, BOTTOM.h, t('sched.go'), () => {
        session.autoBasho = false; // 自分で取る時は自動を止める
        prepareOpponent();
        this.scene.start('opponent');
      }, { size: 34 });
      if (nextAutoStep(c, auto) === 'bout') this.time.delayedCall(AUTO_WAIT_MS, () => this.autoBout());
    }
  }

  // 自動の1番：今日の相手のお勧めの作戦表を組んで、そのまま取組へ（相手の情報と作戦表は飛ばす）。組めなければ止める
  autoBout() {
    if (nextAutoStep(session.career, session.autoBasho) !== 'bout') return;
    const opp = prepareOpponent();
    if (!opp || !session.strategy || !session.oppStrategy) {
      session.autoBasho = false;
      this.scene.restart();
      return;
    }
    this.scene.start('bout');
  }

  // 1日の行。日（真ん中）・上の段＝しこ名・タイプ・下の段＝番付・決まり手・右に ○●
  row(b, i, cy, h) {
    const { width } = this.scale;
    const o = b.opponents[i];
    const res = b.results[i];
    const today = i === b.day;
    roundBox(this, width / 2, cy, LIST.w, h, today ? TODAY : COLORS.panel, {
      radius: Math.min(18, h / 2), stroke: today ? COLORS.frame : null, shadow: false,
    });
    // 上の段（しこ名）と下の段（番付・22）が触れない間合い：15日（行の高さ59）で中心の差28
    const top = Math.round(cy - h * 0.22);
    const bottom = Math.round(cy + h * 0.25);
    const big = Math.min(28, Math.floor(h * 0.41));
    const small = 22;
    const dim = res ? COLORS.sub : COLORS.ink;
    // 日の名前（初日・中日・千秋楽）。英語の「Day 8 (mid)」のように欄に入らない時は括弧から2行にする
    const dayW = COL.who - COL.day - 10;
    const dayText = this.add.text(COL.day, cy, dayLabel(b.days[i]), textStyle(big, today ? COLORS.gold : COLORS.sub)).setOrigin(0, 0.5);
    if (dayText.width > dayW && dayText.text.indexOf(' (') > 0) {
      dayText.setText(dayText.text.replace(' (', '\n(')).setFontSize(Math.min(big, Math.floor(h * 0.4))).setLineSpacing(-4);
    }
    fitText(dayText, dayW);
    if (o) {
      fitText(this.add.text(COL.who, top, shikonaLabel(o.name), textStyle(big, dim)).setOrigin(0, 0.5), COL.type - COL.who - 14);
      fitText(this.add.text(COL.who, bottom, rankLabel(o.pos), textStyle(small, COLORS.sub, { fontStyle: '500' })).setOrigin(0, 0.5), COL.type - COL.who - 14);
      // 幕下以下の2番目からは、決まった時の相手の星（自分と同じ星）をタイプの横に
      const type = t(`type.${o.type}.name`) + (o.record ? `  ${t('result.record', { w: o.record.wins, l: o.record.losses })}` : '');
      fitText(this.add.text(COL.type, top, type, textStyle(small, COLORS.sub, { fontStyle: '500' })).setOrigin(0, 0.5), COL.right - COL.type);
    } else if (!res) {
      // 幕下以下の2番目から：取組は前の日の取組の後に決まる＝それまでは「未定」
      fitText(this.add.text(COL.who, cy, t('sched.tbd'), textStyle(big, COLORS.sub)).setOrigin(0, 0.5), COL.type - COL.who - 14);
    }
    if (res === 'absent') {
      // 休場の日は「休」だけ（決まり手は無い）
      fitText(this.add.text(COL.mark, cy, t('sched.absent'), textStyle(big, COLORS.sub)).setOrigin(0.5), 2 * (width / 2 + LIST.w / 2 - COL.mark) - 8);
    } else if (res) {
      this.add.text(COL.mark, cy, t(res === 'win' ? 'sched.win' : 'sched.loss'), textStyle(big + 6, res === 'win' ? COLORS.ink : COLORS.sub)).setOrigin(0.5);
      fitText(this.add.text(COL.type, bottom, techLabel(b.kimarite[i]), textStyle(small, COLORS.ink, { fontStyle: '500' })).setOrigin(0, 0.5), COL.right - COL.type);
    }
  }
}
