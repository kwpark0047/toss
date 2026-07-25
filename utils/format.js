/**
 * format.js — 백엔드 공용 포맷 유틸
 */

/** 원화 포맷: 1234567 → "1,234,567원" (null/NaN은 0 처리) */
const fmtWon = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n || 0)) + '원';

module.exports = { fmtWon };
