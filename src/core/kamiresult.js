// 紙相撲の決まり手（落ち方から付ける・第2段で決め技15の名前に替える）
const BY_HOW = { finisher: 'oshidashi', down: 'tsukitaoshi', push: 'tsukiotoshi' };
export function kimariteOf(st) {
  return Object.prototype.hasOwnProperty.call(BY_HOW, st.how) ? BY_HOW[st.how] : 'oshidashi';
}
