const AiAutoOrderService = require('../services/AiAutoOrderService');

const aiAutoOrderController = {
  async getShortages(req, res) {
    const result = await AiAutoOrderService.getShortages(req.params.storeId, req.query);
    res.success(result, '재고 부족 상품 조회 완료');
  },

  async recommend(req, res) {
    const result = await AiAutoOrderService.generateRecommendation(req.params.storeId, req.body);
    res.success(result, 'AI 자동 발주 추천 생성 완료');
  },

  async listRecommendations(req, res) {
    const result = await AiAutoOrderService.listRecommendations(
      req.params.storeId,
      req.query.status
    );
    res.success(result, '발주 추천 목록 조회 완료');
  },

  async getRecommendation(req, res) {
    const result = await AiAutoOrderService.getRecommendation(req.params.id, req.params.storeId);
    res.success(result, '발주 추천 상세 조회 완료');
  },

  async decide(req, res) {
    const result = await AiAutoOrderService.decide(
      req.params.id,
      req.params.storeId,
      req.body.status,
      req.user.id
    );
    res.success(result, '발주 추천 결정 처리 완료');
  },

  async getStats(req, res) {
    const result = await AiAutoOrderService.getStats(req.params.storeId);
    res.success(result, '발주 추천 통계 조회 완료');
  },
};

module.exports = aiAutoOrderController;
