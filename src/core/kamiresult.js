// 紙相撲の決まり手（落ち方から付ける）。決め技で決まった時は、出した側の決め技の id（KIMETE の id・名前は newtech.<id>）
// 決め技の系統（arch）と KIMETE は1対1。KIMETE に無い系統なら押し出し
import { KIMETE } from '../data/kimete.js?v=34';

const BY_HOW = { finisher: 'oshidashi', down: 'tsukitaoshi', push: 'tsukiotoshi' };
export function kimariteOf(st) {
  if (st.how === 'finisher') {
    const arch = st.finisherArch || (st.lastKimete ? st.lastKimete.arch : null);
    const k = KIMETE.find((x) => x.arch === arch);
    return k ? k.id : BY_HOW.finisher;
  }
  return Object.prototype.hasOwnProperty.call(BY_HOW, st.how) ? BY_HOW[st.how] : 'oshidashi';
}
