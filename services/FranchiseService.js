const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class FranchiseService {
  /**
   * 브랜치/본사 관리자의 전체 매장 목록 및 요약 통계 조회
   */
  async getFranchiseOverview(userId, userRole) {
    let storeWhere = {};
    if (userRole !== 'super_admin') {
      // 일반 점주인 경우 자신이 소유한 매장만
      storeWhere = { user_id: Number(userId) };
    }

    const stores = await prisma.stores.findMany({
      where: storeWhere,
      select: {
        id: true,
        name: true,
        category: true,
        status: true,
        created_at: true,
      },
    });

    const storeIds = stores.map((s) => s.id);

    // 오늘 매출 및 주문 수 집계
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const ordersSummary = await prisma.orders.groupBy({
      by: ['store_id'],
      where: {
        store_id: { in: storeIds },
        created_at: { gte: todayStart },
        status: { not: 'cancelled' },
      },
      _sum: { total_amount: true },
      _count: { id: true },
    });

    const summaryMap = {};
    ordersSummary.forEach((sum) => {
      summaryMap[sum.store_id] = {
        todayRevenue: sum._sum.total_amount || 0,
        todayOrdersCount: sum._count.id || 0,
      };
    });

    const overview = stores.map((store) => ({
      ...store,
      todayRevenue: summaryMap[store.id]?.todayRevenue || 0,
      todayOrdersCount: summaryMap[store.id]?.todayOrdersCount || 0,
    }));

    const totalRevenue = overview.reduce((acc, cur) => acc + cur.todayRevenue, 0);
    const totalOrders = overview.reduce((acc, cur) => acc + cur.todayOrdersCount, 0);

    return {
      totalStores: stores.length,
      totalTodayRevenue: totalRevenue,
      totalTodayOrders: totalOrders,
      stores: overview,
    };
  }

  /**
   * 본사 공지사항 / 일괄 지침 전파
   */
  async broadcastHqNotice(userId, userRole, data) {
    if (userRole !== 'super_admin' && userRole !== 'manager') {
      throw new AppError('본사 관리자 권한이 필요합니다.', 403);
    }

    const { title, message, target_store_ids } = data;
    if (!title || !message) {
      throw new AppError('제목과 내용을 입력해주세요.', 400);
    }

    let stores = [];
    if (target_store_ids && Array.isArray(target_store_ids) && target_store_ids.length > 0) {
      stores = await prisma.stores.findMany({
        where: { id: { in: target_store_ids.map(Number) } },
        select: { id: true },
      });
    } else {
      stores = await prisma.stores.findMany({ select: { id: true } });
    }

    const notificationsData = stores.map((store) => ({
      store_id: store.id,
      title: `[본사공지] ${title}`,
      message,
      type: 'HQ_NOTICE',
      is_read: false,
      created_at: new Date(),
    }));

    const created = await prisma.notifications.createMany({
      data: notificationsData,
    });

    logger.info({ count: created.count, title }, 'HQ notice broadcasted successfully');
    return { success: true, broadcastCount: created.count };
  }
}

module.exports = new FranchiseService();
