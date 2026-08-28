/**
 * format.ts — 백엔드 공용 포맷 유틸
 */

/** 원화 포맷: 1234567 → "1,234,567원" (null/NaN은 0 처리) */
export const fmtWon = (n: number | string | null | undefined): string =>
  new Intl.NumberFormat('ko-KR').format(Math.round(Number(n) || 0)) + '원';

export default { fmtWon };