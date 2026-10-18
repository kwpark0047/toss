const { BusinessTrialService } = require('../services/BusinessTrialService');
const catchAsync = require('../utils/catchAsync');

const service = new BusinessTrialService();

exports.list = catchAsync(async (req, res) => {
  const accounts = await service.list(req.query.status || 'trialing', req.query.limit);
  res.success({ accounts, count: accounts.length });
});

exports.approve = catchAsync(async (req, res) => {
  const account = await service.approve(req.params.id, req.user.id);
  res.success({ account }, '정식 이용을 승인했습니다.');
});

