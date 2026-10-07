const router = require('express').Router();
const auth = require('../middleware/auth');
const { getStoreRole } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const StoreManagerService = require('../services/StoreManagerService');
const rateLimit = require('express-rate-limit').rateLimit;
const service = new StoreManagerService();
const store = (req) => Number(req.params.storeId);
router.param('storeId', (req, _res, next, value) => {
  if (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 2147483647)
    return next(new AppError('유효한 매장 ID가 필요합니다.', 400));
  next();
});
router.get(
  '/stores/:storeId/featured',
  rateLimit({ windowMs: 60000, limit: 120 }),
  catchAsync(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.success(await service.featured(store(req)));
  })
);
router.use(auth);
router.use(
  '/stores/:storeId',
  catchAsync(async (req, res, next) => {
    req.managerRole =
      req.user.role === 'super_admin' ? 'super_admin' : await getStoreRole(req.user.id, store(req));
    if (!['owner', 'manager', 'super_admin'].includes(req.managerRole))
      throw new AppError('매장 관리자 권한이 필요합니다.', 403);
    res.set('Cache-Control', 'no-store');
    next();
  })
);
const owner = (req, _res, next) =>
  ['owner', 'super_admin'].includes(req.managerRole)
    ? next()
    : next(new AppError('매장 소유주만 제안을 실행할 수 있습니다.', 403));
router.get(
  '/stores/:storeId/briefing',
  catchAsync(async (req, res) =>
    res.success({
      ...(await service.briefing(store(req))),
      can_execute: ['owner', 'super_admin'].includes(req.managerRole),
    })
  )
);
router.post(
  '/stores/:storeId/chat',
  rateLimit({ windowMs: 60000, limit: 10 }),
  catchAsync(async (req, res) => res.success(await service.chat(store(req), req.body.question)))
);
router.post(
  '/stores/:storeId/actions/:id/:event',
  owner,
  catchAsync(async (req, res) =>
    res.success(await service.transition(store(req), req.params.id, req.params.event, req.user.id))
  )
);
router.get(
  '/stores/:storeId/actions/:id/evaluation',
  catchAsync(async (req, res) => res.success(await service.evaluate(store(req), req.params.id)))
);
module.exports = router;
