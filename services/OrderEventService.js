const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const OrderEventService = {
  async record({
    orderId,
    storeId,
    eventType,
    fromStatus = null,
    toStatus = null,
    actorUserId = null,
    actorRole = null,
    metadata = null,
  }) {
    if (!prisma.order_events || !orderId || !storeId || !eventType) return null;
    try {
      return await prisma.order_events.create({
        data: {
          order_id: orderId,
          store_id: storeId,
          event_type: eventType,
          from_status: fromStatus,
          to_status: toStatus,
          actor_user_id: actorUserId,
          actor_role: actorRole,
          metadata,
        },
      });
    } catch (error) {
      logger.warn(`[OrderEvent] 기록 실패: ${error.message}`);
      return null;
    }
  },

  async list({ orderId, storeId, page = 1, limit = 50 } = {}) {
    if (!prisma.order_events) return { items: [], total: 0, page: 1, limit: 0, totalPages: 0 };
    const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNumber = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
    const where = {
      ...(orderId ? { order_id: Number.parseInt(orderId, 10) } : {}),
      ...(storeId ? { store_id: Number.parseInt(storeId, 10) } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.order_events.count({ where }),
      prisma.order_events.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (pageNumber - 1) * limitNumber,
        take: limitNumber,
      }),
    ]);
    return {
      items,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
    };
  },
};

module.exports = OrderEventService;
