const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const storeController = require('../controllers/storeController');
const subscriptionController = require('../controllers/subscriptionController');
const { validateBody, validateQuery, validateParams } = require('../middleware/validate');
const {
  createStoreSchema,
  updateStoreSchema,
  businessInfoSchema,
  accountSchema,
  storeSearchQuerySchema,
  subscriptionPaymentMethodSchema,
  storeIdParamSchema,
} = require('../src/validation/schemas');

const bridgeStoreId = (req, _res, next) => {
  req.storeId = req.params.id;
  next();
};

/**
 * @swagger
 * /api/stores:
 *   get:
 *     tags: [Stores]
 *     summary: 전체 매장 목록 조회
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: 매장 목록
 */
router.get('/', validateQuery(storeSearchQuerySchema), catchAsync(storeController.getStores));

/**
 * @swagger
 * /api/stores/search:
 *   get:
 *     tags: [Stores]
 *     summary: 매장 검색
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: 검색어 (이름, 주소)
 *     responses:
 *       200:
 *         description: 검색 결과
 */
router.get(
  '/search',
  validateQuery(storeSearchQuerySchema),
  catchAsync(storeController.searchStores)
);

/**
 * @swagger
 * /api/stores/highlights:
 *   get:
 *     tags: [Stores]
 *     summary: 추천 매장 조회
 *     responses:
 *       200:
 *         description: 추천 매장 목록
 */
router.get('/highlights', catchAsync(storeController.getHighlights));

/**
 * @swagger
 * /api/stores/popular:
 *   get:
 *     tags: [Stores]
 *     summary: 인기 매장 조회
 *     responses:
 *       200:
 *         description: 인기 매장 목록
 */
router.get('/popular', catchAsync(storeController.getPopular));

/**
 * @swagger
 * /api/stores/favorites/{phone}:
 *   get:
 *     tags: [Stores]
 *     summary: 관심 매장 목록 조회
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 관심 매장 목록
 */
router.get('/favorites/:phone', catchAsync(storeController.getFavorites));

/**
 * @swagger
 * /api/stores/favorites:
 *   post:
 *     tags: [Stores]
 *     summary: 관심 매장 추가
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, store_id]
 *             properties:
 *               phone: { type: string }
 *               store_id: { type: integer }
 *     responses:
 *       201:
 *         description: 추가 완료
 */
router.post('/favorites', catchAsync(storeController.addFavorite));

/**
 * @swagger
 * /api/stores/favorites:
 *   delete:
 *     tags: [Stores]
 *     summary: 관심 매장 삭제
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, store_id]
 *             properties:
 *               phone: { type: string }
 *               store_id: { type: integer }
 *     responses:
 *       200:
 *         description: 삭제 완료
 */
router.delete('/favorites', catchAsync(storeController.removeFavorite));

/**
 * @swagger
 * /api/stores/my:
 *   get:
 *     tags: [Stores]
 *     summary: 내 매장 목록 조회 (인증 필요)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 관리하는 매장 목록
 */
router.get('/my', authMiddleware, catchAsync(storeController.getMyStores));

/**
 * @swagger
 * /api/stores:
 *   post:
 *     tags: [Stores]
 *     summary: 매장 생성
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStoreRequest'
 *     responses:
 *       201:
 *         description: 매장 생성 완료
 */
router.post(
  '/',
  authMiddleware,
  validateBody(createStoreSchema),
  catchAsync(async (req, res) => {
    const io = req.app.get('io');
    await storeController.createStore(req, res, io);
  })
);

/**
 * @swagger
 * /api/stores/{id}:
 *   get:
 *     tags: [Stores]
 *     summary: 매장 상세 조회
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 매장 상세 정보
 */
router.get(
  '/:id',
  validateParams(storeIdParamSchema),
  catchAsync(async (req, res) => {
    const cache = require('../utils/cache');
    const cacheKey = `store:${req.params.id}:profile`;
    const cached = cache.get(cacheKey);
    if (cached) return res.success(cached);
    await storeController.getStore(req, res);
  })
);

/**
 * @swagger
 * /api/stores/{id}:
 *   put:
 *     tags: [Stores]
 *     summary: 매장 정보 수정 (관리자)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateStoreRequest'
 *     responses:
 *       200:
 *         description: 수정 완료
 */
router.put(
  '/:id',
  authMiddleware,
  validateParams(storeIdParamSchema),
  bridgeStoreId,
  checkStorePermission('store:update'),
  validateBody(updateStoreSchema),
  catchAsync(storeController.updateStore)
);

/**
 * @swagger
 * /api/stores/{id}:
 *   delete:
 *     tags: [Stores]
 *     summary: 매장 삭제 (관리자)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 삭제 완료
 */
router.delete(
  '/:id',
  authMiddleware,
  validateParams(storeIdParamSchema),
  bridgeStoreId,
  checkStorePermission('store:delete'),
  catchAsync(storeController.deleteStore)
);

/**
 * @swagger
 * /api/stores/{id}/business:
 *   get:
 *     tags: [Stores]
 *     summary: 사업자 정보 조회 (관리자)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 사업자 정보
 */
router.get(
  '/:id/business',
  authMiddleware,
  validateParams(storeIdParamSchema),
  bridgeStoreId,
  checkStorePermission('settings:read'),
  catchAsync(storeController.getBusinessInfo)
);

/**
 * @swagger
 * /api/stores/{id}/business:
 *   put:
 *     tags: [Stores]
 *     summary: 사업자 정보 수정 (관리자)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BusinessInfoRequest'
 *     responses:
 *       200:
 *         description: 수정 완료
 */
router.put(
  '/:id/business',
  authMiddleware,
  validateParams(storeIdParamSchema),
  bridgeStoreId,
  checkStorePermission('settings:write'),
  validateBody(businessInfoSchema),
  catchAsync(storeController.updateBusinessInfo)
);

/**
 * @swagger
 * /api/stores/{id}/account:
 *   get:
 *     tags: [Stores]
 *     summary: 정산 계좌 조회 (관리자)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 정산 계좌 정보
 */
router.get(
  '/:id/account',
  authMiddleware,
  validateParams(storeIdParamSchema),
  bridgeStoreId,
  checkStorePermission('settings:read'),
  catchAsync(storeController.getAccount)
);

/**
 * @swagger
 * /api/stores/{id}/account:
 *   put:
 *     tags: [Stores]
 *     summary: 정산 계좌 수정 (관리자)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AccountRequest'
 *     responses:
 *       200:
 *         description: 수정 완료
 */
router.put(
  '/:id/account',
  authMiddleware,
  validateParams(storeIdParamSchema),
  bridgeStoreId,
  checkStorePermission('settings:write'),
  validateBody(accountSchema),
  catchAsync(storeController.upsertAccount)
);

/**
 * @swagger
 * /api/stores/{id}/account/public:
 *   get:
 *     tags: [Stores]
 *     summary: 공개 정산 계좌 조회 (고객용)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 공개 정산 계좌
 */
router.get(
  '/:id/account/public',
  validateParams(storeIdParamSchema),
  catchAsync(storeController.getPublicAccount)
);

/**
 * @swagger
 * /api/stores/{id}/subscription/payment-method:
 *   post:
 *     tags: [Stores]
 *     summary: 구독 결제수단 등록
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubscriptionPaymentMethodRequest'
 *     responses:
 *       201:
 *         description: 결제수단 등록 완료
 *       404:
 *         description: 플랜을 찾을 수 없음
 *       502:
 *         description: 빌링키 발급 실패
 */
router.post(
  '/:id/subscription/payment-method',
  authMiddleware,
  validateParams(storeIdParamSchema),
  bridgeStoreId,
  checkStorePermission('settings:write'),
  validateBody(subscriptionPaymentMethodSchema),
  catchAsync(subscriptionController.registerPaymentMethod)
);

module.exports = router;
