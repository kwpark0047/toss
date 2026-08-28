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

export const isProduction = process.env.NODE_ENV === 'production';

// ── 프론트엔드 URL ──────────────────────────────────────────
// 고객용 QR 메뉴 페이지, 점주 대시보드 등
export const FRONTEND_URL = process.env.FRONTEND_URL || 'https://toss.wemarket.workers.dev';

// ── 백엔드 URL ──────────────────────────────────────────────
// API 서버, Socket.IO 엔드포인트
export const BACKEND_URL = process.env.BACKEND_URL || 'https://wemarket-toss.onrender.com';

// ── CORS 허용 오리진 목록 ──────────────────────────────────────
// 프로덕션: FRONTEND_URL + BACKEND_URL + CORS_ORIGIN 환경변수
// 개발: localhost 4종 추가
export function getAllowedOrigins(): string[] {
  const origins: string[] = [
    // 명시적 환경변수 설정이 있으면 최우선
    FRONTEND_URL,
    BACKEND_URL,
    // 현재 운영 프론트엔드 도메인 (CORS 허용 안전망)
    'https://toss.wemarket.workers.dev',
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
    process.env.CORS_ORIGIN.split(',').forEach((origin: string) => {
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

// ── 프리뷰 배포 오리진 허용 규칙 ────────────────────────────────
//
// [보안 배경]
// 과거에는 `origin.endsWith('.pages.dev' | '.workers.dev' | '.vercel.app')` 로
// 판정했다. 이 플랫폼들은 누구나 무료로 배포할 수 있으므로 공격자가
// `evil.pages.dev` 를 띄우면 `credentials: true` 조합에서 인증 쿠키가 실린
// 크로스 오리진 요청이 그대로 허용된다(사실상 CSRF/세션 탈취 경로).
//
// [현재 규칙]
// 허용은 **우리가 소유한 프로젝트의 하위 도메인**으로만 좁힌다.
//   - Cloudflare Pages 프리뷰: <hash>.<project>.pages.dev
//   - Cloudflare Workers 프리뷰: <version>.<worker>.<account>.workers.dev
// 즉 화이트리스트에 등록된 오리진의 호스트를 suffix 로 삼아 그 하위 도메인만
// 통과시킨다. 임의의 `*.pages.dev` 는 더 이상 통과하지 않는다.
//
// 추가 예외가 필요하면 CORS_ORIGIN(정확 일치) 또는
// CORS_PREVIEW_SUFFIXES(콤마 구분, 하위 도메인 허용)로 명시한다.
//
// [2026-08-21] Vercel에서 Cloudflare Workers/Cloudflare Pages로 이전하면서
// 기존 vercel.app, vercel.app 서픽스 관련 로직 제거 (C-3 보안 이슈 대응)

/** 하위 도메인 프리뷰를 허용할 호스트 목록 */
export function getPreviewSuffixes(allowedOrigins: string[]): string[] {
  const suffixes = new Set<string>();

  // 화이트리스트 오리진 중 프리뷰가 생기는 플랫폼 호스트만 suffix 로 채택
  const PREVIEW_PLATFORMS = ['.pages.dev', '.workers.dev'];
  for (const origin of allowedOrigins) {
    let host: string;
    try {
      host = new URL(origin).hostname;
    } catch {
      continue;
    }
    if (PREVIEW_PLATFORMS.some((p) => host.endsWith(p))) {
      suffixes.add(host);
    }
  }

  // 운영 예외: 명시적으로 지정한 호스트의 하위 도메인 허용
  if (process.env.CORS_PREVIEW_SUFFIXES) {
    process.env.CORS_PREVIEW_SUFFIXES.split(',').forEach((s: string) => {
      const trimmed = s.trim().replace(/^\./, '');
      if (trimmed) suffixes.add(trimmed);
    });
  }

  return [...suffixes];
}

/**
 * 오리진 허용 여부 판정.
 * @param {string|undefined} origin  Origin 헤더 (동일 출처/서버간 호출은 undefined)
 * @param {string[]} [allowedOrigins]
 * @returns {boolean}
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins = getAllowedOrigins()): boolean {
  // Origin 헤더가 없는 요청(서버 간 호출, curl, 동일 출처 네비게이션)은 CORS 대상이 아님
  if (!origin) return true;

  if (allowedOrigins.includes(origin)) return true;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false; // 파싱 불가한 Origin 은 거부
  }

  // https 가 아닌 프리뷰는 허용하지 않는다 (개발용 localhost 는 위 정확 일치로 처리)
  if (url.protocol !== 'https:') return false;

  const host = url.hostname;
  return getPreviewSuffixes(allowedOrigins).some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

// ── 프론트엔드용 설정 ──────────────────────────────────────
// 클라이언트 측에서 사용하는 환경변수 (import.meta.env)
export const FRONTEND_CONFIG = {
  API_URL: process.env.VITE_API_URL || null, // null이면 동적 감지
  BACKEND_URL: process.env.VITE_BACKEND_URL || BACKEND_URL,
  SOCKET_URL: process.env.VITE_SOCKET_URL || BACKEND_URL,
};