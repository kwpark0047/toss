const prisma = require('../../../config/prisma');
const IOrderRepository = require('../../domain/interfaces/IOrderRepository');

class OrderRepository extends IOrderRepository {
  async findById(id) {
    return await prisma.orders.findUnique({
      where: { id },
      include: { order_items: true }
    });
  }

  async findByOrderNumber(orderNumber) {
    return await prisma.orders.findFirst({
      where: { order_number: orderNumber },
      include: { order_items: true }
    });
  }

  async findByStoreId(storeId, options = {}) {
    const { status, page = 1, limit = 50, start_date, end_date } = options;
    const where = { store_id: storeId };

    if (status) where.status = status;
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at.gte = new Date(start_date);
      if (end_date) where.created_at.lte = new Date(end_date);
    }

    const [orders, total] = await Promise.all([
      prisma.orders.findMany({
        where,
        include: { order_items: true },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.orders.count({ where })
    ]);

    return { orders, total, page, limit };
  }

  async create(orderData) {
    const { items, ...orderFields } = orderData;

    return await prisma.orders.create({
      data: {
        ...orderFields,
        order_items: {
          create: items
        }
      },
      include: { order_items: true }
    });
  }

  async update(id, orderData) {
    return await prisma.orders.update({
      where: { id },
      data: orderData,
      include: { order_items: true }
    });
  }

  async updateStatus(id, status) {
    return await prisma.orders.update({
      where: { id },
      data: {
        status,
        updated_at: new Date(),
        completed_at: status === 'completed' ? new Date() : undefined
      }
    });
  }

  async getStats(storeId, startDate, endDate) {
    const where = {
      store_id: storeId,
      status: 'completed'
    };

    if (startDate && endDate) {
      where.completed_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const aggregate = await prisma.orders.aggregate({
      where,
      _count: true,
      _sum: { total_amount: true },
      _avg: { total_amount: true }
    });

    return {
      total_count: aggregate._count,
      total_amount: aggregate._sum.total_amount || 0,
      average_amount: aggregate._avg.total_amount || 0
    };
  }
}

module.exports = OrderRepository;
