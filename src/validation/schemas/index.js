/**
 * Zod 검증 스키마 통합 인덱스
 * 사용법: const { validateBody } = require('../middleware/validate');
 *        const { createStoreSchema } = require('../src/validation/schemas');
 */

const auth = require('./auth');
const store = require('./store');
const product = require('./product');
const order = require('./order');

module.exports = {
  // 인증
  ...auth,
  // 매장
  ...store,
  // 상품
  ...product,
  // 주문/결제
  ...order,
};