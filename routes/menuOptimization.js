const express = require('express');
const router = express.Router();
const menuOptimizationController = require('../controllers/menuOptimizationController');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * [메뉴 최적화 API 라우터]
 * 데이터 기반 메뉴 분석 및 AI 추천 기능을 제공합니다.
 */

// 1. 매장별 메뉴 수익성 분석 데이터 조회
router.get('/store/:storeId/analysis', 
  authMiddleware, 
  checkStorePermission('stats:read'), 
  menuOptimizationController.getMenuAnalysis
);

// 2. AI 기반 세트 메뉴 제안 받기
router.get('/store/:storeId/proposal', 
  authMiddleware, 
  checkStorePermission('products:write'), 
  menuOptimizationController.proposeSetMenus
);

module.exports = router;
