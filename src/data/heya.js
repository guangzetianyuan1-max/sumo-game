// 相撲部屋の3つ（10/11 本人「入門部屋を選べる・女子は各部屋に在籍・各部屋に親方」）。娘＝案内役（guides.js）・得意の稽古は伸びが1割多い（tuning.js の SPECIALTY_MULT）
// 名・親方・紹介・得意の文は i18n の heya.<id>.name / .oyakata / .desc / .specialty。親方の顔は assets/guides/oyakata_<id>.png（届いたら assets/guides/index.json に id を書く）
// 一代記は今までどおり guide を持ち、部屋はそこから引く（記録の形は変えない）
export const HEYA_IDS = ['tsurumai', 'suzukaze', 'kotonami'];
export const HEYA = {
  tsurumai: { guide: 'chizuru', specialty: 'moushiai' },
  suzukaze: { guide: 'suzu', specialty: 'butsukari' },
  kotonami: { guide: 'kotone', specialty: 'waza' },
};

// 娘（案内役）の id → 部屋の id（知らない娘は null）
export function heyaOfGuide(guide) {
  for (const id of HEYA_IDS) if (HEYA[id].guide === guide) return id;
  return null;
}
