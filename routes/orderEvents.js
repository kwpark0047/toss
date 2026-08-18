const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const orderEventController = require('../controllers/orderEventController');

router.get('/order-events', authMiddleware, adminOnly, catchAsync(orderEventController.list));

module.exports = router;
