import { Request, Response, NextFunction } from 'express';
import logger from './logger.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, unknown>;
  public readonly isOperational = true;

  constructor(message: string, statusCode: number, code: string, details: Record<string, unknown> = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorTypes = {
  // ── Authentication (1000-1099) ──
  AUTH_INVALID_CREDENTIALS: {
    code: 1001, status: 401, message: '이메일 또는 비밀번호가 올바르지 않습니다.'
  },
  AUTH_TOKEN_EXPIRED: {
    code: 1002, status: 401, message: '인증 토큰이 만료되었습니다.'
  },
  AUTH_TOKEN_INVALID: {
    code: 1003, status: 401, message: '유효하지 않은 인증 토큰입니다.'
  },
  AUTH_REFRESH_FAILED: {
    code: 1004, status: 401, message: '토큰 갱신에 실패했습니다. 다시 로그인해 주세요.'
  },
  AUTH_2FA_REQUIRED: {
    code: 1005, status: 401, message: '2단계 인증이 필요합니다.'
  },
  AUTH_2FA_INVALID: {
    code: 1006, status: 401, message: '인증번호가 올바르지 않습니다.'
  },
  AUTH_2FA_EXPIRED: {
    code: 1007, status: 401, message: '인증번호가 만료되었습니다. 다시 요청해 주세요.'
  },
  AUTH_OTP_SEND_FAILED: {
    code: 1008, status: 500, message: '인증번호 발송에 실패했습니다.'
  },
  AUTH_FORBIDDEN: {
    code: 1009, status: 403, message: '접근 권한이 없습니다.'
  },
  AUTH_SOCIAL_PROVIDER_ERROR: {
    code: 1010, status: 502, message: '소셜 로그인 제공자 통신 중 오류가 발생했습니다.'
  },
  AUTH_SOCIAL_ACCOUNT_EXISTS: {
    code: 1011, status: 409, message: '이미 연결된 소셜 계정입니다.'
  },

  // ── Validation & Input (1100-1199) ──
  VALIDATION_ERROR: {
    code: 1101, status: 400, message: '입력값이 올바르지 않습니다.'
  },
  VALIDATION_REQUIRED_FIELD: {
    code: 1102, status: 400, message: '필수 입력값이 누락되었습니다.'
  },
  VALIDATION_INVALID_FORMAT: {
    code: 1103, status: 400, message: '입력 형식이 올바르지 않습니다.'
  },
  VALIDATION_DUPLICATE: {
    code: 1104, status: 409, message: '이미 존재하는 데이터입니다.'
  },

  // ── Resource & Business Logic (2000-2099) ──
  NOT_FOUND: {
    code: 2001, status: 404, message: '리소스를 찾을 수 없습니다.'
  },
  DUPLICATE_ENTRY: {
    code: 2002, status: 409, message: '중복된 항목이 존재합니다.'
  },
  RESOURCE_CONFLICT: {
    code: 2003, status: 409, message: '리소스 충돌이 발생했습니다.'
  },
  RESOURCE_LOCKED: {
    code: 2004, status: 423, message: '현재 리소스가 잠겨 있습니다.'
  },
  RATE_LIMIT_EXCEEDED: {
    code: 2005, status: 429, message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.'
  },
  INSUFFICIENT_STOCK: {
    code: 2006, status: 409, message: '재고가 부족합니다.'
  },
  ORDER_ALREADY_PAID: {
    code: 2007, status: 409, message: '이미 결제 완료된 주문입니다.'
  },
  ORDER_NOT_FOUND: {
    code: 2008, status: 404, message: '주문을 찾을 수 없습니다.'
  },
  STORE_NOT_FOUND: {
    code: 2009, status: 404, message: '매장을 찾을 수 없습니다.'
  },
  PRODUCT_NOT_FOUND: {
    code: 2010, status: 404, message: '메뉴를 찾을 수 없습니다.'
  },
  PAYMENT_FAILED: {
    code: 2011, status: 402, message: '결제 처리 중 오류가 발생했습니다.'
  },
  PLAN_LIMIT_EXCEEDED: {
    code: 2012, status: 403, message: '현재 요금제에서 사용할 수 없는 기능입니다.'
  },

  // ── Database & Server (5000-5099) ──
  DB_CONNECTION_ERROR: {
    code: 5001, status: 503, message: '데이터베이스 연결에 실패했습니다.'
  },
  DB_TIMEOUT: {
    code: 5002, status: 504, message: '데이터베이스 응답 시간을 초과했습니다.'
  },
  DB_UNIQUE_CONSTRAINT: {
    code: 5003, status: 409, message: '중복된 데이터가 존재합니다.'
  },
  DB_FOREIGN_KEY: {
    code: 5004, status: 409, message: '참조 무결성 오류가 발생했습니다.'
  },
  EXTERNAL_API_ERROR: {
    code: 5010, status: 502, message: '외부 API 통신 중 오류가 발생했습니다.'
  },
  EXTERNAL_API_TIMEOUT: {
    code: 5011, status: 504, message: '외부 API 응답 시간을 초과했습니다.'
  },
  FILE_UPLOAD_FAILED: {
    code: 5020, status: 500, message: '파일 업로드에 실패했습니다.'
  },
  FILE_TOO_LARGE: {
    code: 5021, status: 413, message: '파일 크기가 제한을 초과했습니다.'
  },
  INTERNAL_SERVER_ERROR: {
    code: 9999, status: 500, message: '서버 내부 오류가 발생했습니다.'
  },
};

// next는 미사용이지만 Express가 4-인자 시그니처로 에러 미들웨어를 인식하므로 유지
export const errorHandler = (err: any, req: any, res: any, _next: Function) => {
  // 1. 에러 로그 기록 (Winston 사용)
  if (err instanceof Error) {
    logger.error(err);
  } else {
    logger.error(typeof err === 'string' ? err : JSON.stringify(err));
  }

  // Default error response
  let error: any = {
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
  if (process.env.NODE_ENV === 'development' && err instanceof Error) {
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
export const logError = (data: {
  message: string | undefined;
  status: number;
  url: string;
  method: string;
  user: string;
  ip: string;
}) => {
  logger.error(`[API Error] ${data.method} ${data.url} - Status: ${data.status} - User: ${data.user}`, {
    context: {
      ip: data.ip,
      status: data.status
    }
  });
};

export { AppError, errorHandler, errorTypes, logError };