/**
 * 매장 관련 Zod 검증 스키마 (body 직접 스키마)
 */

const { z } = require('zod');

// 공통
const businessNumberSchema = z.string().regex(/^\d{3}-\d{2}-\d{5}$/, '사업자등록번호 형식: 123-45-67890');
const phoneSchema = z.string().regex(/^01[0-9][0-9]{7,8}$/, '유효하지 않은 한국 전화번호 형식입니다.');
const accountNumberSchema = z.string().regex(/^\d{10,14}$/, '계좌번호는 10~14자리 숫자입니다.');
const bankCodeSchema = z.string().min(2).max(20);

// 매장 생성
const createStoreSchema = z.object({
  name: z.string().min(1, '매장명은 필수입니다.').max(200),
  address: z.string().max(500).optional(),
  detailAddress: z.string().max(500).optional(),
  zipCode: z.string().regex(/^\d{5}$/, '우편번호는 5자리입니다.').optional(),
  phone: phoneSchema.optional(),
  businessNumber: businessNumberSchema.optional(),
  category: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timezone: z.string().default('Asia/Seoul'),
  currency: z.string().length(3).default('KRW'),
});

// 매장 수정
const updateStoreSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional().nullable(),
  detailAddress: z.string().max(500).optional().nullable(),
  zipCode: z.string().regex(/^\d{5}$/).optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  businessNumber: businessNumberSchema.optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
  isActive: z.boolean().optional(),
});

// 사업자 정보
const businessInfoSchema = z.object({
  ceoName: z.string().min(1, '대표자명은 필수입니다.').max(100),
  businessNumber: businessNumberSchema,
  businessType: z.string().max(100).optional(),
  businessItem: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  detailAddress: z.string().max(500).optional(),
  zipCode: z.string().regex(/^\d{5}$/).optional(),
  phone: phoneSchema.optional(),
  fax: z.string().max(20).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  establishedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

// 정산 계좌
const accountSchema = z.object({
  bankCode: bankCodeSchema,
  bankName: z.string().min(1, '은행명은 필수입니다.').max(100),
  accountNumber: accountNumberSchema,
  accountHolder: z.string().min(1, '예금주명은 필수입니다.').max(100),
  isDefault: z.boolean().default(false),
});

// 매장 설정
const storeSettingsSchema = z.object({
  openingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  closingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  breakStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  breakEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  minOrderAmount: z.number().int().min(0).max(1000000).optional(),
  deliveryFee: z.number().int().min(0).max(100000).optional(),
  freeDeliveryThreshold: z.number().int().min(0).max(1000000).optional(),
  allowTakeout: z.boolean().optional(),
  allowDelivery: z.boolean().optional(),
  allowDineIn: z.boolean().optional(),
  autoAcceptOrders: z.boolean().optional(),
  orderTimeoutMinutes: z.number().int().min(1).max(60).optional(),
  notifyNewOrder: z.boolean().optional(),
  notifyOrderCancel: z.boolean().optional(),
  notifyPayment: z.boolean().optional(),
  notifyReview: z.boolean().optional(),
  printerEnabled: z.boolean().optional(),
  printerIp: z.string().ipv4().optional().nullable(),
  printerPort: z.number().int().min(1).max(65535).optional(),
  kdsEnabled: z.boolean().optional(),
  kdsAutoPrint: z.boolean().optional(),
  theme: z.enum(['default', 'modern', 'classic', 'minimal', 'food_truck']).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
});

// QR 코드 생성
const generateQRSchema = z.object({
  tableNumber: z.number().int().min(1).max(9999).optional(),
  tableName: z.string().max(50).optional(),
  count: z.number().int().min(1).max(100).default(1),
  prefix: z.string().max(10).optional(),
});

// 매장 검색 쿼리
const storeSearchQuerySchema = z.object({
  q: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().int().min(100).max(50000).default(5000),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['distance', 'rating', 'review_count', 'created']).default('distance'),
});

// 매장 테마 설정
const storeThemeSchema = z.object({
  theme: z.enum(['default', 'modern', 'classic', 'minimal', 'food_truck']),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fontFamily: z.string().max(50).optional(),
  borderRadius: z.number().int().min(0).max(50).optional(),
  customCSS: z.string().max(5000).optional().nullable(),
});

// 푸드트럭 디자인 테마
const foodTruckDesignSchema = z.object({
  designTheme: z.enum(['concept1', 'concept2', 'concept3', 'concept4', 'concept5']),
  customColors: z.object({
    primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    text: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }).optional(),
  logoUrl: z.string().url().optional().nullable(),
  bannerImageUrl: z.string().url().optional().nullable(),
  customMessage: z.string().max(200).optional().nullable(),
});

// 매장 ID 파라미터 (params용)
const storeIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, '매장 ID는 숫자여야 합니다.').transform(Number),
});

module.exports = {
  createStoreSchema,
  updateStoreSchema,
  businessInfoSchema,
  accountSchema,
  storeSettingsSchema,
  generateQRSchema,
  storeSearchQuerySchema,
  storeThemeSchema,
  foodTruckDesignSchema,
  storeIdParamSchema,
  businessNumberSchema,
  phoneSchema,
  accountNumberSchema,
};