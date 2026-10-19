const router = require('express').Router();
const auth = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const Service = require('../services/BusinessSupportService');
const rateLimit = require('express-rate-limit').rateLimit;
const service = new Service();
router.use(auth, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.param('storeId', (_req, _res, next, value) =>
  next(
    Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647
      ? undefined
      : new AppError('유효한 매장 ID가 필요합니다.', 400)
  )
);
const store = (req) => Number(req.params.storeId);
router.get(
  '/overview',
  catchAsync(async (req, res) => res.success(await service.overview(req.user)))
);
const list = async (req, res) => {
  const cursor = String(req.query.cursor || '0:0');
  if (!/^[0-3]:\d{1,15}$/.test(cursor)) throw new AppError('유효한 페이지 커서가 필요합니다.', 400);
  res.success(await service.list(req.user, req.params.storeId ? store(req) : null, cursor));
};
router.get('/cases', catchAsync(list));
router.get('/stores/:storeId/cases', catchAsync(list));
router.get(
  '/stores/:storeId/enrollment',
  catchAsync(async (req, res) => res.success(await service.enrollment(store(req), req.user)))
);
router.put(
  '/stores/:storeId/enrollment',
  catchAsync(async (req, res) =>
    res.success(await service.enroll(store(req), req.user, req.body.enabled))
  )
);
router.post(
  '/stores/:storeId/rescan',
  rateLimit({ windowMs: 60000, limit: 3 }),
  catchAsync(async (req, res) => {
    res.success(await service.requestRescan(store(req), req.user));
  })
);
router.get(
  '/stores/:storeId/cases/:id',
  catchAsync(async (req, res) =>
    res.success(await service.detail(store(req), req.params.id, req.user))
  )
);
router.post(
  '/stores/:storeId/cases/:id/evaluate',
  catchAsync(async (req, res) =>
    res.success(await service.evaluate(store(req), req.params.id, req.user))
  )
);
router.post(
  '/stores/:storeId/cases/:id/:event',
  rateLimit({ windowMs: 60000, limit: 30 }),
  catchAsync(async (req, res) =>
    res.success(
      await service.transition(
        store(req),
        req.params.id,
        req.params.event,
        req.user,
        req.body.operation_id,
        req.body.note || ''
      )
    )
  )
);
module.exports = router;

