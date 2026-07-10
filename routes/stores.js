const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const storeController = require('../controllers/storeController');

// checkStorePermission은 req.params.storeId를 참조하므로 /:id -> storeId 브리지
const bridgeStoreId = (req, _res, next) => { req.storeId = req.params.id; next(); };

// ── 공개 라우트 (인증 불필요) ──
router.get('/', catchAsync(storeController.getStores));
router.get('/search', catchAsync(storeController.searchStores));
router.get('/highlights', catchAsync(storeController.getHighlights));
router.get('/popular', catchAsync(storeController.getPopular));
router.get('/favorites/:phone', catchAsync(storeController.getFavorites));
router.post('/favorites', catchAsync(storeController.addFavorite));
router.delete('/favorites', catchAsync(storeController.removeFavorite));

// ── 인증 필요 ──
router.get('/my', authMiddleware, catchAsync(storeController.getMyStores));
router.post('/', authMiddleware, catchAsync(async (req, res) => {
    const io = req.app.get('io');
    await storeController.createStore(req, res, io);
}));

// ── 매장 상세 (캐시 적용) ──
router.get('/:id', catchAsync(async (req, res) => {
    const cache = require('../utils/cache');
    const cacheKey = `store:${req.params.id}:profile`;
    const cached = cache.get(cacheKey);
    if (cached) return res.success(cached);
    await storeController.getStore(req, res);
}));

// ── 관리자 전용 (인증 + 권한) ──
router.put('/:id', authMiddleware, bridgeStoreId, checkStorePermission('store:update'), catchAsync(storeController.updateStore));
router.delete('/:id', authMiddleware, bridgeStoreId, checkStorePermission('store:delete'), catchAsync(storeController.deleteStore));
router.get('/:id/business', authMiddleware, bridgeStoreId, checkStorePermission('settings:read'), catchAsync(storeController.getBusinessInfo));
router.put('/:id/business', authMiddleware, bridgeStoreId, checkStorePermission('settings:write'), catchAsync(storeController.updateBusinessInfo));
router.get('/:id/account', authMiddleware, bridgeStoreId, checkStorePermission('settings:read'), catchAsync(storeController.getAccount));
router.put('/:id/account', authMiddleware, bridgeStoreId, checkStorePermission('settings:write'), catchAsync(storeController.upsertAccount));

// ── 공개 (고객용) ──
router.get('/:id/account/public', catchAsync(storeController.getPublicAccount));

module.exports = router;
