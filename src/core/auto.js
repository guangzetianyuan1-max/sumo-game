// 場所の自動（10/11 本人「場所において、自動モードをつけてください」）：止めるまで1番ずつ取る
// 10/12 作り直し：稽古と休場を無くした（おまかせ稽古は消した）

// 場所の自動の次の一歩：自動が入っていて、場所に取組が残っていれば 'bout'・ほかは 'stop'
export function nextAutoStep(career, autoFlag) {
  const b = career?.basho;
  if (!autoFlag || !b) return 'stop';
  return b.day < b.days.length ? 'bout' : 'stop';
}
