/**
 * Express 비동기 에러 핸들링 래퍼.
 * Express 5.x부터 async route handler의 거절된 Promise를 자동으로 catch하므로
 * 신규 라우터에서는 catchAsync 없이 직접 async handler를 사용해도 됩니다.
 * 기존 라우터와의 일관성을 위해 유지하며, 레거시 Express 4 호환성을 제공합니다.
 */
const catchAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
