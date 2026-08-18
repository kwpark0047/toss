const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const featureFlagController = require('../controllers/featureFlagController');

router.get('/feature-flags', authMiddleware, adminOnly, catchAsync(featureFlagController.list));
router.put(
  '/feature-flags/:key',
  authMiddleware,
  adminOnly,
  catchAsync(featureFlagController.upsert)
);
router.delete(
  '/feature-flags/:key',
  authMiddleware,
  adminOnly,
  catchAsync(featureFlagController.remove)
);

module.exports = router;
