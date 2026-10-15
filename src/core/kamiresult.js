// 紙相撲の決まり手（落ち方から付ける）。決め技で決まった時は、出した側の決め技の id（KIMETE の id・名前は newtech.<id>）
// 決め技の系統（arch）と KIMETE は1対1。KIMETE に無い系統なら押し出し
import { KIMETE } from '../data/kimete.js?v=41';

const BY_HOW = { finisher: 'oshidashi', down: 'tsukitaoshi', push: 'tsukiotoshi' };
export function kimariteOf(st) {
  if (st.how === 'finisher') {
    const arch = st.finisherArch || (st.lastKimete ? st.lastKimete.arch : null);
    const k = KIMETE.find((x) => x.arch === arch);
    return k ? k.id : BY_HOW.finisher;
  }
  return Object.prototype.hasOwnProperty.call(BY_HOW, st.how) ? BY_HOW[st.how] : 'oshidashi';
}

// 敵の必殺技（foekimete.js の id・名前は foekime.<id>）で決まった時だけ、その id（無ければ null）。
// 決まり手の札は主人公の決め技の名前（kimariteOf）でなく、相手の必殺技の名前を出す（10/15 バグ出し：負けた時に主人公の技の名前が出た）
export function foeKimeOf(st) {
  if (st.how !== 'finisher' || !st.lastKimete || !st.lastKimete.kime) return null;
  return st.lastKimete.side === st.finisherBy ? st.lastKimete.kime : null;
}
