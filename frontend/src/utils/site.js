/**
 * site.js - 배포 도메인 관련 공용 상수/헬퍼
 */

// Stable public customer domain; never use a deployment-specific preview URL.
export const SITE_ORIGIN = (
  import.meta.env.VITE_PUBLIC_SITE_URL || 'https://wemarket-saas.vercel.app'
).replace(/\/+$/, '');

/**
 * 매장 메뉴판 URL 생성.
 * @param {number|string} storeId
 * @param {string} [table] 테이블 번호/이름 (없으면 table= 파라미터 제외)
 */
export const buildMenuUrl = (storeId, table) =>
  table != null && table !== ''
    ? `${SITE_ORIGIN}/menu/${encodeURIComponent(storeId)}?table=${encodeURIComponent(table)}`
    : `${SITE_ORIGIN}/menu/${encodeURIComponent(storeId)}`;

/**
 * 테이블 고유 QR코드 라우팅 URL 생성.
 * (QR 스캔 시 /qr/:qrCode 로 접속하여 QrResolvePage를 거쳐 메뉴판으로 이동)
 * @param {string} qrCode 테이블의 고유 qr_code
 */
export const buildQrUrl = (qrCode) => {
  if (!qrCode) return SITE_ORIGIN;
  return `${SITE_ORIGIN}/qr/${encodeURIComponent(qrCode)}`;
};
