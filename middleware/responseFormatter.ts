import { Request, Response, NextFunction } from 'express';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  status: 'success' | 'error';
  message: string;
  data?: any;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

declare global {
  namespace Express {
    interface Response {
      success: (data?: any, message?: string, statusCode?: number) => Response;
      created: (data?: any, message?: string) => Response;
      updated: (data?: any, message?: string) => Response;
      noContent: () => Response;
      paginated: (data: any, pagination: { total: number; page: number; limit: number }, message?: string, statusCode?: number) => Response;
    }
  }
}

const responseFormatter = (req: any, res: Response, next: NextFunction) => {
  // Success response method (default 200)
  res.success = (data?: any, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      status: 'success',
      message,
      data
    });
  };

  // 201 Created (POST)
  res.created = (data?: any, message = 'Created') => {
    return res.status(201).json({
      success: true,
      status: 'success',
      message,
      data
    });
  };

  // 200 Updated (PUT/PATCH)
  res.updated = (data?: any, message = 'Updated') => {
    return res.status(200).json({
      success: true,
      status: 'success',
      message,
      data
    });
  };

  // 204 No Content (DELETE / successful mutation with no body)
  res.noContent = () => {
    return res.status(204).end();
  };

  // Pagination response method
  res.paginated = (data: any, pagination: { total: number; page: number; limit: number }, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      status: 'success',
      message,
      data: data,
      pagination: {
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(pagination.total / pagination.limit)
      }
    });
  };

  next();
};

export default responseFormatter;