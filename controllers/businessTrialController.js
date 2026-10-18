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

exports.revokeApproval = catchAsync(async (req, res) => {
  const account = await service.revokeApproval(req.params.id, req.user.id);
  res.success({ account }, '정식 이용 승인을 취소했습니다.');
});

exports.deleteAccount = catchAsync(async (req, res) => {
  if (req.body?.confirm !== '삭제') {
    const { AppError } = require('../utils/errorHandler');
    throw new AppError('계정 삭제 확인 문구를 입력해 주세요.', 400);
  }
  const result = await service.deleteAccount(req.params.id, req.user.id);
  res.success(result, '계정 로그인과 개인정보를 정리했습니다. 재무·감사 기록은 보존됩니다.');
});

