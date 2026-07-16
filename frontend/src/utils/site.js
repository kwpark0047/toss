/**
 * site.js - 배포 사이트 관련 공용 상수/헬퍼
 */

// 고객 메뉴판이 서빙되는 배포 도메인 (Vercel)
export const SITE_ORIGIN = 'https://wemarket.vercel.app';

/**
 * 매장 메뉴판 URL 생성.
 * @param {number|string} storeId
 * @param {string} [table] 테이블 번호/이름 (없으면 table= 부착 안 함)
 */
export const buildMenuUrl = (storeId, table) =>
  table != null && table !== ''
    ? `${SITE_ORIGIN}/menu/${storeId}?table=${encodeURIComponent(table)}`
    : `${SITE_ORIGIN}/menu/${storeId}`;

/**
 * 테이블 고유 QR코드 라우팅 URL 생성.
 * (QR 스캔 시 /qr/:qrCode 로 접속하여 QrResolvePage를 거쳐 메뉴판으로 이동)
 * @param {string} qrCode 테이블의 고유 qr_code
 */
export const buildQrUrl = (qrCode) => {
  if (!qrCode) return SITE_ORIGIN;
  return `${SITE_ORIGIN}/qr/${encodeURIComponent(qrCode)}`;
};
