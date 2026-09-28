/**
 * Feature Flags API Routes
 *
 * GET    /api/feature-flags              - List all flags (with filters)
 * GET    /api/feature-flags/:key         - Get single flag
 * POST   /api/feature-flags              - Create flag
 * PUT    /api/feature-flags/:key         - Update flag
 * DELETE /api/feature-flags/:key         - Delete flag
 * POST   /api/feature-flags/evaluate     - Evaluate flags for context
 * POST   /api/feature-flags/ab-test      - Create A/B test
 * GET    /api/feature-flags/ab-test/:name/results - Get A/B test results
 */

const express = require('express');
const router = express.Router();
const { checkStorePermission } = require('../middleware/storeAuth');
const FeatureFlagsService = require('../../services/FeatureFlagsService');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { body, param, query, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('입력값이 유효하지 않습니다', 400, 'VALIDATION_ERROR', errors.array());
  }
  next();
};

// All routes require authentication and store permission
router.use(async (req, res, next) => {
  if (!req.user) {
    throw new AppError('인증이 필요합니다', 401, 'UNAUTHENTICATED');
  }
  next();
});

/**
 * GET /api/feature-flags
 * List feature flags with optional filters
 */
router.get(
  '/',
  query('enabled').optional().isBoolean(),
  query('type').optional().isIn(['boolean', 'string', 'number', 'json']),
  query('search').optional().isString(),
  query('storeId').optional().isInt(),
  validate,
  asyncHandler(async (req, res) => {
    const { enabled, type, search, storeId: queryStoreId } = req.query;
    const flags = await FeatureFlagsService.listFlags({
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      type,
      search,
      storeId: queryStoreId ? parseInt(queryStoreId) : undefined,
    });

    // Add computed current value for current store context
    const effectiveStoreId = req.user.storeId || queryStoreId;
    const userId = req.user.id;
    const userRole = req.user.role;

    const flagsWithValues = await Promise.all(
      flags.map(async (flag) => {
        const currentValue = await FeatureFlagsService.getFlag(flag.key, {
          storeId: effectiveStoreId || undefined,
          userId,
          userRole,
        });
        return {
          ...flag,
          currentValue,
        };
      })
    );

    res.success({ flags: flagsWithValues });
  })
);

/**
 * GET /api/feature-flags/:key
 * Get a single feature flag with full definition
 */
router.get(
  '/:key',
  param('key').isString().notEmpty(),
  validate,
  asyncHandler(async (req, res) => {
    const flag = await FeatureFlagsService.getFlagDefinition(req.params.key);
    if (!flag) {
      throw new AppError('기능 플래그를 찾을 수 없습니다', 404, 'FLAG_NOT_FOUND');
    }

    // Add current value for current context
    const storeId = req.user.storeId || req.query.storeId;
    const currentValue = await FeatureFlagsService.getFlag(req.params.key, {
      storeId: storeId || undefined,
      userId: req.user.id,
      userRole: req.user.role,
    });

    res.success({ flag: { ...flag, currentValue } });
  })
);

/**
 * POST /api/feature-flags
 * Create a new feature flag
 */
router.post(
  '/',
  body('key')
    .isString()
    .notEmpty()
    .matches(/^[a-z][a-z0-9_]*$/)
    .withMessage('키는 영문 소문자로 시작하고 소문자, 숫자, 밑줄만 사용 가능'),
  body('enabled').optional().isBoolean(),
  body('value').optional(),
  body('defaultValue').optional(),
  body('rolloutPercentage').optional().isInt({ min: 0, max: 100 }),
  body('type').optional().isIn(['boolean', 'string', 'number', 'json']),
  body('description').optional().isString(),
  body('targeting').optional().isObject(),
  body('storeOverrides').optional().isObject(),
  validate,
  asyncHandler(async (req, res) => {
    const flag = await FeatureFlagsService.setFlag(req.body, req.user.id);
    res.success({ flag }, '기능 플래그가 생성되었습니다', 201);
  })
);

/**
 * PUT /api/feature-flags/:key
 * Update a feature flag
 */
router.put(
  '/:key',
  param('key').isString().notEmpty(),
  body('enabled').optional().isBoolean(),
  body('value').optional(),
  body('defaultValue').optional(),
  body('rolloutPercentage').optional().isInt({ min: 0, max: 100 }),
  body('type').optional().isIn(['boolean', 'string', 'number', 'json']),
  body('description').optional().isString(),
  body('targeting').optional().isObject(),
  body('storeOverrides').optional().isObject(),
  validate,
  asyncHandler(async (req, res) => {
    const flag = await FeatureFlagsService.setFlag(
      {
        ...req.body,
        key: req.params.key,
      },
      req.user.id
    );
    res.success({ flag }, '기능 플래그가 업데이트되었습니다');
  })
);

/**
 * DELETE /api/feature-flags/:key
 * Delete a feature flag
 */
router.delete(
  '/:key',
  param('key').isString().notEmpty(),
  validate,
  asyncHandler(async (req, res) => {
    await FeatureFlagsService.deleteFlag(req.params.key, req.user.id);
    res.success(null, '기능 플래그가 삭제되었습니다');
  })
);

/**
 * POST /api/feature-flags/evaluate
 * Evaluate multiple flags for a given context
 */
router.post(
  '/evaluate',
  body('flags').isArray({ min: 1 }).withMessage('최소 하나의 플래그 키가 필요합니다'),
  body('flags.*').isString(),
  body('context').optional().isObject(),
  validate,
  asyncHandler(async (req, res) => {
    const { flags, context = {} } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const storeId = req.user.storeId || context.storeId;

    const results = await FeatureFlagsService.getFlags(flags, {
      storeId,
      userId,
      userRole,
      attributes: context.attributes,
    });

    res.success({ flags: results });
  })
);

/**
 * POST /api/feature-flags/ab-test
 * Create an A/B test
 */
router.post(
  '/ab-test',
  body('name').isString().notEmpty(),
  body('flagKey').isString().notEmpty(),
  body('variants').isArray({ min: 2 }).withMessage('최소 2개의 변형이 필요합니다'),
  body('variants.*.key').isString().notEmpty(),
  body('variants.*.value').notEmpty(),
  body('trafficSplit').isObject().withMessage('트래픽 분배 객체가 필요합니다'),
  body('successMetric').isString().notEmpty(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  validate,
  asyncHandler(async (req, res) => {
    const flag = await FeatureFlagsService.createABTest(req.body, req.user.id);
    res.success({ flag }, 'A/B 테스트가 생성되었습니다', 201);
  })
);

/**
 * GET /api/feature-flags/ab-test/:name/results
 * Get A/B test results
 */
router.get(
  '/ab-test/:name/results',
  param('name').isString().notEmpty(),
  validate,
  asyncHandler(async (req, res) => {
    const results = await FeatureFlagsService.getABTestResults(req.params.name);
    res.success({ results });
  })
);

module.exports = router;
