const express = require('express');
const featureFlagController = require('../controllers/featureFlagController');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');

const router = express.Router();

router.use('/feature-flags', authMiddleware, adminOnly);

router.get('/feature-flags', catchAsync(featureFlagController.list));
router.put('/feature-flags/:key', catchAsync(featureFlagController.upsert));
router.delete('/feature-flags/:key', catchAsync(featureFlagController.remove));

module.exports = router;
