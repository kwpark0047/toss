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
  nutritionInfo: z
    .object({
      calories: z.number().int().min(0).optional(),
      protein: z.number().min(0).optional(),
      fat: z.number().min(0).optional(),
      carbs: z.number().min(0).optional(),
      sodium: z.number().min(0).optional(),
      sugar: z.number().min(0).optional(),
    })
    .optional()
    .nullable(),
  cookingTimeMinutes: z.number().int().min(0).max(180).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  images: z.array(z.string().url()).max(10).default([]),
  options: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        required: z.boolean().default(false),
        minSelect: z.number().int().min(0).default(0),
        maxSelect: z.number().int().min(1).default(1),
        items: z
          .array(
            z.object({
              name: z.string().min(1).max(100),
              price: priceSchema.default(0),
              stockQuantity: stockSchema.default(0),
              isActive: z.boolean().default(true),
              displayOrder: z.number().int().min(0).default(0),
            })
          )
          .min(1, '옵션 항목은 최소 1개 필요합니다.')
          .max(50),
      })
    )
    .max(10)
    .default([]),
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
  nutritionInfo: z
    .object({
      calories: z.number().int().min(0).optional(),
      protein: z.number().min(0).optional(),
      fat: z.number().min(0).optional(),
      carbs: z.number().min(0).optional(),
      sodium: z.number().min(0).optional(),
      sugar: z.number().min(0).optional(),
    })
    .optional()
    .nullable(),
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
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        price: priceSchema.default(0),
        stockQuantity: stockSchema.default(0),
        isActive: z.boolean().default(true),
        displayOrder: z.number().int().min(0).default(0),
      })
    )
    .min(1, '옵션 항목은 최소 1개 필요합니다.')
    .max(50),
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
  sort: z
    .enum(['name', 'price', 'created', 'popularity', 'display_order'])
    .default('display_order'),
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

// 관리자 화면과 상품 저장소(repositories/Product.js)는 snake_case(store_id, is_sold_out …)를 쓴다.
// camelCase 스키마로 검증하면 snake_case 필드가 모두 지워져 메뉴 추가가 400으로 막히고
// 품절·카테고리·이미지·재고 수정이 조용히 무시됐다. 두 표기를 모두 받아 snake_case로 맞춘다.
const CAMEL_TO_SNAKE = {
  storeId: 'store_id',
  categoryId: 'category_id',
  imageUrl: 'image_url',
  isActive: 'is_active',
  isSoldOut: 'is_sold_out',
  isNew: 'is_new',
  isRecommended: 'is_popular',
  isPopular: 'is_popular',
  stockQuantity: 'stock_quantity',
  lowStockThreshold: 'low_stock_threshold',
  cookingTimeMinutes: 'cooking_time',
  cookingTime: 'cooking_time',
  nutritionInfo: 'nutrition_info',
  detailDescription: 'detail_description',
  detailImages: 'detail_images',
  spicyLevel: 'spicy_level',
};
const toSnakeKeys = (input) =>
  input && typeof input === 'object' && !Array.isArray(input)
    ? Object.fromEntries(Object.entries(input).map(([k, v]) => [CAMEL_TO_SNAKE[k] || k, v]))
    : input;
const wireInt = z.union([
  z.number().int(),
  z
    .string()
    .regex(/^-?\d+$/)
    .transform(Number),
]);
const wireFlag = z
  .union([z.boolean(), z.literal(0), z.literal(1), z.enum(['0', '1', 'true', 'false'])])
  .transform((v) => v === true || v === 1 || v === '1' || v === 'true');
const wireNullableInt = z.union([wireInt, z.literal(''), z.null()]);
const wirePrice = z
  .union([priceSchema, z.string().regex(/^\d+$/).transform(Number)])
  .pipe(priceSchema);
const productWireFields = {
  name: z.string().trim().min(1).max(200),
  price: wirePrice,
  description: z.string().max(5000).nullable(),
  image_url: z.string().max(2000).nullable(),
  is_active: wireFlag,
  is_sold_out: wireFlag,
  category_id: wireNullableInt,
  detail_description: z.string().max(20000).nullable(),
  spicy_level: wireInt,
  is_popular: wireFlag,
  is_new: wireFlag,
  cooking_time: wireInt,
  stock_quantity: wireNullableInt,
  low_stock_threshold: wireInt,
};
// options·태그·영양정보 등 JSON 필드와 그 밖의 키는 저장소가 직접 처리하므로 그대로 통과시킨다.
const productWireCreateSchema = z.preprocess(
  toSnakeKeys,
  z
    .object({ store_id: wireInt.pipe(z.number().int().positive()), ...productWireFields })
    .partial()
    .required({ store_id: true, name: true, price: true })
    .passthrough()
);
const productWireUpdateSchema = z.preprocess(
  toSnakeKeys,
  z.object(productWireFields).partial().passthrough()
);

module.exports = {
  productWireCreateSchema,
  productWireUpdateSchema,
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
