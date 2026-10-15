// 画面が開いた直後の押しを受けない（10/15 バグ出し：取組の大きなボタンの連打が、次の画面の「もう一度」「稽古へ」「次へ」に落ちた）。
// 画面ごとに「この時刻までは押しを受けない」を1つ持つ。画面を閉じる（shutdown）と消え、次に開いた時に付け直す。
// 押し始め（pointerdown）がこの間なら、その押しは数えない（離しても何も起きない）。Phaser を使わない（試験は node で回す）
export const OPEN_GUARD_MS = 300; // ふつうの画面
export const OPEN_GUARD_LONG_MS = 600; // 取組の後（大きなボタンの真下にボタンがある）

const clock = () => Date.now();

// 今から ms の間は押しを受けない（画面の create の最初で呼ぶ・呼ばなければ最初のボタンを置いた時に OPEN_GUARD_MS で付く）
export function guardOpen(scene, ms = OPEN_GUARD_MS, now = clock()) {
  scene.openGuardUntil = now + ms;
  if (!scene.openGuardHooked && scene.events && typeof scene.events.on === 'function') {
    scene.openGuardHooked = true; // 画面の物は使い回される＝閉じるたびに消す口は1回だけ付ける
    scene.events.on('shutdown', () => { scene.openGuardUntil = null; });
  }
}

// ボタンや札を置いた時：まだ付いていなければ今から OPEN_GUARD_MS（画面が開いた時刻＝最初のボタンを置いた時刻）
export function armOpenGuard(scene, now = clock()) {
  if (scene.openGuardUntil === null || scene.openGuardUntil === undefined) guardOpen(scene, OPEN_GUARD_MS, now);
}

// 今の押しを受けないか（開いた直後なら true）
export function openGuarded(scene, now = clock()) {
  const until = scene.openGuardUntil;
  return typeof until === 'number' && now < until;
}
