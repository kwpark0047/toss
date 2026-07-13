const express = require('express');
const router = express.Router();
const optionTemplatesController = require('../controllers/optionTemplatesController');
const authMiddleware = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');

// 옵션 템플릿 목록 조회
router.get('/store/:storeId', authMiddleware, catchAsync(optionTemplatesController.getTemplates));

// 옵션 템플릿 생성
router.post('/', authMiddleware, catchAsync(optionTemplatesController.createTemplate));

// 옵션 템플릿 수정
router.put('/:id', authMiddleware, catchAsync(optionTemplatesController.updateTemplate));

// 옵션 템플릿 삭제
router.delete('/:id', authMiddleware, catchAsync(optionTemplatesController.deleteTemplate));

module.exports = router;
