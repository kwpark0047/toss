const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const storeController = require('../controllers/storeController');
const { validateBody, validateQuery, validateParams } = require('../middleware/validate');
const { 
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
} = require('../src/validation/schemas');

const bridgeStoreId = (req, _res, next) => { req.storeId = req.params.id; next(); };

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
router.get('/search', validateQuery(storeSearchQuerySchema), catchAsync(storeController.searchStores));

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
router.post('/', authMiddleware, validateBody(createStoreSchema), catchAsync(async (req, res) => {
    const io = req.app.get('io');
    await storeController.createStore(req, res, io);
}));

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
router.get('/:id', validateParams(storeIdParamSchema), catchAsync(async (req, res) => {
    const cache = require('../utils/cache');
    const cacheKey = `store:${req.params.id}:profile`;
    const cached = cache.get(cacheKey);
    if (cached) return res.success(cached);
    await storeController.getStore(req, res);
}));

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
router.put('/:id', authMiddleware, validateParams(storeIdParamSchema), bridgeStoreId, checkStorePermission('store:update'), validateBody(updateStoreSchema), catchAsync(storeController.updateStore));

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
router.delete('/:id', authMiddleware, validateParams(storeIdParamSchema), bridgeStoreId, checkStorePermission('store:delete'), catchAsync(storeController.deleteStore));

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
router.get('/:id/business', authMiddleware, validateParams(storeIdParamSchema), bridgeStoreId, checkStorePermission('settings:read'), catchAsync(storeController.getBusinessInfo));

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
router.put('/:id/business', authMiddleware, validateParams(storeIdParamSchema), bridgeStoreId, checkStorePermission('settings:write'), validateBody(businessInfoSchema), catchAsync(storeController.updateBusinessInfo));

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
router.get('/:id/account', authMiddleware, validateParams(storeIdParamSchema), bridgeStoreId, checkStorePermission('settings:read'), catchAsync(storeController.getAccount));

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
router.put('/:id/account', authMiddleware, validateParams(storeIdParamSchema), bridgeStoreId, checkStorePermission('settings:write'), validateBody(accountSchema), catchAsync(storeController.upsertAccount));

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
router.get('/:id/account/public', validateParams(storeIdParamSchema), catchAsync(storeController.getPublicAccount));

/**
 * @swagger
 * /api/stores/{id}/settings:
 *   get:
 *     tags: [Stores]
 *     summary: 매장 설정 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 매장 설정
 */
router.get('/:id/settings', authMiddleware, validateParams(storeIdParamSchema), bridgeStoreId, checkStorePermission('settings:read'), catchAsync(storeController.getSettings));

/**
 * @swagger
 * /api/stores/{id}/settings:
 *   put:
 *     tags: [Stores]
 *     summary: 매장 설정 수정
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
 *             $ref: '#/components/schemas/StoreSettingsRequest'
 *     responses:
 *       200:
 *         description: 설정 수정 완료
 */
router.put('/:id/settings', authMiddleware, validateParams(storeIdParamSchema), bridgeStoreId, checkStorePermission('settings:write'), validateBody(storeSettingsSchema), catchAsync(storeController.updateSettings));

/**
 * @swagger
 * /api/stores/{id}/qr:
 *   post:
 *     tags: [Stores]
 *     summary: QR 코드 생성
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
 *             $ref: '#/components/schemas/GenerateQRRequest'
 *     responses:
 *       200:
 *         description: QR 코드 생성 완료
 */
router.post('/:id/qr', authMiddleware, validateParams(storeIdParamSchema), bridgeStoreId, checkStorePermission('settings:write'), validateBody(generateQRSchema), catchAsync(storeController.generateQR));

/**
 * @swagger
 * /api/stores/{id}/theme:
 *   get:
 *     tags: [Stores]
 *     summary: 매장 테마 조회
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 테마 설정
 */
router.get('/:id/theme', validateParams(storeIdParamSchema), catchAsync(storeController.getTheme));

/**
 * @swagger
 * /api/stores/{id}/theme:
 *   put:
 *     tags: [Stores]
 *     summary: 매장 테마 수정
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
 *             $ref: '#/components/schemas/StoreThemeRequest'
 *     responses:
 *       200:
 *         description: 테마 수정 완료
 */
router.put('/:id/theme', authMiddleware, validateParams(storeIdParamSchema), bridgeStoreId, checkStorePermission('settings:write'), validateBody(storeThemeSchema), catchAsync(storeController.updateTheme));

/**
 * @swagger
 * /api/stores/{id}/foodtruck-design:
 *   get:
 *     tags: [Stores]
 *     summary: 푸드트럭 디자인 테마 조회
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 디자인 테마
 */
router.get('/:id/foodtruck-design', validateParams(storeIdParamSchema), catchAsync(storeController.getFoodTruckDesign));

/**
 * @swagger
 * /api/stores/{id}/foodtruck-design:
 *   put:
 *     tags: [Stores]
 *     summary: 푸드트럭 디자인 테마 수정
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
 *             $ref: '#/components/schemas/FoodTruckDesignRequest'
 *     responses:
 *       200:
 *         description: 디자인 수정 완료
 */
router.put('/:id/foodtruck-design', authMiddleware, validateParams(storeIdParamSchema), bridgeStoreId, checkStorePermission('settings:write'), validateBody(foodTruckDesignSchema), catchAsync(storeController.updateFoodTruckDesign));

module.exports = router;