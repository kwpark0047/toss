const express = require('express');
const router = express.Router();
const waitingController = require('../controllers/waitingController');
const { createAIRateLimiter } = require('../utils/aiRateLimiter');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission, getStoreRole } = require('../middleware/storeAuth');
const { verifyWaitingCapability } = require('../utils/orderCapability');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

// 대기 상태 변경 시 body store_id 대신 대기 항목의 저장된 매장으로 권한을 확인한다
const checkWaitingPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const waitingId = parseInt(req.params.id);
      const waiting = await prisma.waiting_list.findUnique({
        where: { id: waitingId },
        select: { store_id: true },
      });
      if (!waiting) return res.status(404).json({ error: '대기 항목을 찾을 수 없습니다.' });
      const storeId = waiting.store_id;

      if (req.user.role === 'super_admin') {
        req.storeId = storeId;
        return next();
      }

      const role = await getStoreRole(req.user.id, storeId);
      if (!role) {
        return res.status(403).json({ error: '해당 매장에 대한 권한이 없습니다.' });
      }
      const permissions = require('../middleware/storeAuth').rolePermissions[role] || [];
      if (role === 'owner' || permissions.includes(requiredPermission)) {
        req.storeId = storeId;
        return next();
      }
      return res.status(403).json({ error: `권한이 부족합니다 (${requiredPermission})` });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({ error: '권한 검증 중 서버 오류가 발생했습니다' });
    }
  };
};

/**
 * @swagger
 * /api/waiting/store/{storeId}/status:
 *   get:
 *     tags: [Waiting]
 *     summary: 특정 매장의 현재 대기 현황 조회
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 대기 현황 (현재 대기 팀 수, 순번 정보)
 */
router.get('/store/:storeId/status', waitingController.getStoreStatus);

/**
 * @swagger
 * /api/waiting/store/{storeId}:
 *   get:
 *     tags: [Waiting]
 *     summary: 특정 매장의 대기 리스트 조회 (관리자)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 대기 중인 고객 목록
 */
router.get(
  '/store/:storeId',
  authMiddleware,
  checkStorePermission('order:read'),
  waitingController.getStoreWaitingList
);

/**
 * @swagger
 * /api/waiting/register:
 *   post:
 *     tags: [Waiting]
 *     summary: 대기 등록 (고객)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id, customer_name, customer_phone, party_size]
 *             properties:
 *               store_id: { type: integer, example: 1 }
 *               customer_name: { type: string, example: '홍길동' }
 *               customer_phone: { type: string, example: '01012345678' }
 *               party_size: { type: integer, example: 4 }
 *     responses:
 *       201:
 *         description: 대기 등록 완료 (순번 포함)
 *       400:
 *         description: 이미 대기 중
 */
router.post('/register', waitingController.register);

/**
 * @swagger
 * /api/waiting/{id}/status:
 *   patch:
 *     tags: [Waiting]
 *     summary: 대기 상태 변경 (호출/입장/취소)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [called, entered, cancelled] }
 *     responses:
 *       200:
 *         description: 상태 변경 완료
 */
router.patch(
  '/:id/status',
  authMiddleware,
  checkWaitingPermission('orders:manage'),
  waitingController.updateStatus
);

/**
 * @swagger
 * /api/waiting/my/{phone}:
 *   get:
 *     tags: [Waiting]
 *     summary: 내 대기 상태 조회 (휴대폰 번호 기준)
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema: { type: string }
 *         description: 휴대폰 번호
 *     responses:
 *       200:
 *         description: 대기 상태 및 앞 대기 수
 */
router.get('/my/:phone', waitingController.getMyWaiting);

/**
 * @swagger
 * /api/waiting/store/{storeId}/ai-suggestions:
 *   get:
 *     tags: [Waiting]
 *     summary: 대기 중 AI 메뉴 추천
 *     description: OmniRoute AI 기반으로 대기 중인 고객에게 메뉴를 추천합니다. 날씨, 과거 주문, 인기 메뉴를 고려합니다.
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: weather
 *         schema: { type: string, enum: [맑음, 비, 눈, 흐림] }
 *       - in: query
 *         name: mood
 *         schema: { type: string, enum: [보통, 기분좋음, 피곤함, 스트레스] }
 *       - in: query
 *         name: phone
 *         schema: { type: string }
 *       - in: query
 *         name: toss_user_key
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: AI 추천 메뉴 3개
 */
router.get(
  '/store/:storeId/ai-suggestions',
  createAIRateLimiter('getAISuggestions'),
  waitingController.getAISuggestions
);

module.exports = router;

/**
 * @swagger
 * /api/waiting/{id}/resend-notification:
 *   patch:
 *     tags: [Waiting]
 *     summary: 알림톡 재발송 (호출/취소 알림)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 알림톡 재발송 완료
 */
router.patch(
  '/:id/resend-notification',
  authMiddleware,
  checkWaitingPermission('orders:manage'),
  waitingController.resendNotification
);

// waiting capability 검증 (고객 본인 확인용)
const requireWaitingCapability = (req, res, next) => {
  const capability = verifyWaitingCapability(req.get('x-waiting-capability'));
  if (!capability) {
    return res.status(403).json({ error: '대기 조회 권한이 없거나 만료되었습니다.' });
  }
  const routeId = req.params.id ? parseInt(req.params.id) : null;
  if (routeId && capability.id !== routeId) {
    return res.status(403).json({ error: '대기 조회 권한이 없거나 만료되었습니다.' });
  }
  req.capability = capability;
  next();
};

/**
 * @swagger
 * /api/waiting/{id}/cancel:
 *   delete:
 *     tags: [Waiting]
 *     summary: 고객 본인 대기 취소 (전화번호 또는 capability 기반)
 *     security:
 *       - waitingCapability: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: 대기 취소 완료
 */
router.delete('/:id/cancel', requireWaitingCapability, waitingController.cancelWaiting);

/**
 * @swagger
 * /api/waiting/{id}/resend-customer-notification:
 *   patch:
 *     tags: [Waiting]
 *     summary: 고객 알림 재발송 (전화번호 또는 capability 기반)
 *     security:
 *       - waitingCapability: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: 알림 재발송 완료
 */
router.patch(
  '/:id/resend-customer-notification',
  requireWaitingCapability,
  waitingController.resendCustomerNotification
);

module.exports = router;

/**
 * @swagger
 * /api/waiting/toggle-favorite:
 *   post:
 *     tags: [Waiting]
 *     summary: 즐겨찾기 메뉴 토글 (고객)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id, customer_phone, menu_id]
 *             properties:
 *               store_id: { type: integer }
 *               customer_phone: { type: string }
 *               menu_id: { type: integer }
 *     responses:
 *       200:
 *         description: 즐겨찾기 토글 완료
 */
router.post('/toggle-favorite', waitingController.toggleFavorite);

module.exports = router;
