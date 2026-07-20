const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');

/**
 * @swagger
 * tags:
 *   name: Weather
 *   description: 날씨 정보 API
 */

/**
 * @swagger
 * /api/weather/current:
 *   get:
 *     tags: [Weather]
 *     summary: 현재 날씨 조회
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: 위도
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: 경도
 *     responses:
 *       200:
 *         description: 현재 날씨 정보
 */
router.get('/current', weatherController.getCurrentWeather);

module.exports = router;
