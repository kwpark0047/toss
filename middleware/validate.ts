import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../utils/logger.js';

/**
 * Zod 스키마로 요청 검증 미들웨어 생성
 * @param {Object} schemas - { body?, query?, params?, headers? } Zod 스키마 객체
 * @returns {Function} Express 미들웨어
 */
export const validate = (schemas: { body?: any; query?: any; params?: any; headers?: any }) => {
  return (req: any, res: any, next: Function) => {
    try {
      const validated: any = {};

      // Body 검증
      if (schemas.body) {
        validated.body = schemas.body.parse(req.body);
        req.body = validated.body; // 정제된 데이터로 교체
      }

      // Query 검증
      if (schemas.query) {
        validated.query = schemas.query.parse(req.query);
        req.query = validated.query;
      }

      // Params 검증
      if (schemas.params) {
        validated.params = schemas.params.parse(req.params);
        req.params = validated.params;
      }

      // Headers 검증
      if (schemas.headers) {
        validated.headers = schemas.headers.parse(req.headers);
      }

      // 검증된 데이터를 req.validated에 저장 (컨트롤러에서 사용)
      req.validated = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Zod v4: error.issues 사용 (v3은 error.errors)
        const issues = error.issues || error.errors || [];
        const details = issues.map(err => ({
          field: err.path?.join('.') || 'unknown',
          message: err.message,
          code: err.code,
          received: err.received,
        }));

        logger.warn('[Validation] 입력 검증 실패', {
          path: req.path,
          method: req.method,
          errors: details,
          ip: req.ip,
        });

        return res.status(400).json({
          success: false,
          error: '입력 값 검증에 실패했습니다.',
          code: 'VALIDATION_ERROR',
          details,
        });
      }

      // 예상치 못한 에러
      logger.error('[Validation] 예상치 못한 검증 에러', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: '검증 중 오류가 발생했습니다.',
        code: 'VALIDATION_INTERNAL_ERROR',
      });
    }
  };
};

/**
 * 단일 스키마로 body만 검증하는 편의 함수
 * @param {z.ZodSchema} schema
 * @returns {Function}
 */
export const validateBody = (schema: any) => validate({ body: schema });

/**
 * 단일 스키마로 query만 검증하는 편의 함수
 * @param {z.ZodSchema} schema
 * @returns {Function}
 */
export const validateQuery = (schema: any) => validate({ query: schema });

/**
 * 단일 스키마로 params만 검증하는 편의 함수
 * @param {z.ZodSchema} schema
 * @returns {Function}
 */
export const validateParams = (schema: any) => validate({ params: schema });

export { validate, validateBody, validateQuery, validateParams };