const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /api/config/firebase:
 *   get:
 *     tags: [Config]
 *     summary: 프론트엔드용 Firebase 설정 조회
 *     description: Firebase Web SDK 초기화에 필요한 설정을 반환합니다.
 *     responses:
 *       200:
 *         description: Firebase 설정
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKey: { type: string }
 *                 projectId: { type: string }
 *                 messagingSenderId: { type: string }
 *                 appId: { type: string }
 *                 vapidKey: { type: string }
 */
router.get('/firebase', (req, res) => {
  const config = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    vapidKey: process.env.VITE_FIREBASE_VAPID_KEY,
  };

  // 필수값 검증
  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    console.warn('[Firebase Config] 누락된 환경변수:', missing.join(', '));
    return res.status(503).json({
      error: 'FIREBASE_CONFIG_INCOMPLETE',
      message: 'Firebase 설정이 완료되지 않았습니다.',
      missing,
    });
  }

  res.json(config);
});

module.exports = router;
