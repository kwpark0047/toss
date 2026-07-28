const express = require('express');
const router = express.Router();
const waitingController = require('../controllers/waitingController');
const { createAIRateLimiter } = require('../utils/aiRateLimiter');

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
router.get('/store/:storeId', waitingController.getStoreWaitingList);

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
router.patch('/:id/status', waitingController.updateStatus);

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
router.get('/store/:storeId/ai-suggestions',
  createAIRateLimiter('getAISuggestions'),
  waitingController.getAISuggestions
);

module.exports = router;
