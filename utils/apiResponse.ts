import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: any;
  details?: any;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const SUCCESS_CODE = 200;
const CREATED_CODE = 201;

export const success = <T>(res: any, data: T, message = '성공', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  } as ApiResponse<T>);
};

export const created = <T>(res: any, data: T, message = '생성되었습니다') => {
  return success(res, data, message, 201);
};

export const paginated = <T>(res: any, data: T[], pagination: PaginationMeta, message = '조회 성공') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  } as ApiResponse<T[]>);
};

export const error = (
  res: any,
  message = '요청 처리 중 오류가 발생했습니다',
  statusCode = 400,
  details: any = null
) => {
  const response: any = {
    success: false,
    message,
  };
  if (details !== null) {
    response.details = details;
  }
  return res.status(statusCode).json(response);
};

export const validationError = (res: any, details: any, message = '입력값이 올바르지 않습니다') => {
  return error(res, message, 400, details);
};

export const unauthorized = (res: any, message = '인증이 필요합니다') => {
  return error(res, message, 401);
};

export const forbidden = (res: any, message = '권한이 없습니다') => {
  return error(res, message, 403);
};

export const notFound = (res: any, message = '요청한 리소스를 찾을 수 없습니다') => {
  return error(res, message, 404);
};

export const serverError = (res: any, message = '서버 내부 오류가 발생했습니다', details = null) => {
  return error(res, message, 500, details);
};

export const tooManyRequests = (res: any, message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요') => {
  return error(res, message, 429);
};

export const conflict = (res: any, message = '이미 존재하는 리소스입니다', details = null) => {
  return error(res, message, 409, details);
};

export default {
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