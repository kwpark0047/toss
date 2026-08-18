const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const auditLogController = require('../controllers/auditLogController');

router.get('/audit-logs', authMiddleware, adminOnly, catchAsync(auditLogController.list));
router.delete(
  '/audit-logs/retention',
  authMiddleware,
  adminOnly,
  catchAsync(auditLogController.prune)
);

module.exports = router;
