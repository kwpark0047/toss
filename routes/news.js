const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');
const authMiddleware = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');

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
 *     summary: 뉴스 목록 조회 (공개)
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
 *     summary: 뉴스 크롤링 트리거 (super_admin 전용)
 *     description: |
 *       외부 사이트로 대량 아웃바운드 요청을 유발하므로 무인증 노출 시
 *       리소스 남용/DoS 증폭 경로가 된다. 관리자 권한을 요구한다.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 크롤링 시작
 *       401:
 *         description: 인증 필요
 *       403:
 *         description: 관리자 권한 필요
 */
router.post('/crawl', authMiddleware, adminOnly, newsController.triggerCrawl);

module.exports = router;
