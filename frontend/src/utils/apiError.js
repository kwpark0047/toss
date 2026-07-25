import { toast } from 'react-toastify';

/**
 * API catch 블록 표준 핸들러.
 * - 서버 응답 메시지 우선 표시
 * - fallback 메시지 지원
 * - 개발 환경에서 전체 에러 콘솔 출력
 */
export function handleApiError(error, fallback = '요청에 실패했습니다') {
  const message =
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;
  toast.error(message);
  if (import.meta.env.DEV) console.error('[API Error]', error);
}

/**
 * 간단한 입력값 검증 실패 알림 (validation, not API error)
 */
export function notifyValidation(message) {
  toast.warn(message);
}
