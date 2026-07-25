const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');

/**
 * @swagger
 * tags:
 *   name: News
 *   description: 뉴스/크롤링 API
 */

/**
 * @swagger
 * /api/news:
 *   get:
 *     tags: [News]
 *     summary: 뉴스 목록 조회
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 뉴스 목록
 */
router.get('/', newsController.getNews);

/**
 * @swagger
 * /api/news/crawl:
 *   post:
 *     tags: [News]
 *     summary: 뉴스 크롤링 트리거
 *     responses:
 *       200:
 *         description: 크롤링 시작
 */
router.post('/crawl', newsController.triggerCrawl);

module.exports = router;
