/**
 * MonitoringController (Clean Architecture 버전) - 인터페이스 계층
 *
 * 기존 controllers/monitoringController.js의 기능을 보존하되,
 * DI 컨테이너에서 해석된 Use Case에 의존합니다.
 *
 * Clean Architecture: 인터페이스 계층 → 애플리케이션 계층 (DI)
 *
 * @deprecated 기존 controllers/monitoringController.js는 점진적 마이그레이션을 위해 유지됩니다.
 *             새로운 모듈은 이 패턴을 따릅니다.
 */

const catchAsync = require('../../../utils/catchAsync');

/**
 * 모니터링 컨트롤러 팩토리
 * DI 컨테이너에서 Use Case를 주입받아 컨트롤러를 생성합니다.
 *
 * @param {Object} deps - 의존성
 * @param {Object} deps.getSystemStats - GetSystemStats Use Case
 * @param {Object} deps.getErrorSummary - GetErrorSummary Use Case
 */
function createMonitoringController({ getSystemStats, getErrorSummary }) {
  return {
    /**
     * [GET] 시스템 통합 메트릭
     * 인증 불필요 (헬스체크와 동일 수준)
     */
    getSystemStats: catchAsync(async (req, res) => {
      const result = await getSystemStats.execute();
      res.success(result);
    }),

    /**
     * [GET] 에러 로그 요약 (슬라이딩 윈도우)
     * 인증 불필요
     */
    getErrorSummary: catchAsync(async (req, res) => {
      const hours = parseInt(req.query.hours) || 24;
      const result = await getErrorSummary.execute({ hours });
      res.success(result);
    }),
  };
}

module.exports = createMonitoringController;
