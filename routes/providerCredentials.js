const router = require('express').Router();
const auth = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');
const { getStoreRole } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const credentials = require('../services/ProviderCredentialService');
router.use(auth, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use('/global', adminOnly);
router.use(
  '/stores/:storeId',
  catchAsync(async (req, res, next) => {
    const id = Number(req.params.storeId);
    if (!Number.isInteger(id) || id < 1 || id > 2147483647)
      throw new AppError('유효한 매장 ID가 필요합니다.', 400);
    if (req.user.role !== 'super_admin' && (await getStoreRole(req.user.id, id)) !== 'owner')
      throw new AppError('매장 소유주만 인증정보를 관리할 수 있습니다.', 403);
    next();
  })
);
for (const prefix of ['/global', '/stores/:storeId']) {
  const store = (req) => (req.params.storeId ? Number(req.params.storeId) : null);
  router.get(
    prefix,
    catchAsync(async (req, res) => res.success(await credentials.list(store(req))))
  );
  router.put(
    `${prefix}/:provider`,
    catchAsync(async (req, res) =>
      res.success(await credentials.save(req.params.provider, store(req), req.body, req.user.id))
    )
  );
  router.delete(
    `${prefix}/:provider`,
    catchAsync(async (req, res) =>
      res.success(await credentials.remove(req.params.provider, store(req)))
    )
  );
  router.post(
    `${prefix}/:provider/test`,
    catchAsync(async (req, res) =>
      res.success(await credentials.test(req.params.provider, store(req)))
    )
  );
}
module.exports = router;
