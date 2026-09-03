/**
 * Prisma Jest 모킹 유틸리티
 *
 * config/prisma.js가 ES6 Proxy를 사용하므로 Jest 자동 모킹이 불가하다.
 * 이 파일은 jest.mock() 콜백 안에서 require()로 로드해 Proxy 문제를 회피한다.
 *
 * 사용법:
 *   jest.mock('../../../config/prisma', () => require('../../../tests/helpers/prismaMock').create());
 */

const MODEL_NAMES = [
  'categories',
  'comments',
  'ledger',
  'metrics',
  'order_items',
  'orders',
  'payments',
  'plan_requests',
  'Plan',
  'Subscription',
  'point_transactions',
  'posts',
  'post_likes',
  'products',
  'stock_history',
  'settlements',
  'staff',
  'staff_attendance',
  'staff_account_requests',
  'store_accounts',
  'store_point_settings',
  'store_receipt_settings',
  'stores',
  'store_subscriptions',
  'store_business_info',
  'store_legal_documents',
  'store_settlement_config',
  'store_eco_badge',
  'store_operating_hours',
  'notifications',
  'tables',
  'users',
  'user_points',
  'community_posts',
  'community_post_likes',
  'store_partnerships',
  'phone_otps',
  'chat_rooms',
  'chat_messages',
  'shared_cart_items',
  'waiting_list',
  'reviews',
  'review_likes',
  'store_customers',
  'customer_preferences',
  'store_tier_settings',
  'coupons',
  'user_coupons',
  'campaign_settings',
  'reservations',
  'option_templates',
  'api_keys',
  'webhook_endpoints',
  'notification_templates',
  'webhook_deliveries',
  'print_jobs',
  'store_link_requests',
  'store_favorites',
  'staff_schedules',
  'food_trucks',
  'social_accounts',
  'admin_otps',
  'news',
  'dynamic_pricing_rules',
  'dynamic_price_logs',
  'competitor_prices',
  'customer_segments',
  'customer_personalizations',
  'ai_recommendations',
  'personalization_analytics',
  'demand_forecasts',
  'grant_templates',
  'grant_change_logs',
  'point_grant_history',
  'coupon_issue_history',
  'pricing_optimization_jobs',
  'recommendation_impressions',
  'recommendation_clicks',
  'recommendation_conversions',
  'recommendation_daily_stats',
  'audit_logs',
  'feature_flags',
  'order_events',
  'inventory_reorder_candidates',
  'inventory_auto_order_recommendations',
  'crm_campaign_runs',
];

const CRUD_METHODS = [
  'findUnique',
  'findMany',
  'findFirst',
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
];

/**
 * Prisma 수동 모킹 생성
 * @param {Object} [overrides] - 모델별 오버라이드 (예: { products: { findMany: jest.fn() } })
 */
function create(overrides = {}) {
  const prisma = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn().mockImplementation(async (fns) => {
      if (Array.isArray(fns)) return Promise.all(fns);
      return fns(prisma);
    }),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $on: jest.fn(),
    getQueryLogs: jest.fn().mockReturnValue([]),
    disconnectAll: jest.fn().mockResolvedValue(undefined),
  };

  for (const name of MODEL_NAMES) {
    if (overrides[name]) {
      prisma[name] = overrides[name];
    } else {
      const model = {};
      for (const method of CRUD_METHODS) {
        model[method] = jest.fn().mockResolvedValue(null);
      }
      prisma[name] = model;
    }
  }

  return prisma;
}

module.exports = { create, MODEL_NAMES, CRUD_METHODS };
