/**
 * GetErrorSummary - 애플리케이션 계층 Use Case
 *
 * 지정된 기간 내 시스템 에러 요약을 조회하는 비즈니스 로직을 캡슐화합니다.
 *
 * Clean Architecture: 인터페이스 계층 → 애플리케이션 계층 → 도메인 계층
 */

class GetErrorSummary {
  /**
   * @param {IMonitoringRepository} monitoringRepository - 모니터링 리포지토리 (DI)
   */
  constructor({ monitoringRepository }) {
    this.monitoringRepository = monitoringRepository;
  }

  /**
   * 지정된 기간 내 에러 요약을 조회합니다.
   * @param {Object} params
   * @param {number} params.hours - 조회 기간 (시간)
   * @returns {Promise<Object>} 에러 요약 응답
   */
  async execute({ hours = 24 }) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [errorNotifications, recentErrors] = await Promise.all([
      this.monitoringRepository.getErrorNotificationCount(since),
      this.monitoringRepository.getAuditErrorCount(since),
    ]);

    return {
      periodHours: hours,
      errorNotifications,
      auditErrors: recentErrors,
      total: errorNotifications + recentErrors,
      ts: new Date().toISOString(),
    };
  }
}

export default GetErrorSummary;
