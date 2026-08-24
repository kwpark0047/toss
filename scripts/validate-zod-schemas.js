#!/usr/bin/env node
/**
 * Zod 검증 스키마 종합 검증 스크립트
 * 모든 스키마가 올바르게 파싱되고 기본 검증이 동작하는지 확인
 * CI/CD: npm run validate:zod
 */

const schemas = require('../src/validation/schemas');
const logger = require('../utils/logger');

const testCases = {
  // Auth
  'auth.loginSchema': {
    schema: schemas.loginSchema,
    valid: { email: 'test@example.com', password: 'password123' },
    invalid: { email: 'invalid', password: 'short' },
  },
  'auth.registerSchema': {
    schema: schemas.registerSchema,
    valid: {
      email: 'test@example.com',
      password: 'Test1234',
      passwordConfirm: 'Test1234',
      name: '테스트',
      phone: '01012345678',
      agreeTerms: true,
      agreePrivacy: true,
    },
    invalid: { email: 'bad', password: '123', agreeTerms: false },
  },
  'auth.adminLoginSchema': {
    schema: schemas.adminLoginSchema,
    valid: { email: 'admin@example.com', password: 'password123' },
    invalid: { email: 'bad' },
  },
  'auth.refreshTokenSchema': {
    schema: schemas.refreshTokenSchema,
    valid: { refreshToken: 'token123' },
    invalid: { refreshToken: '' },
  },

  // Store
  'store.createStoreSchema': {
    schema: schemas.createStoreSchema,
    valid: { name: '테스트 매장', businessNumber: '123-45-67890' },
    invalid: { name: '' },
  },
  'store.updateStoreSchema': {
    schema: schemas.updateStoreSchema,
    valid: { name: '수정된 매장' },
    invalid: { name: '' },
  },
  'store.businessInfoSchema': {
    schema: schemas.businessInfoSchema,
    valid: { ceoName: '홍길동', businessNumber: '123-45-67890' },
    invalid: { ceoName: '', businessNumber: '123' },
  },
  'store.accountSchema': {
    schema: schemas.accountSchema,
    valid: { bankCode: '004', bankName: '국민은행', accountNumber: '1234567890', accountHolder: '홍길동' },
    invalid: { bankCode: '', accountNumber: '123' },
  },
  'store.storeSearchQuerySchema': {
    schema: schemas.storeSearchQuerySchema,
    valid: { q: '강남', lat: 37.5, lng: 127.0 },
    invalid: { lat: 100 }, // 위도 범위 초과
  },
  'store.storeThemeSchema': {
    schema: schemas.storeThemeSchema,
    valid: { theme: 'modern', primaryColor: '#4f46e5' },
    invalid: { theme: 'invalid', primaryColor: 'not-a-color' },
  },
  'store.foodTruckDesignSchema': {
    schema: schemas.foodTruckDesignSchema,
    valid: { designTheme: 'concept1' },
    invalid: { designTheme: 'concept99' },
  },

  // Product
  'product.createProductSchema': {
    schema: schemas.createProductSchema,
    valid: { storeId: 1, name: '아메리카노', price: 4500 },
    invalid: { storeId: -1, price: -100 },
  },
  'product.updateProductSchema': {
    schema: schemas.updateProductSchema,
    valid: { name: '수정됨', price: 5000 },
    invalid: { price: -1 },
  },
  'product.productSearchQuerySchema': {
    schema: schemas.productSearchQuerySchema,
    valid: { q: '커피', page: 1, limit: 20 },
    invalid: { page: 0, limit: 200 },
  },

  // Order
  'order.createOrderSchema': {
    schema: schemas.createOrderSchema,
    valid: {
      storeId: 1,
      items: [{ productId: 1, productName: '아메리카노', quantity: 2, unitPrice: 4500, totalPrice: 9000 }],
    },
    invalid: { storeId: 0, items: [] },
  },
  'order.updateOrderStatusSchema': {
    schema: schemas.updateOrderStatusSchema,
    valid: { status: 'confirmed' },
    invalid: { status: 'invalid_status' },
  },
  'order.cancelOrderSchema': {
    schema: schemas.cancelOrderSchema,
    valid: { reason: 'customer_request' },
    invalid: { reason: 'invalid_reason' },
  },
  'order.createPaymentSchema': {
    schema: schemas.createPaymentSchema,
    valid: { orderId: 1, amount: 9000, method: 'card' },
    invalid: { orderId: 0, amount: -1 },
  },
  'order.orderSearchQuerySchema': {
    schema: schemas.orderSearchQuerySchema,
    valid: { status: 'completed', page: 1 },
    invalid: { status: 'unknown', page: 0 },
  },
};

async function runValidation() {
  console.log('[Zod Schema Validation] Starting...\n');

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const [name, testCase] of Object.entries(testCases)) {
    const { schema, valid, invalid } = testCase;

    // Valid case test
    const validResult = schema.safeParse(valid);
    if (!validResult.success) {
      failed++;
      failures.push(`${name} (valid): Expected success but got errors: ${JSON.stringify(validResult.error.flatten().fieldErrors)}`);
      continue;
    }

    // Invalid case test
    const invalidResult = schema.safeParse(invalid);
    if (invalidResult.success) {
      failed++;
      failures.push(`${name} (invalid): Expected failure but passed`);
      continue;
    }

    // Check that error details are present
    const errors = invalidResult.error.flatten().fieldErrors;
    if (Object.keys(errors).length === 0) {
      failed++;
      failures.push(`${name} (invalid): No field errors returned`);
      continue;
    }

    passed++;
    process.stdout.write('.');
  }

  console.log('\n\n=== Zod Schema Validation Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  }

  console.log('\n✓ All schema validations passed!');
  process.exit(0);
}

runValidation().catch(err => {
  console.error('Validation script error:', err);
  process.exit(1);
});