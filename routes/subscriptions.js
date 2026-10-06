const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const idempotency = require('../middleware/idempotency');
const billing = require('../services/SaaSBillingService');
const { AppError } = require('../utils/errorHandler');
const catchAsync = require('../utils/catchAsync');
const router = express.Router({ mergeParams: true });
router.use('/:storeId', authMiddleware, checkStorePermission('store:update'), (req, res, next) => {
  req.storeId = Number(req.params.storeId);
  if (!Number.isSafeInteger(req.storeId) || req.storeId <= 0)
    return next(new AppError('유효한 매장 ID가 필요합니다.', 400));
  if (!['owner', 'super_admin'].includes(req.storeRole))
    return next(new AppError('구독 관리는 매장 소유자만 가능합니다.', 403));
  return next();
});
router.get(
  '/:storeId',
  catchAsync(async (req, res) => res.success(await billing.summary(req.storeId)))
);
router.get(
  '/:storeId/invoices',
  catchAsync(async (req, res) => res.success(await billing.invoices(req.storeId)))
);
router.post(
  '/:storeId/checkout',
  catchAsync(async (req, res) => {
    if (req.body.automatic_payment_consent !== true)
      throw new AppError('자동 결제 동의가 필요합니다.', 400);
    if (typeof req.body.plan_id !== 'string') throw new AppError('플랜 ID가 필요합니다.', 400);
    res.success(
      await billing.checkout(
        req.storeId,
        req.user.id,
        req.body.plan_id,
        req.body.billing_cycle || 'MONTHLY',
        req.body.mode || 'subscribe'
      )
    );
  })
);
router.post(
  '/:storeId/activate',
  idempotency({ namespace: 'subscription:activate', required: true }),
  catchAsync(async (req, res) => {
    res.success(
      await billing.activate(req.storeId, req.user.id, req.body.auth_key, req.body.checkout_token)
    );
  })
);
router.post(
  '/:storeId/cancel',
  catchAsync(async (req, res) => res.success(await billing.cancel(req.storeId)))
);
router.post(
  '/:storeId/resume',
  catchAsync(async (req, res) => {
    if (req.body.automatic_payment_consent !== true)
      throw new AppError('자동 결제 동의가 필요합니다.', 400);
    res.success(await billing.resume(req.storeId, req.user.id));
  })
);
router.post(
  '/:storeId/invoices/:invoiceId/retry',
  idempotency({ namespace: 'subscription:retry', required: true }),
  catchAsync(async (req, res) => {
    res.success(await billing.retryInvoice(req.storeId, req.params.invoiceId));
  })
);
router.post(
  '/:storeId/plan',
  catchAsync(async (req, res) => {
    if (req.body.automatic_payment_consent !== true)
      throw new AppError('변경 요금의 자동 결제 동의가 필요합니다.', 400);
    if (typeof req.body.plan_id !== 'string') throw new AppError('플랜 ID가 필요합니다.', 400);
    res.success(
      await billing.schedulePlan(
        req.storeId,
        req.body.plan_id,
        req.body.billing_cycle || 'MONTHLY',
        req.user.id
      )
    );
  })
);
module.exports = router;
