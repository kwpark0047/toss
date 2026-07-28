// [수정] 모듈마다 new PrismaClient() 를 만들면 커넥션 풀이 중복 생성되어
// 서버리스/컨테이너 환경에서 DB 연결 수가 폭증한다. 공유 싱글턴을 사용한다.
const prisma = require('../../../config/prisma');

class PaymentRepository {
  async findById(id) {
    return await prisma.payments.findUnique({
      where: { id },
    });
  }

  async findByOrderId(orderId) {
    return await prisma.payments.findFirst({
      where: { order_id: orderId },
    });
  }

  async findByStoreId(storeId, options = {}) {
    const { status, start_date, end_date, page = 1, limit = 20 } = options;
    const where = { store_id: storeId };

    if (status) where.status = status;
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at.gte = new Date(start_date);
      if (end_date) where.created_at.lte = new Date(end_date);
    }

    const [items, total] = await Promise.all([
      prisma.payments.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.payments.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(paymentData) {
    return await prisma.payments.create({
      data: paymentData,
    });
  }

  async update(id, paymentData) {
    return await prisma.payments.update({
      where: { id },
      data: paymentData,
    });
  }

  async updateStatus(id, status) {
    return await prisma.payments.update({
      where: { id },
      data: { status, updated_at: new Date() },
    });
  }

  async getStats(storeId, startDate, endDate) {
    const where = { store_id: storeId, status: 'approved' };
    if (startDate || endDate) {
      where.paid_at = {};
      if (startDate) where.paid_at.gte = new Date(startDate);
      if (endDate) where.paid_at.lte = new Date(endDate);
    }

    const [total, sum] = await Promise.all([
      prisma.payments.count({ where }),
      prisma.payments.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return { count: total, total_amount: sum._sum.amount || 0 };
  }
}

module.exports = new PaymentRepository();
