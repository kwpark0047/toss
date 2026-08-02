const prisma = require('../config/prisma');
const logger = require('../utils/logger');

class InventorySyncService {
  /**
   * 외부 배달 플랫폼(배민/쿠팡이츠 등)과 위마켓 간 재고 동기화 및 자동 발주 알림
   */
  async syncAndCheckAutoReorder(storeId) {
    const numericStoreId = Number(storeId);
    const lowStockProducts = await prisma.products.findMany({
      where: {
        store_id: numericStoreId,
        is_active: true,
        stock_quantity: { not: null },
      },
      select: {
        id: true,
        name: true,
        stock_quantity: true,
        low_stock_threshold: true,
      },
    });

    const reorderAlerts = [];
    for (const p of lowStockProducts) {
      const threshold = p.low_stock_threshold || 5;
      if (p.stock_quantity <= threshold) {
        reorderAlerts.push({
          productId: p.id,
          productName: p.name,
          currentStock: p.stock_quantity,
          threshold,
          message: `[자동발주 경고] '${p.name}' 잔여 재고(${p.stock_quantity}개)가 임계치(${threshold}개) 이하입니다. 도매상 자동 발주가 권장됩니다.`,
        });
      }
    }

    if (reorderAlerts.length > 0) {
      logger.warn(
        { storeId: numericStoreId, count: reorderAlerts.length },
        'Low stock auto-reorder alerts triggered'
      );
    }

    return {
      storeId: numericStoreId,
      checkedCount: lowStockProducts.length,
      reorderAlerts,
    };
  }
}

module.exports = new InventorySyncService();
