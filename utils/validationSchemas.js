const { z } = require('zod');

// 옵션 항목 하나의 스키마 (VisualOptionEditor 포맷 포함)
const optionItemSchema = z
  .object({
    name: z.string({ error: '옵션명은 필수입니다.' }),
    values: z.array(z.string()).min(1, '옵션 값은 최소 1개 이상이어야 합니다.'),
    type: z.enum(['radio', 'checkbox', 'select']).default('radio'),
    required: z.boolean().optional(),
    prices: z.array(z.number().nullable()).optional(),
  })
  .passthrough();

const schemas = {
  // === [Auth] ===
  auth: {
    sendOtp: z.object({
      phone: z
        .string({ error: '핸드폰 번호는 필수입니다.' })
        .regex(/^[0-9-]{9,14}$/, '유효한 핸드폰 번호를 입력해주세요.'),
    }),
    verifyOtp: z.object({
      phone: z.string().regex(/^[0-9-]{9,14}$/, '유효한 핸드폰 번호를 입력해주세요.'),
      otp: z
        .string({ error: '인증번호는 필수입니다.' })
        .length(6, '인증번호는 6자리입니다.')
        .regex(/^\d+$/, '인증번호는 숫자로만 구성됩니다.'),
    }),
    register: z.object({
      phone: z
        .string({ error: '핸드폰 번호는 필수입니다.' })
        .regex(/^[0-9-]{9,14}$/, '유효한 핸드폰 번호를 입력해주세요.'),
      password: z
        .string({ error: '비밀번호는 필수입니다.' })
        .min(6, '비밀번호는 최소 6자 이상이어야 합니다.'),
    }),
    // identifier = 핸드폰 번호 또는 이메일
    login: z
      .object({
        identifier: z.string().optional(),
        email: z.string().optional(),
        password: z.string(),
      })
      .superRefine((data, ctx) => {
        if (!data.identifier && !data.email) {
          ctx.addIssue({ code: 'custom', message: 'identifier 또는 email을 입력해주세요.' });
        }
      }),
    updateProfile: z
      .object({
        name: z.string().nullish(),
        email: z
          .union([
            z.string().email('유효한 이메일 주소를 입력해주세요.'),
            z.literal(''),
            z.literal(null),
          ])
          .optional(),
        address: z.string().nullish(),
      })
      .refine((data) => Object.keys(data).length >= 1, {
        message: '변경할 항목을 하나 이상 입력해주세요.',
      }),
    changePassword: z.object({
      current_password: z.string({ error: '현재 비밀번호를 입력해주세요.' }),
      new_password: z
        .string({ error: '새 비밀번호를 입력해주세요.' })
        .min(6, '새 비밀번호는 최소 6자 이상이어야 합니다.'),
    }),
  },

  // === [Store] ===
  store: {
    create: z.object({
      user_id: z.number().int().optional(), // 보통 토큰에서 가져오지만 명시적 전달 시
      name: z.string(),
      description: z.string().nullish(),
      address: z.string().nullish(),
      phone: z.string().nullish(),
      business_type: z.string().nullish(),
      open_time: z
        .union([
          z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, '시간 형식은 HH:mm이어야 합니다.'),
          z.literal(''),
          z.literal(null),
        ])
        .optional(),
      close_time: z
        .union([
          z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, '시간 형식은 HH:mm이어야 합니다.'),
          z.literal(''),
          z.literal(null),
        ])
        .optional(),
      plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
      latitude: z.number().nullable().optional(),
      longitude: z.number().nullable().optional(),
    }),
  },

  // === [Product] ===
  product: {
    create: z
      .object({
        store_id: z.number().int(),
        category_id: z.number().int().nullable().optional(),
        name: z.string(),
        price: z.number().min(0),
        description: z.string().nullish(),
        image_url: z.string().nullish(),
        is_active: z.union([z.literal(0), z.literal(1)]).default(1),
        is_sold_out: z.union([z.literal(0), z.literal(1)]).default(0),
        detail_description: z.string().nullish(),
        allergens: z.string().nullish(),
        ingredients: z.string().nullish(),
        nutrition_info: z.string().nullish(),
        spicy_level: z.number().min(0).max(5).default(0),
        is_popular: z.union([z.literal(0), z.literal(1)]).default(0),
        is_new: z.union([z.literal(0), z.literal(1)]).default(0),
        tags: z.string().nullish(),
        detail_images: z.string().nullish(),
        cooking_time: z.number().min(0).default(5),
        stock_quantity: z.number().int().nullable().optional(),
        low_stock_threshold: z.number().int().min(0).default(5),
        options: z.union([z.array(optionItemSchema).nullable(), z.string().nullish()]).optional(),
      })
      .passthrough(),
  },

  // === [Option Template] ===
  optionTemplate: {
    create: z.object({
      store_id: z.number().int(),
      name: z.string({ error: '템플릿 이름은 필수입니다.' }),
      options: z.string({ error: '옵션 데이터는 필수입니다.' }).superRefine((value, ctx) => {
        let parsed;
        try {
          parsed = JSON.parse(value);
        } catch {
          ctx.addIssue({ code: 'custom', message: '옵션은 JSON 문자열이어야 합니다.' });
          return;
        }
        const r = z.array(optionItemSchema).min(1).safeParse(parsed);
        if (!r.success) {
          ctx.addIssue({ code: 'custom', message: '옵션 형식이 올바르지 않습니다.' });
        }
      }),
    }),
    update: z
      .object({
        name: z.string().optional(),
        options: z
          .string()
          .superRefine((value, ctx) => {
            let parsed;
            try {
              parsed = JSON.parse(value);
            } catch {
              ctx.addIssue({ code: 'custom', message: '옵션은 JSON 문자열이어야 합니다.' });
              return;
            }
            const r = z.array(optionItemSchema).min(1).safeParse(parsed);
            if (!r.success) {
              ctx.addIssue({ code: 'custom', message: '옵션 형식이 올바르지 않습니다.' });
            }
          })
          .optional(),
      })
      .refine((data) => Object.keys(data).length >= 1, {
        message: '변경할 항목을 하나 이상 입력해주세요.',
      }),
  },

  // === [Order] ===
  order: {
    create: z.object({
      store_id: z.number().int().positive(),
      user_coupon_id: z.number().int().positive().nullable().optional(),
      table_id: z
        .union([
          z.number().int().positive(),
          z.string().refine((val) => {
            const num = Number(val);
            return !(!isNaN(num) && num <= 0);
          }, '양수인 테이블 번호를 입력해주세요.'),
        ])
        .nullable()
        .optional(),
      table_number: z.string().nullish(),
      total_amount: z.number().min(0),
      payment_method: z.enum(['cash', 'card', 'transfer', 'toss', 'naver', 'kakao']),
      items: z
        .array(
          z.object({
            product_id: z.number().int().positive(),
            product_name: z.string(),
            quantity: z.number().int().min(1),
            price: z.number().min(0),
            subtotal: z.number().min(0).optional(),
            options: z.array(z.unknown()).optional(),
          })
        )
        .min(1),
      phone: z.string().nullish(),
      customer_name: z.string().nullish(),
      toss_user_key: z.string().nullish(),
      point_amount: z.number().min(0).default(0),
      // [추가] 분할 결제 필드
      is_split_payment: z.boolean().default(false),
      split_type: z.enum(['NONE', 'EQUAL', 'ITEM']).default('NONE'),
      split_status: z.enum(['PENDING', 'PARTIAL', 'COMPLETED']).default('PENDING'),
    }),
  },
};

// Joi 호환 `.validate(value)` → `{ value, error }` (레거시 테스트/구간 호환용)
function attachValidate(node) {
  if (!node || typeof node !== 'object') return node;
  if (typeof node.safeParse === 'function') {
    Object.defineProperty(node, 'validate', {
      enumerable: false,
      configurable: true,
      writable: true,
      value(value) {
        const result = node.safeParse(value);
        return {
          value: result.success ? result.data : value,
          error: result.success ? undefined : result.error,
        };
      },
    });
    return node;
  }
  for (const key of Object.keys(node)) {
    node[key] = attachValidate(node[key]);
  }
  return node;
}

module.exports = attachValidate(schemas);
