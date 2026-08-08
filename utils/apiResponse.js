/**
 * 표준화된 API 응답 헬퍼
 * 모든 컨트롤러는 이 모듈을 통해 응답을 통일한다.
 */

const SUCCESS_CODE = 200;
const CREATED_CODE = 201;

/**
 * 성공 응답
 * @param {Object} res - Express Response 객체
 * @param {any} data - 응답 데이터
 * @param {string} message - 성공 메시지 (선택)
 * @param {number} statusCode - HTTP 상태 코드 (기본 200)
 */
function success(res, data, message = '성공', statusCode = SUCCESS_CODE) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * 생성 성공 응답 (201)
 */
function created(res, data, message = '생성되었습니다') {
  return success(res, data, message, CREATED_CODE);
}

/**
 * 페이지네이션 응답
 */
function paginated(res, data, pagination, message = '조회 성공') {
  return res.status(SUCCESS_CODE).json({
    success: true,
    message,
    data,
    pagination,
  });
}

/**
 * 에러 응답
 * @param {Object} res - Express Response 객체
 * @param {string} message - 에러 메시지
 * @param {number} statusCode - HTTP 상태 코드 (기본 400)
 * @param {any} details - 상세 에러 정보 (선택)
 */
function error(
  res,
  message = '요청 처리 중 오류가 발생했습니다',
  statusCode = 400,
  details = null
) {
  const response = {
    success: false,
    message,
  };
  if (details !== null) {
    response.details = details;
  }
  return res.status(statusCode).json(response);
}

/**
 * 유효성 검사 에러 응답 (400)
 */
function validationError(res, details, message = '입력값이 올바르지 않습니다') {
  return error(res, message, 400, details);
}

/**
 * 인증 에러 응답 (401)
 */
function unauthorized(res, message = '인증이 필요합니다') {
  return error(res, message, 401);
}

/**
 * 권한 에러 응답 (403)
 */
function forbidden(res, message = '권한이 없습니다') {
  return error(res, message, 403);
}

/**
 * 찾을 수 없음 응답 (404)
 */
function notFound(res, message = '요청한 리소스를 찾을 수 없습니다') {
  return error(res, message, 404);
}

/**
 * 서버 에러 응답 (500)
 */
function serverError(res, message = '서버 내부 오류가 발생했습니다', details = null) {
  return error(res, message, 500, details);
}

/**
 * 너무 많은 요청 응답 (429)
 */
function tooManyRequests(res, message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요') {
  return error(res, message, 429);
}

/**
 * 비즈니스 로직 에러 (409 Conflict 등)
 */
function conflict(res, message = '이미 존재하는 리소스입니다', details = null) {
  return error(res, message, 409, details);
}

module.exports = {
  success,
  created,
  paginated,
  error,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  tooManyRequests,
  conflict,
};
