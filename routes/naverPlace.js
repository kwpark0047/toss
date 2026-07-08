const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const naverPlaceService = require('../services/naverPlaceService');
const catchAsync = require('../utils/catchAsync');

// [GET] 매장의 네이버 플레이스 정보 조회
router.get('/store/:storeId', catchAsync(async (req, res) => {
  const { storeId } = req.params;
  const id = parseInt(storeId);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: '유효하지 않은 매장 ID입니다.' });
  }

  // 서비스 미설정 상태 체크
  if (!naverPlaceService.isConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'NAVER_CLIENT_SECRET 미설정 — 네이버 API 키를 환경변수에 설정하세요.',
    });
  }

  const store = await prisma.stores.findUnique({
    where: { id },
    select: { id: true, name: true, address: true, business_type: true },
  });

  if (!store) {
    return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });
  }

  const placeInfo = await naverPlaceService.searchPlace(store.name, store.address);

  if (!placeInfo) {
    return res.json({
      success: true,
      data: null,
      message: '네이버 플레이스에서 매장을 찾을 수 없습니다.',
    });
  }

  // 플레이스 URL로부터 review 경로 구성
  let reviewUrl = '';
  if (placeInfo.naverPlaceUrl) {
    // naverPlaceUrl 예시: https://place.map.naver.com/place/12345678
    // 리뷰 탭 경로: https://pcmap.place.naver.com/place/12345678/review
    const placeIdMatch = placeInfo.naverPlaceUrl.match(/place\/(\d+)/);
    if (placeIdMatch) {
      const placeId = placeIdMatch[1];
      reviewUrl = `https://pcmap.place.naver.com/place/${placeId}/review/visitors`;
    } else {
      reviewUrl = placeInfo.naverPlaceUrl;
    }
  }

  res.json({
    success: true,
    data: {
      ...placeInfo,
      reviewUrl,
    },
  });
}));

module.exports = router;
