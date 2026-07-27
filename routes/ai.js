const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { validateBody, validateId } = require("../middleware/validator");

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI 메뉴 분석 및 콘텐츠 생성 API
 */

/**
 * @swagger
 * /api/ai/describe-menu:
 *   post:
 *     tags: [AI]
 *     summary: 메뉴 설명 자동 생성
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: 생성된 메뉴 설명
 */
router.post("/describe-menu", validateBody(["name"]), aiController.describeMenu);

/**
 * @swagger
 * /api/ai/instagram:
 *   post:
 *     tags: [AI]
 *     summary: 인스타그램 문구 생성
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: 생성된 인스타그램 문구
 */
router.post("/instagram", validateBody(["name"]), aiController.generateInstagramCopy);

/**
 * @swagger
 * /api/ai/recommend:
 *   post:
 *     tags: [AI]
 *     summary: 메뉴 추천
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id]
 *             properties:
 *               store_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 추천 메뉴 목록
 */
router.post("/recommend", validateId(["store_id"]), aiController.recommendMenus);

/**
 * @swagger
 * /api/ai/recommend-dessert:
 *   post:
 *     tags: [AI]
 *     summary: 디저트 추천
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id]
 *             properties:
 *               store_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 추천 디저트 목록
 */
router.post("/recommend-dessert", validateId(["store_id"]), aiController.recommendDessert);

/**
 * @swagger
 * /api/ai/translate-menu:
 *   post:
 *     tags: [AI]
 *     summary: 메뉴 다국어 번역
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id, targetLang]
 *             properties:
 *               store_id:
 *                 type: integer
 *               targetLang:
 *                 type: string
 *     responses:
 *       200:
 *         description: 번역된 메뉴 목록
 */
router.post("/translate-menu", validateBody(["store_id", "targetLang"]), aiController.translateMenu);

/**
 * @swagger
 * /api/ai/translate:
 *   post:
 *     tags: [AI]
 *     summary: 텍스트 번역
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text, targetLang]
 *             properties:
 *               text:
 *                 type: string
 *               targetLang:
 *                 type: string
 *     responses:
 *       200:
 *         description: 번역 결과
 */
router.post("/translate", validateBody(["text", "targetLang"]), aiController.translate);

/**
 * @swagger
 * /api/ai/storytelling:
 *   post:
 *     tags: [AI]
 *     summary: 메뉴 스토리텔링 생성
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: 생성된 스토리텔링 텍스트
 */
router.post("/storytelling", validateBody(["name"]), aiController.storytelling);

/**
 * @swagger
 * /api/ai/analyze-menu-list:
 *   post:
 *     tags: [AI]
 *     summary: 메뉴 목록 분석
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               menuList:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 분석 결과
 */
router.post("/analyze-menu-list", aiController.analyzeMenuList);

/**
 * @swagger
 * /api/ai/propose-menu-full:
 *   post:
 *     tags: [AI]
 *     summary: 풀 메뉴 구성 제안
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: 제안된 풀 메뉴
 */
router.post("/propose-menu-full", validateBody(["name"]), aiController.proposeMenuFull);

/**
 * @swagger
 * /api/ai/recommend-pairing:
 *   post:
 *     tags: [AI]
 *     summary: 메뉴 페어링 추천
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id]
 *             properties:
 *               store_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 추천 페어링 목록
 */
router.post("/recommend-pairing", validateId(["store_id"]), aiController.recommendPairing);

/**
 * @swagger
 * /api/ai/generate-menu-image:
 *   post:
 *     tags: [AI]
 *     summary: 메뉴 이미지 AI 생성
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id, name]
 *             properties:
 *               store_id:
 *                 type: integer
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: 생성된 이미지 URL
 */
router.post("/generate-menu-image", validateBody(["store_id", "name"]), aiController.generateMenuImage);

/**
 * @swagger
 * /api/ai/scan-menu-image:
 *   post:
 *     tags: [AI]
 *     summary: 메뉴 이미지 스캔 (OCR)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               imageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: 스캔된 메뉴 데이터
 */
router.post("/scan-menu-image", aiController.scanMenuImage);

/**
 * @swagger
 * /api/ai/generate-review-reply:
 *   post:
 *     tags: [AI]
 *     summary: 리뷰 답글 자동 생성
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating, content]
 *             properties:
 *               rating:
 *                 type: integer
 *               content:
 *                 type: string
 *               customer_name:
 *                 type: string
 *               store_name:
 *                 type: string
 *     responses:
 *       200:
 *         description: 생성된 답글
 */
router.post("/generate-review-reply", validateBody(["rating", "content"]), aiController.generateReviewReply);

/**
 * @swagger
 * /api/ai/recommend-image-enhancement:
 *   post:
 *     tags: [AI]
 *     summary: 메뉴 이미지 보정 필터 추천
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: 추천 필터 값
 */
router.post("/recommend-image-enhancement", aiController.recommendImageEnhancement);

/**
 * @swagger
 * /api/ai/tinkerbell-rec:
 *   post:
 *     tags: [AI]
 *     summary: AI 팅keeper 동적 메뉴 추천
 *     description: 매장 컨텍스트(날씨, 시간, 고객 선호도)를 기반으로 OmniRoute AI가 메뉴를 추천합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id]
 *             properties:
 *               store_id:
 *                 type: integer
 *               weather:
 *                 type: string
 *                 enum: [맑음, 비, 눈, 흐림]
 *               mood:
 *                 type: string
 *                 enum: [보통, 기분좋음, 피곤함, 스트레스]
 *               phone:
 *                 type: string
 *                 description: 고객 전화번호 (주문 이력 기반 추천용)
 *               toss_user_key:
 *                 type: string
 *                 description: 토스 사용자 키 (주문 이력 기반 추천용)
 *     responses:
 *       200:
 *         description: AI 추천 메뉴 목록
 */
router.post("/tinkerbell-rec", aiController.tinkerbellRecommend);

module.exports = router;
