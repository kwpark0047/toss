const franchiseService = require('../services/FranchiseService');
const catchAsync = require('../utils/catchAsync');

const franchiseController = {
  getOverview: catchAsync(async (req, res) => {
    const result = await franchiseService.getFranchiseOverview(req.user.id, req.user.role);
    res.success(result, '프랜차이즈 통합 현황을 조회했습니다.');
  }),

  broadcastNotice: catchAsync(async (req, res) => {
    const result = await franchiseService.broadcastHqNotice(req.user.id, req.user.role, req.body);
    res.success(result, '본사 공지가 성공적으로 전파되었습니다.');
  }),
};

module.exports = franchiseController;
