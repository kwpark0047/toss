// 전역 타입 정의 — Express 확장, 공통 타입 등

import 'express';
import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      /** 인증된 사용자 정보 */
      user?: {
        id: number;
        role: 'super_admin' | 'owner' | 'manager' | 'staff' | 'kitchen';
        email?: string;
        phone?: string;
      };
      /** 매장 ID (storeAuth 미들웨어에서 설정) */
      storeId?: number;
      /** 매장 내 역할 */
      storeRole?: string;
      /** 주문 결제 capability */
      orderCapability?: {
        orderId: number;
        storeId: number;
        capabilities: string[];
        expiresAt: number;
      };
      /** 고객 주문내역 조회 capability */
      customerHistoryCapability?: {
        phone: string;
        toss_user_key?: string;
        expiresAt: number;
      };
      /** 검증된 입력 데이터 (Zod 미들웨어에서 설정) */
      validated?: {
        body?: Record<string, unknown>;
        query?: Record<string, unknown>;
        params?: Record<string, unknown>;
        headers?: Record<string, unknown>;
      };
      /** DataLoader 인스턴스들 (요청 단위) */
      dataLoaders?: {
        orderLoader: any;
        orderItemsLoader: any;
        orderPaymentsLoader: any;
        storeLoader: any;
        productLoader: any;
        userLoader: any;
      };
      /** 아이디empotency 키 */
      idempotencyKey?: string;
    }

    interface Response {
      /** 표준 성공 응답 */
      success: (data?: any, message?: string) => Response;
      /** 생성됨 (201) */
      created: (data?: any, message?: string) => Response;
      /** 페이지네이션 응답 */
      paginated: (items: any[], meta: any, message?: string) => Response;
    }
  }

  // JWT 확장
  interface JwtPayload {
    id: number;
    role: string;
    type: 'access' | 'refresh';
    storeId?: number;
  }
}

// 공통 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
  details?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 공통 에러 코드
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT',
  IDEMPOTENCY_REPLAYED = 'IDEMPOTENCY_REPLAYED',
  VALIDATION_INTERNAL_ERROR = 'VALIDATION_INTERNAL_ERROR',
}

// 공통 권한
export type StoreRole = 'owner' | 'manager' | 'staff' | 'kitchen';
export type UserRole = 'super_admin' | StoreRole;

export const STORE_PERMISSIONS = {
  owner: [
    'store:update', 'store:delete', 'items:manage', 'orders:manage',
    'staff:manage', 'stats:read', 'order:read', 'settings:read', 'settings:write',
  ],
  manager: [
    'store:read', 'store:update', 'settings:read', 'settings:write', 'settings:update',
    'items:manage', 'products:write', 'products:manage', 'orders:read', 'orders:update',
    'orders:manage', 'customers:read', 'customers:write', 'staff:manage', 'stats:read', 'order:read',
  ],
  staff: ['orders:manage', 'order:read'],
  kitchen: ['orders:read', 'orders:update', 'orders:manage', 'order:read'],
} as const;

// 공통 주문 상태
export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'preparing' 
  | 'ready' 
  | 'completed' 
  | 'cancelled' 
  | 'refunded' 
  | 'partially_refunded';

// 결제 수단
export type PaymentMethod = 
  | 'cash' 
  | 'card' 
  | 'transfer' 
  | 'kakao_pay' 
  | 'naver_pay' 
  | 'toss_pay' 
  | 'point' 
  | 'mixed';

// 알림 타입
export type NotificationType = 
  | 'order_created' 
  | 'order_confirmed' 
  | 'order_preparing' 
  | 'order_ready' 
  | 'order_completed' 
  | 'order_cancelled' 
  | 'payment_success' 
  | 'payment_failed' 
  | 'review_created' 
  | 'system';

// Socket.IO 이벤트 타입
export interface SocketEvents {
  'order-updated': (data: { order_id: number; status: OrderStatus; store_id: number }) => void;
  'order-created': (data: { order_id: number; store_id: number }) => void;
  'kds-order': (data: any) => void;
  'waiting-updated': (data: any) => void;
  'chat-message': (data: any) => void;
}

// Prisma 모델 타입 (자동 생성되지만 확장용)
export interface PrismaModels {
  User: any;
  Store: any;
  Product: any;
  Category: any;
  Order: any;
  OrderItem: any;
  Payment: any;
  Table: any;
  Waiting: any;
  Reservation: any;
  Staff: any;
  Coupon: any;
  UserCoupon: any;
  PointTransaction: any;
  Review: any;
  Notification: any;
  StaffSchedule: any;
  StaffAttendance: any;
  Inventory: any;
  StockHistory: any;
  Settlement: any;
  Ledger: any;
  PrintJob: any;
  AuditLog: any;
  FeatureFlag: any;
  Plan: any;
  PlanRequest: any;
  SocialAccount: any;
  AdminOtp: any;
  News: any;
  StoreReceiptSettings: any;
  CampaignSettings: any;
  OptionTemplate: any;
  StoreLinkRequest: any;
  StoreTierSettings: any;
  StoreFavorite: any;
  StorePartnership: any;
  FoodTruck: any;
  Alimtalk: any;
  WebhookEndpoint: any;
  WebhookDelivery: any;
  ApiKey: any;
}

export {};