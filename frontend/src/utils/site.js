/**
 * site.js — 배포 사이트 관련 공용 상수/헬퍼
 */

// 고객 메뉴판이 서빙되는 배포 도메인 (Vercel)
export const SITE_ORIGIN = 'https://wemarket.vercel.app';

/**
 * 매장 메뉴판 URL 생성.
 * @param {number|string} storeId
 * @param {string} [table] 테이블 번호/이름 (있으면 ?table= 부착)
 */
export const buildMenuUrl = (storeId, table) =>
  table != null && table !== ''
    ? `${SITE_ORIGIN}/menu/${storeId}?table=${encodeURIComponent(table)}`
    : `${SITE_ORIGIN}/menu/${storeId}`;
