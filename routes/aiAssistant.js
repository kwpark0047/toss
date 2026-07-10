const express = require('express');
const router = express.Router();
const aiAssistantController = require('../controllers/aiAssistantController');
const { authMiddleware } = require('../middleware/auth');

/**
 * [AI 어시스턴트 API 라우터]
 * 고객의 맞춤형 추천 및 번역 기능을 제공합니다.
 */

// 1. AI와 채팅하기 (메뉴 추천 요청)
router.post('/chat', 
  // 고객은 메뉴판 비회원도 접근 가능할 수 있으므로 상황에 따라 authMiddleware 조정 필요
  // 여기서는 기본적으로 인증을 적용함
  authMiddleware, 
  aiAssistantController.chatWithAI
);

// 2. 메시지 실시간 번역
router.post('/translate', 
  authMiddleware, 
  aiAssistantController.translateMessage
);

module.exports = router;
