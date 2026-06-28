// [DEPRECATED] 이 파일은 더 이상 사용되지 않습니다.
// 실제 인증 미들웨어는 ./auth.js를 사용하세요.
// 이 파일은 테스트용 Mock으로, 프로덕션 환경에서 사용해서는 안 됩니다.
const authMiddleware = (req, res, next) => {
  // Mock user for testing purposes
  req.user = { id: 'test-user-id', role: 'admin' };
  next();
};

module.exports = authMiddleware;
