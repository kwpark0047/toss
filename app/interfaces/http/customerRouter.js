const { Router } = require('express');
const authMiddleware = require('../../../middleware/auth');
const catchAsync = require('../../../utils/catchAsync');

function createCustomerRouter(customerController) {
  const router = Router();

  router.post('/phone-join', catchAsync(customerController.phoneJoinHandler.bind(customerController)));
  router.get('/detail/:customerId', authMiddleware, catchAsync(customerController.getDetail.bind(customerController)));
  router.get('/:storeId', catchAsync(customerController.getCustomers.bind(customerController)));
  router.get('/:storeId/stats', catchAsync(customerController.getStats.bind(customerController)));
  router.get('/:storeId/customer/:customerId/history', catchAsync(customerController.getHistory.bind(customerController)));
  router.get('/:storeId/coupons', catchAsync(customerController.getCoupons.bind(customerController)));
  router.post('/:storeId/customer/:customerId/coupon', catchAsync(customerController.issueCouponHandler.bind(customerController)));
  router.post('/update-location', catchAsync(customerController.updateLocation.bind(customerController)));
  router.post('/fcm-token', catchAsync(customerController.registerFcmToken.bind(customerController)));

  return router;
}

module.exports = createCustomerRouter;
