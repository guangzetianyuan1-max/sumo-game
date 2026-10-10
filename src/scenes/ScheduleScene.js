// src/scenes/ScheduleScene.js — 取組の順：日ごとの行（日・相手のしこ名・番付・タイプ・済んだ日は ○● と決まり手）。今日の行を光らせる
// 全部済むまで「次の取組へ」→ 相手の情報。全部済んだら「場所の結果へ」＝ここで1度だけ締めて保存してから結果の画面へ
import { t, techLabel, rankLabel, shikonaLabel, bashoLabel } from '../i18n/i18n.js?v=8';
import { session, prepareOpponent, closeBasho } from '../state.js?v=8';
import { button, fitText, roundBox, textStyle, COLORS } from '../ui/widgets.js?v=8';

const LIST = { top: 146, bottom: 1126, w: 664 }; // 15日でも1行65（番付の字22を入れる）
const COL = { day: 46, who: 152, type: 404, mark: 650, right: 618 }; // 左から：日／しこ名・番付／タイプ・決まり手／○●
const TODAY = 0x39436a;

export class ScheduleScene extends Phaser.Scene {
  constructor() {
    super('schedule');
  }

  create() {
    const c = session.career;
    if (!c?.basho) {
      this.scene.start(c ? 'training' : 'guide');
      return;
    }
    const b = c.basho;
    const { width } = this.scale;
    fitText(this.add.text(width / 2, 52, t('sched.title'), textStyle(56, COLORS.gold)).setOrigin(0.5), width - 80);
    const wins = b.results.filter((r) => r === 'win').length;
    const losses = b.results.filter((r) => r === 'loss').length;
    fitText(this.add.text(30, 116, bashoLabel(b), textStyle(30, COLORS.ink)).setOrigin(0, 0.5), width - 230);
    fitText(this.add.text(width - 30, 116, t('result.record', { w: wins, l: losses }), textStyle(32, COLORS.gold)).setOrigin(1, 0.5), 170);

    const n = b.days.length;
    const rowH = Math.min(110, (LIST.bottom - LIST.top) / n);
    b.days.forEach((d, i) => this.row(b, i, Math.round(LIST.top + rowH * (i + 0.5)), Math.floor(rowH - 6)));

    const finished = b.day >= n;
    if (finished) {
      button(this, width / 2, 1190, 460, 110, t('sched.done'), () => {
        closeBasho(); // 全部済んだ場所を1度だけ締めて保存（結果は session.lastResult）
        this.scene.start('result');
      }, { size: 38 });
    } else {
      button(this, width / 2, 1190, 460, 110, t('sched.go'), () => {
        prepareOpponent();
        this.scene.start('opponent');
      }, { size: 38 });
    }
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
    fitText(this.add.text(COL.day, cy, t('sched.day', { n: b.days[i] }), textStyle(big, today ? COLORS.gold : COLORS.sub)).setOrigin(0, 0.5), COL.who - COL.day - 10);
    fitText(this.add.text(COL.who, top, shikonaLabel(o.name), textStyle(big, dim)).setOrigin(0, 0.5), COL.type - COL.who - 14);
    fitText(this.add.text(COL.who, bottom, rankLabel(o.pos), textStyle(small, COLORS.sub, { fontStyle: '500' })).setOrigin(0, 0.5), COL.type - COL.who - 14);
    fitText(this.add.text(COL.type, top, t(`type.${o.type}.name`), textStyle(small, COLORS.sub, { fontStyle: '500' })).setOrigin(0, 0.5), COL.right - COL.type);
    if (res) {
      this.add.text(COL.mark, cy, t(res === 'win' ? 'sched.win' : 'sched.loss'), textStyle(big + 6, res === 'win' ? COLORS.ink : COLORS.sub)).setOrigin(0.5);
      fitText(this.add.text(COL.type, bottom, techLabel(b.kimarite[i]), textStyle(small, COLORS.ink, { fontStyle: '500' })).setOrigin(0, 0.5), COL.right - COL.type);
    }
  }
}
