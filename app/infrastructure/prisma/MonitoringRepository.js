/**
 * MonitoringRepository - 인프라스트럭처 계층 (Prisma 구현체)
 *
 * IMonitoringRepository 인터페이스를 구현하는 구체적 리포지토리입니다.
 * Prisma 클라이언트에 직접 접근하며, 도메인 계층에 추상화됩니다.
 *
 * 기존 repositories/Monitoring.js의 기능을 보존하되,
 * Clean Architecture의 인터페이스 계층 의존성을 분리합니다.
 */

const IMonitoringRepository = require('../../domain/interfaces/IMonitoringRepository');
const prisma = require('../../../config/prisma');
const logger = require('../../../utils/logger');

class MonitoringRepository extends IMonitoringRepository {
  /**
   * 메트릭 데이터를 기록합니다.
   * @param {Object} data - 메트릭 데이터
   */
  async record(data) {
    try {
      if (!prisma.metrics) return;
      const { endpoint, method, response_time, status_code, store_id, user_id } = data;
      await prisma.metrics.create({
        data: {
          endpoint,
          method,
          response_time: parseInt(response_time),
          status_code: parseInt(status_code),
          store_id: store_id ? parseInt(store_id) : null,
          user_id: user_id ? parseInt(user_id) : null,
        },
      });
    } catch (e) {
      console.error('[Monitoring.record Error]:', e);
    }
  }

  /**
   * 지정된 기간의 성능 통계를 조회합니다.
   * @param {string|Date} startDate - 시작일
   * @param {string|Date} endDate - 종료일
   * @returns {Promise<{total_requests: number, avg_response_time: number}>}
   */
  async getStats(startDate, endDate) {
    const where = {};
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const stats = await prisma.metrics.aggregate({
      _count: { _all: true },
      _avg: { response_time: true },
      where,
    });

    return {
      total_requests: stats._count._all,
      avg_response_time: stats._avg.response_time || 0,
    };
  }

  /**
   * 플랫폼 집계 메트릭을 조회합니다.
   * @param {Date} todayStart - 오늘 시작일
   */
  async getPlatformStats(todayStart) {
    const [totalStores, activeStores, ordersToday, totalUsers] = await Promise.all([
      prisma.stores.count(),
      prisma.stores.count({ where: { is_active: true } }),
      prisma.orders.count({ where: { created_at: { gte: todayStart } } }),
      prisma.users.count(),
    ]);

    return { totalStores, activeStores, ordersToday, totalUsers };
  }

  /**
   * 오늘의 매출을 조회합니다.
   * @param {Date} todayStart - 오늘 시작일
   */
  async getRevenueToday(todayStart) {
    return await prisma.orders.aggregate({
      _sum: { total_amount: true },
      where: { created_at: { gte: todayStart }, status: { notIn: ['cancelled'] } },
    });
  }

  /**
   * 지정된 기간 내 시스템 에러 알림 수를 조회합니다.
   * @param {Date} since - 시작일
   */
  async getErrorNotificationCount(since) {
    return await prisma.notifications.count({
      where: { type: 'SYSTEM_ERROR', created_at: { gte: since } },
    });
  }

  /**
   * 지정된 기간 내 감사 로그 에러 수를 조회합니다.
   * @param {Date} since - 시작일
   */
  async getAuditErrorCount(since) {
    const result = await prisma.$queryRaw`
      SELECT COALESCE(COUNT(*), 0) AS cnt
      FROM "AuditLog"
      WHERE action = 'ERROR'
        AND created_at >= ${since}
    `;
    return Number(result[0]?.cnt || 0);
  }
}

module.exports = MonitoringRepository;
