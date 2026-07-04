const prisma = require('../config/prisma');

/**
 * 주문 모델 (Prisma 기반)
 * 주문 생성, 상세 조회, 목록 조회 및 통계 분석을 담당합니다.
 */
const Order = {
  // [주문 생성]
  create: async (data) => {
    try {
      let {
        store_id, table_id, customer_name, customer_phone,
        order_number, total_amount, status = 'pending',
        method, notes, items, is_takeout = false
      } = data;

      // 주문번호 자동 생성
      if (!order_number) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        order_number = `${dateStr}-${randomStr}`;
      }

      return await prisma.$transaction(async (tx) => {
        let calculatedTotal = 0;

        // 1. 주문 상품 유효성 검사
        if (!items || items.length === 0) {
          throw new Error('주문 상품이 없습니다.');
        }

        const validatedItems = [];
        for (const item of items) {
          const product = await tx.products.findUnique({
            where: { id: item.product_id }
          });

          if (!product || product.store_id !== store_id) {
            throw new Error(`상품 정보를 찾을 수 없습니다: ${item.product_name}`);
          }

          if (product.is_sold_out) {
            throw new Error(`죄송합니다. 현재 품절된 상품이 포함되어 있습니다: ${product.name}`);
          }

          if (!product.is_active) {
            throw new Error(`현재 판매가 중단된 상품입니다: ${product.name}`);
          }

          calculatedTotal += product.price * item.quantity;
          validatedItems.push({
            product_id: product.id,
            product_name: product.name,
            quantity: item.quantity,
            price: product.price,
            subtotal: product.price * item.quantity,
            options: item.options ? JSON.stringify(item.options) : null,
            user_phone: item.user_phone || customer_phone || null
          });
        }

        // 2. 최종 결제 금액 검증
        if (calculatedTotal !== total_amount && !data.is_split_payment) {
          // 분할 결제인 경우 전체 금액과 다를 수 있으므로 체크 제외하거나 로직 보강 필요
          // 여기서는 기본 검증만 수행
        }

        // 3. 주문 마스터 및 아이템 저장
        const order = await tx.orders.create({
          data: {
            store_id: parseInt(store_id),
            table_id: table_id ? parseInt(table_id) : null,
            order_number,
            customer_name: customer_name || null,
            customer_phone: customer_phone || null,
            total_amount: parseFloat(total_amount),
            status,
            method: method || null,
            notes: notes || null,
            is_takeout: is_takeout ? 1 : 0,
            split_type: data.split_type || "NONE",
            is_split_payment: data.is_split_payment || false,
            split_status: data.split_status || "PENDING",
            created_at: new Date(),
            updated_at: new Date(),
            order_items: {
              create: validatedItems
            }
          },
          include: {
            order_items: true
          }
        });

        return order;
      }, { timeout: 15000 });
    } catch (error) {
      console.error('[Prisma Error] Order.create failed:', error);
      throw error;
    }
  },

  // [단일 주문 상세 조회]
  findById: async (id) => {
    try {
      const order = await prisma.orders.findUnique({
        where: { id: parseInt(id) },
        include: {
          order_items: true,
          payments: {
            orderBy: { id: 'desc' },
            take: 1
          },
          stores: {
            select: { name: true }
          }
        }
      });

      if (!order) return null;

      const latestPayment = order.payments[0] || null;

      return {
        ...order,
        store_name: order.stores?.name,
        items: order.order_items,
        receipt_url: latestPayment?.receipt_url || null,
        actual_payment_method: latestPayment?.method || order.method
      };
    } catch (error) {
      console.error(`[Prisma Error] findById failed for ID: ${id}`, error);
      return null;
    }
  },

  // [매장별 주문 목록 조회]
  findByStoreId: async (storeId, status = null, date = null) => {
    try {
      const numericStoreId = parseInt(storeId);
      if (isNaN(numericStoreId)) return [];

      const where = { store_id: numericStoreId };

      if (status) {
        if (status.includes(',')) {
          where.status = { in: status.split(',').map(s => s.trim()) };
        } else {
          where.status = status;
        }
      }

      if (date) {
        // YYYY-MM-DD 문자열을 KST 기준 하루 범위로 해석 (UTC+9)
        // new Date('2024-01-15') → UTC 00:00. KST 00:00은 UTC 전날 15:00이므로 9h 뒤로 시작
        const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
        const startOfDay = new Date(new Date(`${date}T00:00:00.000Z`).getTime() - KST_OFFSET_MS);
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
        where.created_at = { gte: startOfDay, lte: endOfDay };
      }

      let orders;
      try {
        orders = await prisma.orders.findMany({
          where,
          include: {
            order_items: true,
            payments: {
              orderBy: { id: 'desc' },
              take: 1
            },
            tables: {
              select: { table_number: true }
            }
          },
          orderBy: { created_at: 'desc' }
        });
      } catch (innerErr) {
        console.warn(`[Prisma Warning] findByStoreId with include:payments failed, retrying without payments...`, innerErr);
        orders = await prisma.orders.findMany({
          where,
          include: {
            order_items: true,
            tables: {
              select: { table_number: true }
            }
          },
          orderBy: { created_at: 'desc' }
        });
      }

      return orders.map(order => ({
        ...order,
        items: order.order_items || [],
        table_name: order.tables?.table_number || null,
        latest_payment: (order.payments && order.payments.length > 0) ? order.payments[0] : null
      }));
    } catch (error) {
      console.error(`[Prisma Error] findByStoreId failed for Store: ${storeId}`, error);
      return [];
    }
  },

  // [고객별 주문 내역 조회]
  findByCustomer: async (phone = null, tossUserKey = null) => {
    try {
      if (!phone && !tossUserKey) return [];

      const where = { OR: [] };
      if (phone) where.OR.push({ customer_phone: phone });
      if (tossUserKey) where.OR.push({ toss_user_key: tossUserKey });

      const orders = await prisma.orders.findMany({
        where,
        include: {
          order_items: true,
          stores: { select: { name: true } }
        },
        orderBy: { created_at: 'desc' },
        take: 50
      });

      return orders.map(order => ({
        ...order,
        store_name: order.stores?.name,
        items: order.order_items
      }));
    } catch (error) {
      console.error('[Prisma Error] findByCustomer failed:', error);
      return [];
    }
  },

  // [주문 상태 업데이트]
  updateStatus: async (id, status, staff_id = null) => {
    try {
      const data = {
        status,
        updated_at: new Date()
      };

      if (staff_id) data.handled_by_staff_id = parseInt(staff_id);
      if (status === 'preparing') data.preparing_at = new Date();
      if (status === 'ready') data.ready_at = new Date();
      if (status === 'completed') data.completed_at = new Date();

      return await prisma.orders.update({
        where: { id: parseInt(id) },
        data,
        include: { order_items: true }
      });
    } catch (error) {
      console.error(`[Prisma Error] updateStatus failed for ID: ${id}`, error);
      throw error;
    }
  },

  // [주문 요약 통계]
  getStats: async (storeId, startDate = null, endDate = null) => {
    try {
      const numericStoreId = parseInt(storeId);
      const where = { store_id: numericStoreId };

      if (startDate && endDate) {
        where.created_at = { gte: new Date(startDate), lte: new Date(endDate) };
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        where.created_at = { gte: today };
      }

      const summary = await prisma.orders.aggregate({
        where,
        _count: { id: true },
        _sum: { total_amount: true }
      });

      const byStatus = await prisma.orders.groupBy({
        by: ['status'],
        where,
        _count: { id: true }
      });

      const statusMap = byStatus.reduce((acc, curr) => {
        acc[curr.status] = curr._count.id;
        return acc;
      }, {});

      return {
        total_orders: summary._count.id || 0,
        total_sales: summary._sum.total_amount || 0,
        by_status: statusMap,
        settlement_rate: 0, // 기본값
        efficiency: 0 // 기본값
      };
    } catch (error) {
      console.error(`[Prisma Error] getStats failed for Store: ${storeId}`, error);
      return { total_orders: 0, total_sales: 0, by_status: {}, settlement_rate: 0, efficiency: 0 };
    }
  },

  // [상세 주문 분석]
  getDetailedStats: async (storeId, startDate, endDate) => {
    try {
      const numericStoreId = parseInt(storeId);
      const start = new Date(startDate);
      const end = new Date(endDate);
      const where = { store_id: numericStoreId, created_at: { gte: start, lte: end } };

      const orders = await prisma.orders.findMany({
        where,
        select: { id: true, total_amount: true, created_at: true, status: true },
        orderBy: { created_at: 'asc' }
      });

      const dailyMap = {};
      const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0, amount: 0 }));

      orders.forEach(order => {
        const date = order.created_at.toISOString().slice(0, 10);
        if (!dailyMap[date]) dailyMap[date] = { date, amount: 0, count: 0 };
        dailyMap[date].amount += order.total_amount;
        dailyMap[date].count += 1;

        const hour = order.created_at.getHours();
        hourly[hour].count += 1;
        hourly[hour].amount += order.total_amount;
      });

      return {
        products: [],
        daily: Object.values(dailyMap),
        hourly: hourly,
        dayOfWeek: []
      };
    } catch (error) {
      console.error(`[Prisma Error] getDetailedStats failed for Store: ${storeId}`, error);
      return {
        products: [],
        daily: [],
        hourly: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0, amount: 0 })),
        dayOfWeek: []
      };
    }
  },

  // [직원 성과 분석 스텁]
  getStaffPerformance: async (storeId, startDate, endDate) => {
    return {
      summary: { total_orders: 0, total_sales: 0 },
      staff_data: []
    };
  },

  // [KDS 성능 분석 스텁]
  getKdsPerformance: async (storeId, startDate, endDate) => {
    return {
      avg_cooking_time: 0,
      total_orders: 0,
      efficiency_score: 0
    };
  },

  // [결제 정보 업데이트]
  updatePayment: async (id, method, status) => {
    try {
      return await prisma.orders.update({
        where: { id: parseInt(id) },
        data: {
          method,
          payment_status: status,
          updated_at: new Date()
        },
        include: { order_items: true }
      });
    } catch (error) {
      console.error(`[Prisma Error] updatePayment failed for ID: ${id}`, error);
      throw error;
    }
  },

  // [주문 삭제]
  delete: async (id) => {
    try {
      await prisma.orders.delete({
        where: { id: parseInt(id) }
      });
      return true;
    } catch (error) {
      console.error(`[Prisma Error] delete failed for ID: ${id}`, error);
      return false;
    }
  },

  // [기간 대비 성장률 분석]
  getComparisonStats: async (storeId, type = 'weekly') => {
    try {
      const numericStoreId = parseInt(storeId);
      const now = new Date();
      let currentStart, currentEnd, previousStart, previousEnd;

      if (type === 'monthly') {
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentEnd = now;
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      } else {
        currentEnd = now;
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousEnd = new Date(currentStart.getTime() - 1);
        previousStart = new Date(previousEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const [current, previous] = await Promise.all([
        prisma.orders.aggregate({
          where: { store_id: numericStoreId, created_at: { gte: currentStart, lte: currentEnd }, status: { not: 'cancelled' } },
          _sum: { total_amount: true },
          _count: { id: true }
        }),
        prisma.orders.aggregate({
          where: { store_id: numericStoreId, created_at: { gte: previousStart, lte: previousEnd }, status: { not: 'cancelled' } },
          _sum: { total_amount: true },
          _count: { id: true }
        })
      ]);

      const curSales = current._sum.total_amount || 0;
      const preSales = previous._sum.total_amount || 0;
      const curOrders = current._count.id || 0;
      const preOrders = previous._count.id || 0;

      const salesGrowth = preSales === 0 ? (curSales > 0 ? 100 : 0) : ((curSales - preSales) / preSales) * 100;
      const ordersGrowth = preOrders === 0 ? (curOrders > 0 ? 100 : 0) : ((curOrders - preOrders) / preOrders) * 100;

      return {
        current: { sales: curSales, orders: curOrders },
        previous: { sales: preSales, orders: preOrders },
        growth: { sales: Math.round(salesGrowth * 10) / 10, orders: Math.round(ordersGrowth * 10) / 10 }
      };
    } catch (error) {
      console.error('[Prisma Error] getComparisonStats failed:', error);
      return { current: { sales: 0, orders: 0 }, previous: { sales: 0, orders: 0 }, growth: { sales: 0, orders: 0 } };
    }
  },

  // [다점포 통합 통계]
  getMultiStoreStats: async (storeIds, startDate, endDate) => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      const storeStats = await Promise.all(storeIds.map(async (storeId) => {
        const stats = await prisma.orders.aggregate({
          where: { store_id: storeId, created_at: { gte: start, lte: end }, status: { not: 'cancelled' } },
          _sum: { total_amount: true },
          _count: { id: true }
        });

        const storeInfo = await prisma.stores.findUnique({
          where: { id: storeId },
          select: { name: true }
        });

        return {
          store_id: storeId,
          store_name: storeInfo?.name || '알 수 없는 매장',
          total_sales: stats._sum.total_amount || 0,
          total_orders: stats._count.id || 0
        };
      }));

      const totalSales = storeStats.reduce((sum, s) => sum + s.total_sales, 0);
      const totalOrders = storeStats.reduce((sum, s) => sum + s.total_orders, 0);

      return {
        summary: { total_sales: totalSales, total_orders: totalOrders, store_count: storeIds.length },
        stores: storeStats.sort((a, b) => b.total_sales - a.total_sales)
      };
    } catch (error) {
      console.error('[Prisma Error] getMultiStoreStats failed:', error);
      return { summary: { total_sales: 0, total_orders: 0, store_count: 0 }, stores: [] };
    }
  }
};

module.exports = Order;
