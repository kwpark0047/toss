/**
 * GetSystemStats - 애플리케이션 계층 Use Case
 *
 * 시스템 통합 메트릭을 조회하는 비즈니스 로직을 캡슐화합니다.
 * 컨트롤러는 이 Use Case에 의존하며, 리포지토리 인터페이스에 의존합니다.
 *
 * Clean Architecture: 인터페이스 계층 → 애플리케이션 계층 → 도메인 계층
 */

class GetSystemStats {
  /**
   * @param {IMonitoringRepository} monitoringRepository - 모니터링 리포지토리 (DI)
   */
  constructor({ monitoringRepository }) {
    this.monitoringRepository = monitoringRepository;
  }

  /**
   * 시스템 통합 메트릭을 조회합니다.
   * @returns {Promise<Object>} 통합 메트릭 응답
   */
  async execute() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. 플랫폼 집계 (todayStart 기준)
    const [totalStores, activeStores, ordersToday, totalUsers] = await Promise.all([
      this.monitoringRepository.getPlatformStats(todayStart),
    ]).then((results) => {
      const stats = results[0];
      return [stats.totalStores, stats.activeStores, stats.ordersToday, stats.totalUsers];
    });

    // 2. 최근 주문 매출 합계
    const revenueToday = await this.monitoringRepository.getRevenueToday(todayStart);

    // 3. Metrics repository 성능 통계 (최근 24h)
    const perf24h = await this.monitoringRepository.getStats(
      new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      now.toISOString()
    );

    // 4. 서버 리소스
    const mem = process.memoryUsage();
    const memUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(mem.heapTotal / 1024 / 1024);

    return {
      platform: {
        totalStores,
        activeStores,
        inactiveStores: totalStores - activeStores,
        totalUsers,
        ordersToday,
        revenueToday: revenueToday._sum?.total_amount || revenueToday.total_amount || 0,
      },
      performance: {
        totalRequests24h: perf24h.total_requests,
        avgResponseTimeMs: Math.round(perf24h.avg_response_time),
      },
      server: {
        uptimeSeconds: Math.floor(process.uptime()),
        heapUsedMB: memUsedMB,
        heapTotalMB: memTotalMB,
        heapUsagePct: memTotalMB > 0 ? Math.round((memUsedMB / memTotalMB) * 100) : 0,
        memoryRssMB: Math.round(mem.rss / 1024 / 1024),
      },
      ts: now.toISOString(),
    };
  }
}

export default GetSystemStats;
