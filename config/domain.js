/**
 * 도메인 설정 모듈
 * 
 * 모든 하드코딩된 도메인 URL을 환경변수 기반으로 통합 관리합니다.
 * 상용화 시 FRONTEND_URL / BACKEND_URL 환경변수만 변경하면 전체 도메인이 전환됩니다.
 * 
 * env 설정 우선순위:
 *   1. FRONTEND_URL / BACKEND_URL (명시적 설정)
 *   2. 기존 하드코딩된 기본값 (개발/현재 배포용)
 */

const isProduction = process.env.NODE_ENV === 'production';

// ── 프론트엔드 URL ──────────────────────────────────────────
// 고객용 QR 메뉴 페이지, 점주 대시보드 등
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://toss.wemarket.workers.dev';

// ── 백엔드 URL ──────────────────────────────────────────────
// API 서버, Socket.IO 엔드포인트
const BACKEND_URL = process.env.BACKEND_URL || 'https://wemarket-toss.onrender.com';

// ── CORS 허용 오리진 목록 ──────────────────────────────────────
// 프로덕션: FRONTEND_URL + BACKEND_URL + CORS_ORIGIN 환경변수
// 개발: localhost 4종 추가
function getAllowedOrigins() {
    const origins = [
        // 명시적 환경변수 설정이 있으면 최우선
        FRONTEND_URL,
        BACKEND_URL,
        // 기존 배포 도메인 (하위 호환)
        'https://frontend-gamma-ten-89.vercel.app',
        'https://wemarket.onrender.com',
        'https://wemarket.vercel.app',
        'https://250105.vercel.app',
        'https://wemarket-6k6.pages.dev',
        'https://250105.kangwonpark71.workers.dev',
    ];

    // CORS_ORIGIN 환경변수로 추가 도메인 허용
    if (process.env.CORS_ORIGIN) {
        process.env.CORS_ORIGIN.split(',').forEach(origin => {
            const trimmed = origin.trim();
            if (trimmed && !origins.includes(trimmed)) {
                origins.push(trimmed);
            }
        });
    }

    // 개발 환경에서만 localhost 허용
    if (!isProduction) {
        origins.push(
            'http://localhost:3000',
            'http://localhost:3002',
            'http://localhost:5173',
            'http://localhost:5174'
        );
    }

    // 중복 제거
    return [...new Set(origins)];
}

// ── 프론트엔드용 설정 ──────────────────────────────────────
// 클라이언트 측에서 사용하는 환경변수 (import.meta.env)
const FRONTEND_CONFIG = {
    API_URL: process.env.VITE_API_URL || null, // null이면 동적 감지
    BACKEND_URL: process.env.VITE_BACKEND_URL || BACKEND_URL,
    SOCKET_URL: process.env.VITE_SOCKET_URL || BACKEND_URL,
};

module.exports = {
    FRONTEND_URL,
    BACKEND_URL,
    getAllowedOrigins,
    FRONTEND_CONFIG,
    isProduction,
};
