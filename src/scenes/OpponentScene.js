// src/scenes/OpponentScene.js — 今日の相手（20体版 Task 4・10/13）：相手の絵と型・得意と苦手（系統）・心技体・決め技を選ぶ札5枚・ことねの勧め → 取組へ
// 作戦表の頃の名残（よく使う手・技の勧めの吹き出し）は外した。シニアにも読める大きな札と、下の真ん中の「取組へ」1つだけ
// 決め技の札：覚えた物だけ押して選べる（選んだ札が朱に光る）。最初は勧め（recommendKimete）を選んでおく。覚えていない物は灰色
import { TYPES } from '../data/types.js?v=39';
import { OKAMI } from '../data/heroes.js?v=39';
import { t, foeLabel } from '../i18n/i18n.js?v=39';
import { session, prepareOpponent } from '../state.js?v=39';
import { playBout } from '../ui/sfx.js?v=39';
import { kimeteCards, recommendKimete, chosenKimete } from '../core/kimetepick.js?v=39';
import { foeArt, foeAura, stageScale } from '../core/foeart.js?v=39';
import {
  button, backButton, topTitle, fitText, wrapText, roundBox, hitZone, textStyle, statBars, speakerFace, speechBubble,
  preloadTypeArt, preloadGuideArt, addAura, clearScene, COLORS,
} from '../ui/widgets.js?v=39';
import { currentFoe } from '../core/run.js?v=39';
import { foeTacticsAt, foeKimeteAt } from '../core/kamiai.js?v=39';

const INFO = { y: 286, h: 292 }; // 相手の札（140〜432）：得意・苦手は英語だと5行になるので高めに：左に絵・右に型と得意・苦手
const ART = { x: 175, r: 100, h: 200 };
const TEXT_X = 305; // 右の字の左端
const STATS_Y = 462; // 心技体の見出し（棒はその下）
const PICK_Y = 648; // 「決め技をえらぶ」
const CARD = { w: 216, h: 112, gap: 12, row1: 724, row2: 852 }; // 札5枚：上に3枚・下に2枚（行の間 16）
// ことねの顔と吹き出し：おすすめ（または稽古の案内）・この相手の攻めの名前を並べた1行（返し方はどれも「右のボタン（またはバー）を長押し・緑で離す」。踏ん張りの「来たら待ち、解けたら左を連打」は はじめての吹き出しと遊び方で教える＝ここは字を 26 以上に保つ）・この相手の必殺技の名前（10/14・10/15 ボタン2つ）。
// 下の段の札の下 904 と「取組へ」の上 1132 の間に広げる。字は 26 以上を保つ（ja・en とも・大ボスは勧めの1行を外す）
const COACH = { faceX: 70, size: 108, left: 138, top: 912, w: 560, h: 212, font: 30, min: 28 };
const TAG = { w: 150, h: 38, dy: 2, size: 28 }; // 勧めの金の札：札の上の縁に少しかかる（下の段の札でも上の段の札 776 に重ならない）
const GO_Y = 1190;
const AFF_KEY = (a) => (a > 1 ? 'good' : a < 1 ? 'bad' : 'normal');
const AFF_COLOR = { good: COLORS.gold, normal: COLORS.sub, bad: '#d9a08f' };

export class OpponentScene extends Phaser.Scene {
  constructor() {
    super('opponent');
  }

  preload() {
    preloadTypeArt(this);
    preloadGuideArt(this);
    // 今の相手のフィギュア風の立ち絵（ふだん・本気・大ボス）
    const foe = session.run ? currentFoe(session.run) : null;
    if (foe) {
      const a = foeArt(foe);
      if (!this.textures.exists(a.key)) this.load.image(a.key, a.path);
    }
  }

  create() {
    this.auraTween = null; // 前の入場の光は Phaser が片付け済み（消えた物に remove を呼ばない）
    this.foe = prepareOpponent();
    if (!this.foe) {
      this.scene.start(session.run ? 'ladder' : 'guide');
      return;
    }
    this.rec = recommendKimete(session.run, this.foe.type);
    this.pick = this.rec; // 最初は勧めを選んでおく（覚えていなければ null）
    this.draw();
  }

  redraw() {
    this.time.delayedCall(0, () => this.draw()); // 押しの最中に札を消さない
  }

  draw() {
    // 虹のオーラの回る tween は描き直しのたびに増やさない（絵を消す前に止める）
    if (this.auraTween) { this.auraTween.remove(); this.auraTween = null; }
    clearScene(this);
    const { width } = this.scale;
    const foe = this.foe;
    const opp = foe.type;
    backButton(this, () => this.scene.start('ladder'));
    topTitle(this, 44, t('opp.title'), 50, COLORS.gold);
    fitText(this.add.text(width / 2, 104, t('career.who', { name: foeLabel(foe), rank: t('opp.foeNo', { n: foe.index + 1 }) }), textStyle(36, COLORS.ink)).setOrigin(0.5), width - 80);

    // 相手の札：左に絵（段階が上がるほど大きく・光る）・右に型の名と、得意・苦手の系統
    roundBox(this, width / 2, INFO.y, 640, INFO.h, COLORS.panel, { radius: 32, stroke: COLORS.frame });
    this.add.circle(ART.x, INFO.y, ART.r, 0x2a3456);
    const fig = foeArt(foe).key;
    const key = this.textures.exists(fig) ? fig : `type-${opp}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(ART.x, INFO.y, key);
      img.setScale(Math.min((ART.h * stageScale(foe.stage)) / img.height, (ART.r * 2.2) / img.width));
      if (key !== fig) img.setFlipX(true);
      this.auraTween = addAura(this, img, foeAura(foe));
    }
    const room = width - 40 - TEXT_X - 20;
    const right = (y, str, size, color) => fitText(this.add.text(TEXT_X, y, str, textStyle(size, color)).setOrigin(0, 0.5), room);
    const archs = (list) => (list.length ? list.map((a) => t(`arch.${a}`)).join(t('arch.join')) : t('arch.none'));
    const ty = TYPES[opp];
    right(INFO.y - 100, t(`type.${opp}.name`), 46, COLORS.ink);
    // 得意・苦手は長い名前が並ぶと1行に収まらない＝字 28 のまま左そろえで2行まで折る（苦手は得意の下に続ける）
    const block = (y, str, color) => wrapText(this, TEXT_X, y, str, room, 28, color, { align: 'left' }).setOrigin(0, 0);
    const strong = block(INFO.y - 68, t('opp.strongArch', { arch: archs(ty.strong) }), COLORS.ink);
    block(strong.y + strong.displayHeight + 10, t('opp.weakArch', { arch: archs(ty.weak ? ty.weak.arch : []) }), COLORS.gold);

    this.drawStats(width);

    // 決め技の札
    fitText(this.add.text(width / 2, PICK_Y, t('opp.pick'), textStyle(34, COLORS.gold)).setOrigin(0.5), width - 80);
    const cards = kimeteCards(session.run, opp);
    const pos = [[width / 2 - CARD.w - CARD.gap, CARD.row1], [width / 2, CARD.row1], [width / 2 + CARD.w + CARD.gap, CARD.row1],
      [width / 2 - (CARD.w + CARD.gap) / 2, CARD.row2], [width / 2 + (CARD.w + CARD.gap) / 2, CARD.row2]];
    cards.forEach((c, i) => this.card(c, pos[i][0], pos[i][1]));

    // ことねの一言（勧め・覚えた技が無ければ稽古の案内）
    const advice = this.rec ? t('opp.recommend', { tech: t(`newtech.${this.rec}`) }) : t('opp.noKimete');
    const ids = foeTacticsAt(foe.index); // 取組で この相手が使う攻め（取組の予告と同じ種）
    const lines = [t('opp.attacks', { list: ids.map((id) => t(`tactic.name.${id}`)).join(t('arch.join')) }),
      t('opp.foeKime', { name: t(`foekime.${foeKimeteAt(foe.index).id}`) })]; // この相手の必殺技（予告の札と同じ名前）
    if (ids.length < 3) lines.unshift(advice); // 大ボス（攻め4つ）は勧めの1行を外す（勧めは札の「おすすめ」で分かる）
    speakerFace(this, OKAMI, COACH.faceX, COACH.top + COACH.h / 2, COACH.size);
    this.coachText = speechBubble(this, COACH.left, COACH.top, COACH.w, COACH.h, lines.join('\n'), { size: COACH.font, min: COACH.min })[2];

    button(this, width / 2, GO_Y, 520, 116, t('opp.go'), () => this.go(), { size: 44 });
  }

  // 心・技・体：左があなた・右が相手
  drawStats(width) {
    const colW = 300;
    const xs = [width / 2 - colW - 20, width / 2 + 20];
    [[xs[0], 'stat.you', session.run.stats], [xs[1], 'stat.opp', this.foe.stats]].forEach(([x, head, stats]) => {
      fitText(this.add.text(x + colW / 2, STATS_Y, t(head), textStyle(28, COLORS.gold)).setOrigin(0.5), colW - 20);
      statBars(this, x, STATS_Y + 24, colW, stats);
    });
  }

  // 決め技の札1枚：覚えた＝押せる（選んだ物は朱に光る）・稽古で覚えられる・まだ（鍵と解禁の勝ち数）
  card(c, x, y) {
    const on = c.state === 'learned' && c.id === this.pick;
    const fill = on ? COLORS.panelOn : c.state === 'learned' ? COLORS.panel : COLORS.empty;
    const g = roundBox(this, x, y, CARD.w, CARD.h, fill, { radius: 22, stroke: c.state === 'locked' ? 0x5a5f6e : COLORS.frame });
    if (on) {
      const glow = this.add.graphics();
      glow.lineStyle(6, 0xfff3c4, 1).strokeRoundedRect(x - CARD.w / 2 - 4, y - CARD.h / 2 - 4, CARD.w + 8, CARD.h + 8, 26);
    }
    const nameColor = c.state === 'learned' ? COLORS.ink : COLORS.sub;
    const name = fitText(this.add.text(x, y - 24, t(`newtech.${c.id}`), textStyle(28, nameColor)).setOrigin(0.5), CARD.w - 12);
    if (c.state === 'locked') {
      name.setAlpha(0.6);
      this.lock(x - 86, y + 28);
      fitText(this.add.text(x + 14, y + 28, t('opp.locked', { n: c.at }), textStyle(28, COLORS.sub, { fontStyle: '500' })).setOrigin(0.5).setAlpha(0.8), CARD.w - 60);
    } else if (c.state === 'learnable') {
      fitText(this.add.text(x, y + 28, t('opp.canLearn'), textStyle(28, COLORS.gold, { fontStyle: '500' })).setOrigin(0.5), CARD.w - 12);
    } else {
      const k = AFF_KEY(c.aff);
      fitText(this.add.text(x, y + 28, t(`opp.aff.${k}`), textStyle(28, on ? COLORS.ink : AFF_COLOR[k])).setOrigin(0.5), CARD.w - 12);
    }
    if (c.id === this.rec) {
      // 勧めの札の上の縁に小さな金の札
      const ty = y - CARD.h / 2 + TAG.dy;
      roundBox(this, x, ty, TAG.w, TAG.h, 0xe3c27a, { radius: TAG.h / 2, shadow: false });
      fitText(this.add.text(x, ty, t('opp.recTag'), textStyle(TAG.size, '#3b2810')).setOrigin(0.5), TAG.w - 12);
    }
    if (c.state !== 'learned') return;
    const zone = hitZone(this, x, y, CARD.w, CARD.h);
    let down = false; // 押しはこの札の上で始まったものだけ数える（widgets.button と同じ）
    zone.on('pointerdown', () => { down = true; g.setAlpha(0.8); });
    zone.on('pointerout', () => { down = false; g.setAlpha(1); });
    zone.on('pointerup', () => {
      g.setAlpha(1);
      if (!down) return;
      down = false;
      if (this.pick === c.id) return;
      playBout('pon');
      this.pick = c.id;
      this.redraw();
    });
  }

  // 小さな鍵（丸い輪と四角の胴）
  lock(x, y) {
    const g = this.add.graphics();
    g.lineStyle(4, 0x8a8f9e, 1).beginPath().arc(x, y - 6, 8, Math.PI, 0, false).strokePath();
    g.fillStyle(0x8a8f9e, 1).fillRoundedRect(x - 12, y - 6, 24, 18, 4);
  }

  go() {
    session.kimete = chosenKimete(session.run, this.pick); // 覚えた物だけ（無い＝決め技無しで取る）
    this.scene.start('kensho'); // 懸賞旗（約3秒・たたくと飛ばせる）→ 取組（kami）
  }
}
