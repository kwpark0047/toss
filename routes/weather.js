const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');

/**
 * @swagger
 * /api/weather/current:
 *   get:
 *     tags: [Weather]
 *     summary: 현재 날씨 조회
 *     parameters:
 *       - in: query
 *         name: stn
 *         schema:
 *           type: string
 *         description: '기상관측 지점번호 (기본값: 108 서울)'
 *     responses:
 *       200:
 *         description: 현재 날씨 정보
 *     security:
 *       - bearerAuth: []
 */
router.get('/current', weatherController.getCurrentWeather);

/**
 * @swagger
 * /api/weather/enhanced:
 *   get:
 *     tags: [Weather]
 *     summary: 향상된 날씨 컨텍스트 조회 (추천 시스템용)
 *     parameters:
 *       - in: query
 *         name: stn
 *         schema:
 *           type: string
 *         description: '기상관측 지점번호 (기본값: 108 서울)'
 *     responses:
 *       200:
 *         description: 향상된 날씨 컨텍스트 (체감온도, 공기질, 계절, 시간대, 음식 가중치 포함)
 *     security:
 *       - bearerAuth: []
 */
router.get('/enhanced', weatherController.getEnhancedWeatherContext);

/**
 * @swagger
 * /api/weather/coords:
 *   get:
 *     tags: [Weather]
 *     summary: 좌표 기반 날씨 조회
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *         description: 위도
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *         description: 경도
 *     responses:
 *       200:
 *         description: 좌표 기반 날씨 정보
 */
router.get('/coords', weatherController.getWeatherByCoords);

module.exports = router;
