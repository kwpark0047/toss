// Global integration test setup — mocks Prisma to prevent real DB connections
// This file MUST be loaded before any test requires `../../app`

jest.mock('../../config/prisma', () => {
  // Return a minimal mock with commonly used models
  const createMockModel = () => ({
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    upsert: jest.fn(),
  });

  return {
    // Commonly used models across integration tests
    stores: createMockModel(),
    products: createMockModel(),
    orders: createMockModel(),
    order_items: createMockModel(),
    categories: createMockModel(),
    users: createMockModel(),
    staff: createMockModel(),
    tables: createMockModel(),
    coupons: createMockModel(),
    user_coupons: createMockModel(),
    reviews: createMockModel(),
    payments: createMockModel(),
    notifications: createMockModel(),
    settings: createMockModel(),
    audit_logs: createMockModel(),
    feature_flags: createMockModel(),
    order_events: createMockModel(),
    print_jobs: createMockModel(),
    waiting_list: createMockModel(),
    reservations: createMockModel(),
    customer_preferences: createMockModel(),
    store_customers: createMockModel(),
    point_transactions: createMockModel(),
    user_points: createMockModel(),
    store_point_settings: createMockModel(),
    store_receipt_settings: createMockModel(),
    store_tier_settings: createMockModel(),
    campaign_settings: createMockModel(),
    option_templates: createMockModel(),
    api_keys: createMockModel(),
    webhook_endpoints: createMockModel(),
    webhook_deliveries: createMockModel(),
    notification_templates: createMockModel(),
    inventory_reorder_candidates: createMockModel(),
    crm_campaign_runs: createMockModel(),
    social_accounts: createMockModel(),
    admin_otps: createMockModel(),
    news: createMockModel(),
    dynamic_pricing_rules: createMockModel(),
    dynamic_price_logs: createMockModel(),
    competitor_prices: createMockModel(),
    customer_segments: createMockModel(),
    customer_personalizations: createMockModel(),
    ai_recommendations: createMockModel(),
    personalization_analytics: createMockModel(),
    demand_forecasts: createMockModel(),
    pricing_optimization_jobs: createMockModel(),
    grant_templates: createMockModel(),
    grant_change_logs: createMockModel(),
    point_grant_history: createMockModel(),
    coupon_issue_history: createMockModel(),
    recommendation_impressions: createMockModel(),
    recommendation_clicks: createMockModel(),
    recommendation_conversions: createMockModel(),
    recommendation_daily_stats: createMockModel(),
    store_favorites: createMockModel(),
    staff_schedules: createMockModel(),
    food_trucks: createMockModel(),
    community_posts: createMockModel(),
    community_post_likes: createMockModel(),
    store_partnerships: createMockModel(),
    phone_otps: createMockModel(),
    chat_rooms: createMockModel(),
    chat_messages: createMockModel(),
    shared_cart_items: createMockModel(),
    review_likes: createMockModel(),
    store_link_requests: createMockModel(),

    // Prisma client methods
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn((fn) => fn()),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    disconnectAll: jest.fn().mockResolvedValue(undefined),
    getQueryLogs: jest.fn().mockReturnValue([]),
    $on: jest.fn(),
  };
});

// Mock middleware that integration tests commonly override
const mockAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: '인증 토큰이 필요합니다.',
      code: 'AUTH_TOKEN_INVALID',
      status: 401,
    });
  }
  req.user = { id: 1, name: 'Test User', role: 'user', type: 'access' };
  next();
};
const mockOptionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    req.user = { id: 1, name: 'Test User', role: 'user', type: 'access' };
  }
  next();
};
const mockAdminOnly = (req, res, next) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: '관리자 권한이 필요합니다.',
      code: 'AUTH_FORBIDDEN',
      status: 403,
    });
  }
  next();
};

jest.mock('../../middleware/auth', () => {
  const mockAuthModule = mockAuthMiddleware;
  mockAuthModule.authMiddleware = mockAuthMiddleware;
  mockAuthModule.optionalAuth = mockOptionalAuth;
  mockAuthModule.adminOnly = mockAdminOnly;
  return mockAuthModule;
});

jest.mock('../../middleware/storeAuth', () => ({
  checkStorePermission: () => (req, res, next) => {
    req.storeId = parseInt(req.params.storeId || req.query.store_id || req.body?.store_id || '1');
    req.storeRole = 'owner';
    next();
  },
  checkStorePermissionForObject: () => (req, res, next) => {
    req.storeId = parseInt(req.params.storeId || req.query.store_id || req.body?.store_id || '1');
    req.storeRole = 'owner';
    next();
  },
  checkStorePermissionForObjectBatch: () => (req, res, next) => {
    req.storeId = parseInt(req.params.storeId || req.query.store_id || req.body?.store_id || '1');
    req.storeRole = 'owner';
    next();
  },
  checkUniformStoreMutation: () => (req, res, next) => {
    req.storeId = parseInt(req.params.storeId || req.query.store_id || req.body?.store_id || '1');
    req.storeRole = 'owner';
    next();
  },
  getStoreRole: jest.fn().mockResolvedValue('owner'),
  checkResourcePermission: () => (req, res, next) => next(),
  checkOrderPermission: () => (req, res, next) => {
    req.orderStoreId = 1;
    next();
  },
}));

jest.mock('../../middleware/validate', () => {
  const Joi = require('joi');
  const validate = (schema) => (req, res, next) => {
    if (Joi.isSchema(schema)) {
      const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
      if (error) {
        const errorMessage = error.details.map((d) => d.message).join(', ');
        return res
          .status(400)
          .json({ error: 'Validation Error', message: errorMessage, details: error.details });
      }
      req.body = value;
      return next();
    }
    const validations = [];
    if (schema.body) validations.push({ type: 'body', data: req.body, schema: schema.body });
    if (schema.query) validations.push({ type: 'query', data: req.query, schema: schema.query });
    if (schema.params)
      validations.push({ type: 'params', data: req.params, schema: schema.params });
    for (const v of validations) {
      const { error, value } = v.schema.validate(v.data, { abortEarly: false, stripUnknown: true });
      if (error) {
        const errorMessage = error.details.map((d) => d.message).join(', ');
        return res.status(400).json({
          error: `Validation Error (${v.type})`,
          message: errorMessage,
          details: error.details,
        });
      }
      req[v.type] = value;
    }
    next();
  };
  return validate;
});

// Mock rate limiter
jest.mock('../../middleware/rateLimiter', () => ({
  generalLimiter: (req, res, next) => next(),
  publicLimiter: (req, res, next) => next(),
  orderLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  paymentLimiter: (req, res, next) => next(),
}));

// Mock errorHandler
jest.mock('../../utils/errorHandler', () => {
  class AppError extends Error {
    constructor(message, statusCode, code, details = {}) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      this.details = details;
      this.isOperational = true;
    }
  }
  const errorHandler = (err, req, res, _next) => {
    let error = {
      success: false,
      message: '예상치 못한 오류가 발생했습니다.',
      code: 'INTERNAL_SERVER_ERROR',
      status: 500,
      details: {},
    };
    if (err instanceof AppError) {
      error = {
        success: false,
        message: err.message,
        code: err.code,
        status: err.statusCode,
        details: err.details,
      };
    } else if (err.name === 'ValidationError' || err.name === 'JoiValidationError') {
      error = {
        success: false,
        message: '입력값 검증에 실패했습니다.',
        code: 'VALIDATION_ERROR',
        status: 400,
        details: err.details || err.message,
      };
    } else if (err.code === 'P2002') {
      error = {
        success: false,
        message: '중복된 데이터가 존재합니다.',
        code: 'DUPLICATE_ERROR',
        status: 409,
        details: err.meta,
      };
    } else {
      error.message = err.message || error.message;
      error.details = { rawMessage: err.message };
    }
    res.status(error.status).json(error);
  };
  return { AppError, errorHandler, errorTypes: {}, logError: jest.fn() };
});

// Mock Sentry
jest.mock('../../utils/sentry', () => ({
  initSentry: jest.fn(),
  Sentry: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
  },
}));

// Mock alerting
jest.mock('../../utils/alerting', () => ({
  registerGlobalHandlers: jest.fn(),
  send: jest.fn(),
}));

// Mock firebase
jest.mock('../../utils/firebaseAdmin', () => ({
  getMessagingClient: jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue(true),
  }),
  shutdownFirebase: jest.fn().mockResolvedValue(undefined),
  _resetForTests: jest.fn(),
}));

// Mock axios
jest.mock('axios', () => ({
  create: () => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  }),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

// Mock swagger
jest.mock('../../docs/swagger', () => jest.fn());

module.exports = {};
