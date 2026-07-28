const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { getDriver, ALLOWED_EXTENSIONS } = require('../utils/storage');

/**
 * @swagger
 * tags:
 *   name: Uploads
 *   description: |
 *     파일 업로드/삭제 API.
 *     저장소는 STORAGE_DRIVER 환경변수로 선택한다(local | supabase).
 *     운영에서는 supabase 를 사용해야 재배포 시 파일이 소실되지 않는다. (M-9)
 */

// 메모리 스토리지 사용 — 드라이버가 로컬/원격 어디로든 쓸 수 있도록 버퍼로 받는다.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const extOk = ALLOWED_EXTENSIONS.has(ext);
    const mimeOk = /^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype || '');
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('이미지 파일만 업로드 가능합니다.'));
  },
});

/**
 * 드라이버가 반환한 URL 을 클라이언트가 바로 쓸 수 있는 절대 URL 로 보정한다.
 * - 원격(supabase) 드라이버는 이미 절대 URL 이므로 그대로 사용
 * - 로컬 드라이버는 상대 경로이므로 요청 호스트를 붙인다
 *   (Render 등 프록시 환경에서 mixed content 를 피하려고 x-forwarded-proto 우선)
 */
const toAbsoluteUrl = (req, url) => {
  if (/^https?:\/\//i.test(url)) return url;
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${req.get('host')}${url}`;
};

/**
 * @swagger
 * /api/uploads/image:
 *   post:
 *     tags: [Uploads]
 *     summary: 단일 이미지 업로드
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: 업로드된 이미지 URL
 */
router.post(
  '/image',
  authMiddleware,
  upload.single('image'),
  catchAsync(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '파일이 없습니다.' });
    }
    const { key, url } = await getDriver().save({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      prefix: 'image',
    });
    res.json({ success: true, url: toAbsoluteUrl(req, url), filename: key });
  })
);

/**
 * @swagger
 * /api/uploads/review-image:
 *   post:
 *     tags: [Uploads]
 *     summary: 리뷰 이미지 업로드 (고객용 무인증)
 *     description: 고객은 로그인하지 않으므로 인증 없이 허용하되, rate limit + 5MB + 이미지 한정 제한으로 방어.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: 업로드된 이미지 URL
 */
router.post(
  '/review-image',
  generalLimiter,
  upload.single('image'),
  catchAsync(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '파일이 없습니다.' });
    }
    const { key, url } = await getDriver().save({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      prefix: 'review',
    });
    res.json({ success: true, url: toAbsoluteUrl(req, url), filename: key });
  })
);

/**
 * @swagger
 * /api/uploads/images:
 *   post:
 *     tags: [Uploads]
 *     summary: 다중 이미지 업로드 (최대 10장)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: 업로드된 이미지 URL 배열
 */
router.post(
  '/images',
  authMiddleware,
  upload.array('images', 10),
  catchAsync(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: '파일이 없습니다.' });
    }
    const driver = getDriver();
    const saved = [];
    for (const file of req.files) {
      // 순차 저장: 부분 실패 시 이미 올라간 것을 되돌릴 수 있도록 키를 추적한다.
      saved.push(
        await driver.save({
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
          prefix: 'image',
        })
      );
    }
    res.json({
      success: true,
      urls: saved.map((s) => toAbsoluteUrl(req, s.url)),
      filenames: saved.map((s) => s.key),
    });
  })
);

/**
 * @swagger
 * /api/uploads/image/{filename}:
 *   delete:
 *     tags: [Uploads]
 *     summary: 이미지 파일 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 파일 삭제 완료
 *       400:
 *         description: 잘못된 파일 이름
 *       404:
 *         description: 파일 미발견
 */
router.delete(
  '/image/:filename',
  authMiddleware,
  catchAsync(async (req, res) => {
    const { filename } = req.params;
    const { isSafeKey } = require('../utils/storage');

    if (!isSafeKey(filename)) {
      return res.status(400).json({ success: false, error: '잘못된 파일 이름입니다.' });
    }

    const removed = await getDriver().remove(filename);
    if (!removed) {
      return res.status(404).json({ success: false, error: '파일을 찾을 수 없습니다.' });
    }
    logger.info(`[Uploads] 파일 삭제: ${filename} (user=${req.user?.id})`);
    res.json({ success: true, message: '파일이 성공적으로 삭제되었습니다.' });
  })
);

module.exports = router;
