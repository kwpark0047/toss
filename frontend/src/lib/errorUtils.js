/**
 * API 에러에서 사용자 메시지 추출
 * @param {unknown} error
 * @returns {string}
 */
export function extractErrorMessage(error) {
  if (!error) return '알 수 없는 오류가 발생했습니다.';

  // axios error shape
  if (error.response?.data) {
    const d = error.response.data;
    return d.message || d.error || d.details?.rawMessage || `서버 오류 (${error.response.status})`;
  }

  if (error.message) return error.message;

  return '네트워크 오류가 발생했습니다.';
}

/**
 * 표준화된 API 에러 객체
 */
export class ApiError extends Error {
  /**
   * @param {string} message 사용자 메시지
   * @param {number} [status]
   * @param {unknown} [data]
   */
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status || 0;
    this.data = data;
  }
}

/**
 * TanStack Query의 onError 콜백에서 사용할 에러 처리기
 * 컴포넌트 내 toast 호출을 직접 하지 않고 이벤트로 전파할 수 있도록
 * onQueryError는 Error만 throw하고, 상위 ErrorBoundary가 캐치한다.
 *
 * @param {unknown} error
 * @returns {never}
 */
export function onQueryError(error) {
  const msg = extractErrorMessage(error);
  throw new ApiError(msg, error?.response?.status);
}

/**
 * @param {unknown} error
 * @returns {string} 사용자 표시용 오류 메시지
 */
export const getApiErrorMessage = extractErrorMessage;
