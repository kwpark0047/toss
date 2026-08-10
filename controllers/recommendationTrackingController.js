const RecommendationTrackingService = require('../services/RecommendationTrackingService');
const { AppError } = require('../utils/errorHandler');
const catchAsync = require('../utils/catchAsync');

/**
 * 추천 성과 추적 컨트롤러
 */
const recommendationTrackingController = {
  /**
   * 추천 노출 기록
   */
  recordImpression: catchAsync(async (req, res) => {
    const {
      storeId,
      sessionId,
      userId,
      phone,
      menuId,
      recommendationType,
      source,
      position,
      weatherContext,
      timePeriod,
    } = req.body;

    if (!storeId || !sessionId || !menuId || !recommendationType || !source) {
      throw new AppError(
        '필수 필드(storeId, sessionId, menuId, recommendationType, source)가 누락되었습니다.',
        400
      );
    }

    const impression = await RecommendationTrackingService.recordImpression({
      storeId: parseInt(storeId),
      sessionId,
      userId: userId ? parseInt(userId) : undefined,
      phone,
      menuId: parseInt(menuId),
      recommendationType,
      source,
      position: parseInt(position) || 0,
      weatherContext,
      timePeriod,
    });

    res.created(impression, '추천 노출이 기록되었습니다.');
  }),

  /**
   * 추천 클릭 기록
   */
  recordClick: catchAsync(async (req, res) => {
    const { impressionId, storeId, sessionId, userId, phone, menuId, recommendationType } =
      req.body;

    if (!impressionId || !storeId || !sessionId || !menuId || !recommendationType) {
      throw new AppError(
        '필수 필드(impressionId, storeId, sessionId, menuId, recommendationType)가 누락되었습니다.',
        400
      );
    }

    const click = await RecommendationTrackingService.recordClick({
      impressionId,
      storeId: parseInt(storeId),
      sessionId,
      userId: userId ? parseInt(userId) : undefined,
      phone,
      menuId: parseInt(menuId),
      recommendationType,
    });

    if (!click) {
      return res.status(404).json({ error: '해당 노출 기록을 찾을 수 없습니다.' });
    }

    res.created(click, '추천 클릭이 기록되었습니다.');
  }),

  /**
   * 추천 전환(주문) 기록
   */
  recordConversion: catchAsync(async (req, res) => {
    const {
      impressionId,
      clickId,
      storeId,
      sessionId,
      userId,
      phone,
      orderId,
      menuId,
      recommendationType,
    } = req.body;

    if (!storeId || !sessionId || !orderId || !menuId || !recommendationType) {
      throw new AppError(
        '필수 필드(storeId, sessionId, orderId, menuId, recommendationType)가 누락되었습니다.',
        400
      );
    }
    if (!impressionId && !clickId) {
      throw new AppError('impressionId 또는 clickId 중 하나는 필요합니다.', 400);
    }

    const conversion = await RecommendationTrackingService.recordConversion({
      impressionId,
      clickId,
      storeId: parseInt(storeId),
      sessionId,
      userId: userId ? parseInt(userId) : undefined,
      phone,
      orderId: parseInt(orderId),
      menuId: parseInt(menuId),
      recommendationType,
    });

    if (!conversion) {
      return res.status(404).json({ error: '주문 정보를 찾을 수 없습니다.' });
    }

    res.created(conversion, '추천 전환이 기록되었습니다.');
  }),

  /**
   * 매장별 일일 통계 조회
   */
  getDailyStats: catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { startDate, endDate, recommendationType } = req.query;

    if (!startDate || !endDate) {
      throw new AppError('시작일과 종료일이 필요합니다.', 400);
    }

    const stats = await RecommendationTrackingService.getDailyStats(
      parseInt(storeId),
      startDate,
      endDate,
      recommendationType
    );

    res.success(stats);
  }),

  /**
   * 매장별 종합 통계 요약
   */
  getSummaryStats: catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new AppError('시작일과 종료일이 필요합니다.', 400);
    }

    const stats = await RecommendationTrackingService.getSummaryStats(
      parseInt(storeId),
      startDate,
      endDate
    );

    res.success(stats);
  }),

  /**
   * 메뉴별 추천 성과
   */
  getMenuPerformance: catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new AppError('시작일과 종료일이 필요합니다.', 400);
    }

    const performance = await RecommendationTrackingService.getMenuPerformance(
      parseInt(storeId),
      startDate,
      endDate
    );

    res.success(performance);
  }),

  /**
   * 시간대별 추천 성과
   */
  getTimePeriodPerformance: catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new AppError('시작일과 종료일이 필요합니다.', 400);
    }

    const performance = await RecommendationTrackingService.getTimePeriodPerformance(
      parseInt(storeId),
      startDate,
      endDate
    );

    res.success(performance);
  }),

  /**
   * 세션별 추천 퍼널 분석
   */
  getSessionFunnel: catchAsync(async (req, res) => {
    const { storeId, sessionId } = req.params;

    const funnel = await RecommendationTrackingService.getSessionFunnel(
      parseInt(storeId),
      sessionId
    );

    res.success(funnel);
  }),
};

module.exports = recommendationTrackingController;
