const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');

const parsePositiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new AppError(`유효하지 않은 ${fieldName}입니다.`, 400);
  return parsed;
};

const InventoryReorderService = {
  async generateCandidates(storeId, options = {}) {
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    const lookbackDays = Math.min(90, Math.max(7, Number.parseInt(options.lookbackDays, 10) || 30));
    const leadTimeDays = Math.min(30, Math.max(0, Number.parseInt(options.leadTimeDays, 10) || 3));
    const safetyDays = Math.min(30, Math.max(0, Number.parseInt(options.safetyDays, 10) || 2));
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);

    const [products, orders] = await Promise.all([
      prisma.products.findMany({
        where: { store_id: storeNumber, stock_quantity: { not: null }, is_active: true },
        select: { id: true, name: true, stock_quantity: true, low_stock_threshold: true },
      }),
      prisma.orders.findMany({
        where: { store_id: storeNumber, created_at: { gte: since }, status: { not: 'cancelled' } },
        select: { order_items: { select: { product_id: true, quantity: true } } },
      }),
    ]);

    const soldByProduct = new Map();
    for (const order of orders) {
      for (const item of order.order_items || []) {
        soldByProduct.set(
          item.product_id,
          (soldByProduct.get(item.product_id) || 0) + (item.quantity || 0)
        );
      }
    }

    const candidates = [];
    for (const product of products) {
      const averageDailySales = (soldByProduct.get(product.id) || 0) / lookbackDays;
      const reorderPoint = Math.ceil(averageDailySales * (leadTimeDays + safetyDays));
      const targetStock = Math.ceil(averageDailySales * (leadTimeDays + safetyDays + 7));
      const suggestedQuantity = Math.max(0, targetStock - product.stock_quantity);
      if (product.stock_quantity > reorderPoint || suggestedQuantity <= 0) continue;

      const candidate = await prisma.inventory_reorder_candidates.upsert({
        where: {
          store_id_product_id_status: {
            store_id: storeNumber,
            product_id: product.id,
            status: 'pending',
          },
        },
        create: {
          store_id: storeNumber,
          product_id: product.id,
          current_quantity: product.stock_quantity,
          suggested_quantity: suggestedQuantity,
          average_daily_sales: averageDailySales,
          reorder_point: reorderPoint,
          status: 'pending',
          reason: `최근 ${lookbackDays}일 판매량 기준 자동 산출`,
        },
        update: {
          current_quantity: product.stock_quantity,
          suggested_quantity: suggestedQuantity,
          average_daily_sales: averageDailySales,
          reorder_point: reorderPoint,
          reason: `최근 ${lookbackDays}일 판매량 기준 자동 갱신`,
        },
      });
      candidates.push({ ...candidate, product });
    }
    return { candidates, parameters: { lookbackDays, leadTimeDays, safetyDays } };
  },

  async list(storeId, status = 'pending') {
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    if (!['pending', 'approved', 'rejected'].includes(status))
      throw new AppError('유효하지 않은 발주 후보 상태입니다.', 400);
    return prisma.inventory_reorder_candidates.findMany({
      where: { store_id: storeNumber, status },
      orderBy: { created_at: 'desc' },
    });
  },

  async decide(candidateId, storeId, status, userId) {
    const id = parsePositiveInt(candidateId, '발주 후보 ID');
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    if (!['approved', 'rejected'].includes(status))
      throw new AppError('유효하지 않은 결정입니다.', 400);
    const candidate = await prisma.inventory_reorder_candidates.findFirst({
      where: { id, store_id: storeNumber },
    });
    if (!candidate) throw new AppError('발주 후보를 찾을 수 없습니다.', 404);
    if (candidate.status !== 'pending') throw new AppError('이미 처리된 발주 후보입니다.', 409);
    return prisma.inventory_reorder_candidates.update({
      where: { id },
      data: { status, approved_by: userId, approved_at: new Date() },
    });
  },
};

module.exports = InventoryReorderService;
