const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate
} = require('../controllers/notificationTemplatesController');

// 템플릿 목록 조회 (?store_id=&type=&is_active=)
router.get('/', authMiddleware, getTemplates);

// 단일 템플릿 조회
router.get('/:id', authMiddleware, getTemplate);

// 템플릿 생성
router.post('/', authMiddleware, createTemplate);

// 템플릿 수정
router.put('/:id', authMiddleware, updateTemplate);

// 템플릿 삭제
router.delete('/:id', authMiddleware, deleteTemplate);

module.exports = router;
