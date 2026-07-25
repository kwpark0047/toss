/**
 * IMonitoringRepository - 도메인 인터페이스 (추상화)
 *
 * 모니터링 데이터 액세스를 위한 포트(Port)입니다.
 * 인프라스트럭처 계층의 Prisma 구현체에 의해 구현됩니다.
 * 도메인 계층은 이 인터페이스에만 의존하며, 구체적 구현체에는 의존하지 않습니다.
 *
 * @interface
 */

class IMonitoringRepository {
  /**
   * 메트릭 데이터를 기록합니다.
   * @param {Object} data - 메트릭 데이터
   * @param {string} data.endpoint - API 엔드포인트
   * @param {string} data.method - HTTP 메서드
   * @param {number} data.response_time - 응답 시간 (ms)
   * @param {number} data.status_code - HTTP 상태 코드
   * @param {number|null} data.store_id - 매장 ID (선택)
   * @param {number|null} data.user_id - 사용자 ID (선택)
   */
  async record(_data) {
    throw new Error('Method not implemented');
  }

  /**
   * 지정된 기간의 성능 통계를 조회합니다.
   * @param {string|Date} _startDate - 시작일
   * @param {string|Date} _endDate - 종료일
   * @returns {Promise<{total_requests: number, avg_response_time: number}>}
   */
  async getStats(_startDate, _endDate) {
    throw new Error('Method not implemented');
  }

  /**
   * 플랫폼 집계 메트릭을 조회합니다.
   * @param {Date} _todayStart - 오늘 시작일
   * @returns {Promise<{totalStores: number, activeStores: number, ordersToday: number, totalUsers: number}>}
   */
  async getPlatformStats(_todayStart) {
    throw new Error('Method not implemented');
  }

  /**
   * 오늘의 매출을 조회합니다.
   * @param {Date} _todayStart - 오늘 시작일
   * @returns {Promise<{total_amount: number}>}
   */
  async getRevenueToday(_todayStart) {
    throw new Error('Method not implemented');
  }

  /**
   * 지정된 기간 내 시스템 에러 알림 수를 조회합니다.
   * @param {Date} _since - 시작일
   * @returns {Promise<number>}
   */
  async getErrorNotificationCount(_since) {
    throw new Error('Method not implemented');
  }

  /**
   * 지정된 기간 내 감사 로그 에러 수를 조회합니다.
   * @param {Date} _since - 시작일
   * @returns {Promise<number>}
   */
  async getAuditErrorCount(_since) {
    throw new Error('Method not implemented');
  }
}

module.exports = IMonitoringRepository;
