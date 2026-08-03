const express = require('express');
const router = express.Router();
const loyaltyController = require('../controllers/loyaltyController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * @swagger
 * tags:
 *   name: Loyalty
 *   description: 디지털 스탬프 및 등급별 멤버십 로열티 API
 */

router.post(
  '/stamps',
  authMiddleware,
  checkStorePermission('items:manage'),
  loyaltyController.addStamps
);
router.post('/redeem', authMiddleware, loyaltyController.redeem);

module.exports = router;
