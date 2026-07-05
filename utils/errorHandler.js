const logger = require('./logger');

class AppError extends Error {
  constructor(message, statusCode, code, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorTypes = {
  // Authentication errors (1000-1099)
  AUTH_INVALID_CREDENTIALS: {
    code: 1001,
    status: 401,
    message: '이메일 또는 비밀번호가 올바르지 않습니다.'
  },
  AUTH_TOKEN_EXPIRED: {
    code: 1002,
    status: 401,
    message: '인증 토큰이 만료되었습니다.'
  },
};

const errorHandler = (err, req, res, next) => {
  // 1. 에러 로그 기록 (Winston 사용)
  logger.error(err);

  // Default error response
  let error = {
    success: false,
    message: '예상치 못한 오류가 발생했습니다.',
    code: 'INTERNAL_SERVER_ERROR',
    status: 500,
    details: {}
  };

  // 2. 에러 타입별 상세 처리
  if (err instanceof AppError) {
    error = {
      success: false,
      message: err.message,
      code: err.code,
      status: err.statusCode,
      details: err.details
    };
  } else if (err.name === 'ValidationError' || err.name === 'JoiValidationError') {
    error = {
      success: false,
      message: '입력값 검증에 실패했습니다.',
      code: 'VALIDATION_ERROR',
      status: 400,
      details: err.details || (err.errors ? Object.values(err.errors).map(e => e.message) : err.message)
    };
  } else if (err.code === 'P2002') {
    // Prisma Unique Constraint Violation
    error = {
      success: false,
      message: '중복된 데이터가 존재합니다.',
      code: 'DUPLICATE_ERROR',
      status: 409,
      details: err.meta
    };
  } else {
    // 일반 에러의 경우에도 메시지를 포함하여 'y' 같은 현상 방지
    error.message = err.message || error.message;
    error.details = { rawMessage: err.message };
  }

  // 3. 보안을 위해 개발 환경에서만 스택 트레이스 포함
  if (process.env.NODE_ENV === 'development') {
    error.stack = err.stack;
  }

  // 4. 컨텍스트와 함께 시스템 로그 기록
  logError({
    message: err.message,
    status: error.status,
    url: req.originalUrl,
    method: req.method,
    user: req.user ? req.user.id : 'anonymous',
    ip: req.ip
  });

  res.status(error.status).json(error);
};

// 구조화된 로깅 서버 유틸리티
const logError = (data) => {
  logger.error(`[API Error] ${data.method} ${data.url} - Status: ${data.status} - User: ${data.user}`, {
    context: {
      ip: data.ip,
      status: data.status
    }
  });
};

module.exports = {
  AppError,
  errorHandler,
  errorTypes,
  logError
};
