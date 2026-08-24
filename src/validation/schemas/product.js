/**
 * 상품/메뉴 관련 Zod 검증 스키마 (body 직접 스키마)
 */

const { z } = require('zod');

const priceSchema = z.number().int().min(0).max(10000000, '가격이 너무 큽니다.');
const stockSchema = z.number().int().min(0).max(999999);

// 상품 생성
const createProductSchema = z.object({
  storeId: z.number().int().positive('매장 ID는 양의 정수여야 합니다.'),
  categoryId: z.number().int().positive().optional().nullable(),
  name: z.string().min(1, '상품명은 필수입니다.').max(200),
  description: z.string().max(5000).optional().nullable(),
  price: priceSchema,
  originalPrice: priceSchema.optional().nullable(),
  costPrice: priceSchema.optional().nullable(),
  taxType: z.enum(['taxable', 'tax_free', 'tax_exempt']).default('taxable'),
  taxRate: z.number().min(0).max(1).default(0.1),
  stockQuantity: stockSchema.default(0),
  lowStockThreshold: z.number().int().min(0).max(99999).default(10),
  trackStock: z.boolean().default(true),
  unlimitedStock: z.boolean().default(false),
  unit: z.string().max(20).default('개'),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  isRecommended: z.boolean().default(false),
  isNew: z.boolean().default(false),
  isSoldOut: z.boolean().default(false),
  soldOutMessage: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  allergens: z.array(z.string().max(50)).max(20).default([]),
  nutritionInfo: z.object({
    calories: z.number().int().min(0).optional(),
    protein: z.number().min(0).optional(),
    fat: z.number().min(0).optional(),
    carbs: z.number().min(0).optional(),
    sodium: z.number().min(0).optional(),
    sugar: z.number().min(0).optional(),
  }).optional().nullable(),
  cookingTimeMinutes: z.number().int().min(0).max(180).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  images: z.array(z.string().url()).max(10).default([]),
  options: z.array(z.object({
    name: z.string().min(1).max(100),
    required: z.boolean().default(false),
    minSelect: z.number().int().min(0).default(0),
    maxSelect: z.number().int().min(1).default(1),
    items: z.array(z.object({
      name: z.string().min(1).max(100),
      price: priceSchema.default(0),
      stockQuantity: stockSchema.default(0),
      isActive: z.boolean().default(true),
      displayOrder: z.number().int().min(0).default(0),
    })).min(1, '옵션 항목은 최소 1개 필요합니다.').max(50),
  })).max(10).default([]),
});

// 상품 수정
const updateProductSchema = z.object({
  categoryId: z.number().int().positive().optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  price: priceSchema.optional(),
  originalPrice: priceSchema.optional().nullable(),
  costPrice: priceSchema.optional().nullable(),
  taxType: z.enum(['taxable', 'tax_free', 'tax_exempt']).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  stockQuantity: stockSchema.optional(),
  lowStockThreshold: z.number().int().min(0).max(99999).optional(),
  trackStock: z.boolean().optional(),
  unlimitedStock: z.boolean().optional(),
  unit: z.string().max(20).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isSoldOut: z.boolean().optional(),
  soldOutMessage: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  allergens: z.array(z.string().max(50)).max(20).optional(),
  nutritionInfo: z.object({
    calories: z.number().int().min(0).optional(),
    protein: z.number().min(0).optional(),
    fat: z.number().min(0).optional(),
    carbs: z.number().min(0).optional(),
    sodium: z.number().min(0).optional(),
    sugar: z.number().min(0).optional(),
  }).optional().nullable(),
  cookingTimeMinutes: z.number().int().min(0).max(180).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  images: z.array(z.string().url()).max(10).optional(),
});

// 상품 상태 변경
const productStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'sold_out', 'hidden']),
});

// 상품 옵션 생성/수정
const productOptionSchema = z.object({
  name: z.string().min(1).max(100),
  required: z.boolean().default(false),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
  items: z.array(z.object({
    name: z.string().min(1).max(100),
    price: priceSchema.default(0),
    stockQuantity: stockSchema.default(0),
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).default(0),
  })).min(1, '옵션 항목은 최소 1개 필요합니다.').max(50),
});

// 상품 옵션 항목
const productOptionItemSchema = z.object({
  name: z.string().min(1).max(100),
  price: priceSchema.default(0),
  stockQuantity: stockSchema.default(0),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
});

// 상품 검색/목록 쿼리
const productSearchQuerySchema = z.object({
  q: z.string().max(100).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  storeId: z.coerce.number().int().positive().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  isActive: z.coerce.boolean().optional(),
  isRecommended: z.coerce.boolean().optional(),
  isNew: z.coerce.boolean().optional(),
  tags: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['name', 'price', 'created', 'popularity', 'display_order']).default('display_order'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

// 상품 ID 파라미터
const productIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

// 상품 재고 조정
const adjustStockSchema = z.object({
  quantity: z.number().int().min(-999999).max(999999),
  reason: z.enum(['order', 'manual_in', 'manual_out', 'correction', 'return']),
  note: z.string().max(500).optional(),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  productStatusSchema,
  productOptionSchema,
  productOptionItemSchema,
  productSearchQuerySchema,
  productIdParamSchema,
  adjustStockSchema,
  priceSchema,
  stockSchema,
};