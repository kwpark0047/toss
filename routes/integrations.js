const router = require('express').Router();
const auth = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const { apiKeyAuth, requireScope } = require('../middleware/apiKeyAuth');
const catchAsync = require('../utils/catchAsync');
const StoreIntegrationService = require('../services/StoreIntegrationService');
const { CHANNELS, FIELDS } = require('../services/integrationContract');
const service = new StoreIntegrationService();

// Machine ingress never accepts a body store_id: the API key is the tenant authority.
router.post(
  '/events/:connectionId',
  apiKeyAuth,
  requireScope('integrations:write'),
  catchAsync(async (req, res) => {
    res.success(
      await service.ingest(req.apiClient.storeId, req.params.connectionId, req.body, 'api')
    );
  })
);
router.use('/stores/:storeId', auth, (req, res, next) => {
  if (
    !Number.isInteger(Number(req.params.storeId)) ||
    Number(req.params.storeId) < 1 ||
    Number(req.params.storeId) > 2147483647
  )
    return res.status(400).json({ error: '유효한 매장 ID가 필요합니다.' });
  next();
});
router.get('/stores/:storeId/catalog', checkStorePermission('stats:read'), (req, res) =>
  res.success({ channels: CHANNELS, fields: FIELDS })
);
router.get(
  '/stores/:storeId/overview',
  checkStorePermission('stats:read'),
  catchAsync(async (req, res) =>
    res.success(await service.overview(Number(req.params.storeId), req.query.days || 30))
  )
);
router.post(
  '/stores/:storeId/connections',
  checkStorePermission('store:update'),
  catchAsync(async (req, res) =>
    res.created(await service.createConnection(Number(req.params.storeId), req.body))
  )
);
router.patch(
  '/stores/:storeId/connections/:connectionId',
  checkStorePermission('store:update'),
  catchAsync(async (req, res) =>
    res.success(
      await service.setEnabled(
        Number(req.params.storeId),
        req.params.connectionId,
        req.body.enabled
      )
    )
  )
);
router.post(
  '/stores/:storeId/connections/:connectionId/preview',
  checkStorePermission('store:update'),
  catchAsync(async (req, res) =>
    res.success(
      await service.preview(Number(req.params.storeId), req.params.connectionId, req.body)
    )
  )
);
router.post(
  '/stores/:storeId/connections/:connectionId/import',
  checkStorePermission('store:update'),
  catchAsync(async (req, res) =>
    res.success(
      await service.ingest(Number(req.params.storeId), req.params.connectionId, req.body, 'csv')
    )
  )
);
module.exports = router;
