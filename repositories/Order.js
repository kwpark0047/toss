const prisma = require('../config/prisma');
const { phoneSearchCandidates } = require('../utils/phoneEncryption');
const { kstDayRange, KST_OFFSET_MS } = require('../utils/kstTime');
const { priceOrderItem } = require('../utils/orderPricing');

/**
 * 주문 모델 (Prisma 기반)
 * 주문 생성, 상세 조회, 목록 조회 및 통계 분석을 담당합니다.
 */
const Order = {
  // [주문 생성]
  create: async (data) => {
    try {
      const {
        store_id,
        table_id,
        customer_name,
        customer_phone,
        customer_fcm_token,
        status = 'pending',
        method,
        notes,
        items,
        is_takeout = false,
      } = data;
      let order_number = data.order_number; // 아래에서 자동 생성 시 재할당

      // 주문번호 자동 생성
      if (!order_number) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const randomStr = Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, '0');
        order_number = `${dateStr}-${randomStr}`;
      }

      return await prisma.$transaction(
        async (tx) => {
          let calculatedTotal = 0;

          // 1. 주문 상품 유효성 검사
          if (!items || items.length === 0) {
            throw new Error('주문 상품이 없습니다.');
          }

          // 상품 유효성 검사: N+1 방지를 위해 모든 상품을 한 번에 조회 후 매핑
          const productIds = items.map((it) => parseInt(it.product_id));
          const fetchedProducts = await tx.products.findMany({
            where: { id: { in: productIds } },
          });
          const productById = new Map(fetchedProducts.map((p) => [String(p.id), p]));

          const validatedItems = [];
          for (const item of items) {
            const product = productById.get(String(item.product_id));

            const pricedItem = priceOrderItem(product, item, store_id);
            calculatedTotal += pricedItem.subtotal;
            validatedItems.push({
              ...pricedItem,
              options: pricedItem.options.length ? JSON.stringify(pricedItem.options) : null,
              user_phone: pricedItem.user_phone || customer_phone || null,
            });
          }

          // 쿠폰 할인도 서버가 검증한 상품 합계에만 적용한다.
          const discountAmount = Math.max(0, Number(data.discount_amount) || 0);
          const authoritativeTotal = Math.max(0, calculatedTotal - discountAmount);

          // 3. 주문 마스터 및 아이템 저장
          const order = await tx.orders.create({
            data: {
              store_id: parseInt(store_id),
              table_id: table_id ? parseInt(table_id) : null,
              order_number,
              customer_name: customer_name || null,
              customer_phone: customer_phone || null,
              customer_fcm_token: customer_fcm_token || null,
              total_amount: authoritativeTotal,
              status,
              method: method || null,
              notes: notes || null,
              is_takeout: is_takeout ? 1 : 0,
              split_type: data.split_type || 'NONE',
              is_split_payment: data.is_split_payment || false,
              split_status: data.split_status || 'PENDING',
              created_at: new Date(),
              updated_at: new Date(),
              order_items: {
                create: validatedItems,
              },
            },
            include: {
              order_items: true,
            },
          });

          if (data.user_coupon_id) {
            const couponUsed = await tx.user_coupons.updateMany({
              where: {
                id: parseInt(data.user_coupon_id),
                status: 'UNUSED',
                expires_at: { gte: new Date() },
              },
              data: { status: 'USED', used_at: new Date() },
            });
            if (couponUsed.count !== 1) {
              throw new Error('쿠폰이 이미 사용되었거나 만료되었습니다.');
            }
          }

          if (order.table_id) {
            await tx.tables.update({
              where: { id: order.table_id },
              data: { status: 'occupied', updated_at: new Date() },
            });
          }

          return order;
        },
        { timeout: 15000 }
      );
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
            take: 1,
          },
          stores: {
            select: { name: true },
          },
        },
      });

      if (!order) return null;

      const latestPayment = order.payments[0] || null;

      return {
        ...order,
        store_name: order.stores?.name,
        items: order.order_items,
        receipt_url: latestPayment?.receipt_url || null,
        actual_payment_method: latestPayment?.method || order.method,
      };
    } catch (error) {
      console.error(`[Prisma Error] findById failed for ID: ${id}`, error);
      return null;
    }
  },

  // [매장별 주문 목록 조회]
  findByStoreId: async (storeId, status = null, date = null, options = {}) => {
    try {
      const numericStoreId = parseInt(storeId);
      if (isNaN(numericStoreId)) {
        return options.paginated ? { items: [], total: 0, page: 1, limit: 20 } : [];
      }

      const where = { store_id: numericStoreId };

      if (status) {
        if (status.includes(',')) {
          where.status = { in: status.split(',').map((s) => s.trim()) };
        } else {
          where.status = status;
        }
      }

      if (date) {
        // YYYY-MM-DD(KST) → 해당 일의 UTC 범위 (공용 유틸로 통합)
        const { startOfDay, endOfDay } = kstDayRange(date);
        where.created_at = { gte: startOfDay, lte: endOfDay };
      }

      const page = Math.max(1, parseInt(options.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 20));
      const pagination = options.paginated === true;
      const queryOptions = pagination ? { skip: (page - 1) * limit, take: limit } : {};
      let orders;
      let total = null;
      try {
        const query = prisma.orders.findMany({
          ...queryOptions,
          where,
          include: {
            order_items: true,
            payments: {
              orderBy: { id: 'desc' },
              take: 1,
            },
            tables: {
              select: { table_number: true },
            },
          },
          orderBy: { created_at: 'desc' },
        });
        if (pagination) {
          [orders, total] = await Promise.all([query, prisma.orders.count({ where })]);
        } else {
          orders = await query;
        }
      } catch (innerErr) {
        console.warn(
          `[Prisma Warning] findByStoreId with include:payments failed, retrying without payments...`,
          innerErr
        );
        const fallbackQuery = prisma.orders.findMany({
          ...queryOptions,
          where,
          include: {
            order_items: true,
            tables: {
              select: { table_number: true },
            },
          },
          orderBy: { created_at: 'desc' },
        });
        if (pagination) {
          [orders, total] = await Promise.all([fallbackQuery, prisma.orders.count({ where })]);
        } else {
          orders = await fallbackQuery;
        }
      }

      const items = orders.map((order) => ({
        ...order,
        items: order.order_items || [],
        table_name: order.tables?.table_number || null,
        latest_payment: order.payments && order.payments.length > 0 ? order.payments[0] : null,
      }));
      return pagination ? { items, total, page, limit } : items;
    } catch (error) {
      console.error(`[Prisma Error] findByStoreId failed for Store: ${storeId}`, error);
      return options.paginated ? { items: [], total: 0, page: 1, limit: 20 } : [];
    }
  },

  // [고객별 주문 내역 조회]
  findByCustomer: async (phone = null, tossUserKey = null) => {
    try {
      if (!phone && !tossUserKey) return [];

      const where = { OR: [] };
      // customer_phone은 암호화 저장되므로 현행/레거시/평문 후보로 검색
      if (phone) where.OR.push({ customer_phone: { in: phoneSearchCandidates(phone) } });
      if (tossUserKey) where.OR.push({ toss_user_key: tossUserKey });

      const orders = await prisma.orders.findMany({
        where,
        include: {
          order_items: true,
          stores: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      });

      return orders.map((order) => ({
        ...order,
        store_name: order.stores?.name,
        items: order.order_items,
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
        updated_at: new Date(),
      };

      if (staff_id) data.handled_by_staff_id = parseInt(staff_id);
      if (status === 'preparing') data.preparing_at = new Date();
      if (status === 'ready') data.ready_at = new Date();
      if (status === 'completed') data.completed_at = new Date();

      return await prisma.orders.update({
        where: { id: parseInt(id) },
        data,
        include: { order_items: true },
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
        _sum: { total_amount: true },
      });

      const byStatus = await prisma.orders.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
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
        efficiency: 0, // 기본값
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
        orderBy: { created_at: 'asc' },
      });

      const dailyMap = {};
      const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0, amount: 0 }));

      orders.forEach((order) => {
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
        dayOfWeek: [],
      };
    } catch (error) {
      console.error(`[Prisma Error] getDetailedStats failed for Store: ${storeId}`, error);
      return {
        products: [],
        daily: [],
        hourly: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0, amount: 0 })),
        dayOfWeek: [],
      };
    }
  },

  /**
   * 고급 인사이트 (F3): 요일×시간 히트맵, 재구매율, 카테고리별 매출.
   * 시간/요일은 KST(UTC+9) 기준으로 산정한다.
   */
  getAdvancedInsights: async (storeId, startDate, endDate) => {
    const KST = KST_OFFSET_MS;
    const empty = {
      heatmap: [],
      repeat: { total_customers: 0, repeat_customers: 0, rate: 0 },
      categories: [],
    };
    try {
      const numericStoreId = parseInt(storeId);
      const start = new Date(startDate);
      const end = new Date(endDate);
      const where = {
        store_id: numericStoreId,
        created_at: { gte: start, lte: end },
        status: { notIn: ['cancelled'] },
      };

      const orders = await prisma.orders.findMany({
        where,
        select: { total_amount: true, created_at: true, customer_phone: true },
      });

      // 요일(0=일~6=토) × 시간(0~23) 히트맵 — KST 기준
      const matrix = Array.from({ length: 7 }, () =>
        Array.from({ length: 24 }, () => ({ count: 0, amount: 0 }))
      );
      const custCount = {}; // 재구매율: 고객(전화번호)별 주문 수
      orders.forEach((o) => {
        const kst = new Date(o.created_at.getTime() + KST);
        const day = kst.getUTCDay();
        const hour = kst.getUTCHours();
        matrix[day][hour].count += 1;
        matrix[day][hour].amount += o.total_amount || 0;
        if (o.customer_phone) custCount[o.customer_phone] = (custCount[o.customer_phone] || 0) + 1;
      });
      const heatmap = [];
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          if (matrix[d][h].count > 0) heatmap.push({ day: d, hour: h, ...matrix[d][h] });
        }
      }

      const phones = Object.keys(custCount);
      const repeatCustomers = phones.filter((p) => custCount[p] >= 2).length;
      const repeat = {
        total_customers: phones.length,
        repeat_customers: repeatCustomers,
        rate: phones.length > 0 ? Math.round((repeatCustomers / phones.length) * 1000) / 10 : 0,
      };

      // 카테고리별 매출 (order_items → products → categories)
      const items = await prisma.order_items.findMany({
        where: { orders: { is: where } },
        select: {
          subtotal: true,
          quantity: true,
          products: { select: { categories: { select: { name: true } } } },
        },
      });
      const catMap = {};
      items.forEach((it) => {
        const name = it.products?.categories?.name || '미분류';
        if (!catMap[name]) catMap[name] = { category: name, sales: 0, quantity: 0 };
        catMap[name].sales += it.subtotal || 0;
        catMap[name].quantity += it.quantity || 0;
      });
      const categories = Object.values(catMap).sort((a, b) => b.sales - a.sales);

      return { heatmap, repeat, categories };
    } catch (error) {
      console.error(`[Prisma Error] getAdvancedInsights failed for Store: ${storeId}`, error);
      return empty;
    }
  },

  // [직원 성과 분석 스텁]
  getStaffPerformance: async (_storeId, _startDate, _endDate) => {
    return {
      summary: { total_orders: 0, total_sales: 0 },
      staff_data: [],
    };
  },

  // [KDS 성능 분석 스텁]
  getKdsPerformance: async (_storeId, _startDate, _endDate) => {
    return {
      avg_cooking_time: 0,
      total_orders: 0,
      efficiency_score: 0,
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
          updated_at: new Date(),
        },
        include: { order_items: true },
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
        where: { id: parseInt(id) },
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
          where: {
            store_id: numericStoreId,
            created_at: { gte: currentStart, lte: currentEnd },
            status: { not: 'cancelled' },
          },
          _sum: { total_amount: true },
          _count: { id: true },
        }),
        prisma.orders.aggregate({
          where: {
            store_id: numericStoreId,
            created_at: { gte: previousStart, lte: previousEnd },
            status: { not: 'cancelled' },
          },
          _sum: { total_amount: true },
          _count: { id: true },
        }),
      ]);

      const curSales = current._sum.total_amount || 0;
      const preSales = previous._sum.total_amount || 0;
      const curOrders = current._count.id || 0;
      const preOrders = previous._count.id || 0;

      const salesGrowth =
        preSales === 0 ? (curSales > 0 ? 100 : 0) : ((curSales - preSales) / preSales) * 100;
      const ordersGrowth =
        preOrders === 0 ? (curOrders > 0 ? 100 : 0) : ((curOrders - preOrders) / preOrders) * 100;

      return {
        current: { sales: curSales, orders: curOrders },
        previous: { sales: preSales, orders: preOrders },
        growth: {
          sales: Math.round(salesGrowth * 10) / 10,
          orders: Math.round(ordersGrowth * 10) / 10,
        },
      };
    } catch (error) {
      console.error('[Prisma Error] getComparisonStats failed:', error);
      return {
        current: { sales: 0, orders: 0 },
        previous: { sales: 0, orders: 0 },
        growth: { sales: 0, orders: 0 },
      };
    }
  },

  // [다점포 통합 통계]
  getMultiStoreStats: async (storeIds, startDate, endDate) => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      const storeStats = await Promise.all(
        storeIds.map(async (storeId) => {
          const countIfAvailable = (delegate, args) =>
            delegate?.count ? delegate.count(args) : Promise.resolve(0);
          const since24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const [
            stats,
            storeInfo,
            customerCount,
            managedProducts,
            pendingReorders,
            activeCampaigns,
            events24h,
          ] = await Promise.all([
            prisma.orders.aggregate({
              where: {
                store_id: storeId,
                created_at: { gte: start, lte: end },
                status: { not: 'cancelled' },
              },
              _sum: { total_amount: true },
              _count: { id: true },
            }),
            prisma.stores.findUnique({
              where: { id: storeId },
              select: { name: true },
            }),
            prisma.store_customers.count({ where: { store_id: storeId } }),
            prisma.products.findMany({
              where: { store_id: storeId, stock_quantity: { not: null }, is_active: true },
              select: { stock_quantity: true, low_stock_threshold: true },
            }),
            countIfAvailable(prisma.inventory_reorder_candidates, {
              where: { store_id: storeId, status: 'pending' },
            }),
            countIfAvailable(prisma.crm_campaign_runs, {
              where: { store_id: storeId, status: { in: ['pending', 'approved'] } },
            }),
            countIfAvailable(prisma.order_events, {
              where: { store_id: storeId, created_at: { gte: since24Hours } },
            }),
          ]);
          const lowStockCount = managedProducts.filter(
            (product) => product.stock_quantity <= product.low_stock_threshold
          ).length;

          return {
            store_id: storeId,
            store_name: storeInfo?.name || '알 수 없는 매장',
            total_sales: stats._sum.total_amount || 0,
            total_orders: stats._count.id || 0,
            customer_count: customerCount,
            low_stock_count: lowStockCount,
            average_ticket: stats._count.id
              ? Math.round((stats._sum.total_amount || 0) / stats._count.id)
              : 0,
            pending_reorders: pendingReorders,
            active_campaigns: activeCampaigns,
            events_24h: events24h,
          };
        })
      );

      const totalSales = storeStats.reduce((sum, s) => sum + s.total_sales, 0);
      const totalOrders = storeStats.reduce((sum, s) => sum + s.total_orders, 0);
      const operational = storeStats.reduce(
        (summary, store) => ({
          pending_reorders: summary.pending_reorders + store.pending_reorders,
          active_campaigns: summary.active_campaigns + store.active_campaigns,
          events_24h: summary.events_24h + store.events_24h,
          low_stock_count: summary.low_stock_count + store.low_stock_count,
        }),
        { pending_reorders: 0, active_campaigns: 0, events_24h: 0, low_stock_count: 0 }
      );

      return {
        summary: {
          total_sales: totalSales,
          total_orders: totalOrders,
          store_count: storeIds.length,
          ...operational,
        },
        stores: storeStats.sort((a, b) => b.total_sales - a.total_sales),
      };
    } catch (error) {
      console.error('[Prisma Error] getMultiStoreStats failed:', error);
      return { summary: { total_sales: 0, total_orders: 0, store_count: 0 }, stores: [] };
    }
  },

  // [매출 예측]
  getForecast: async (storeId, days = 7) => {
    try {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const historicalStart = new Date(today);
      historicalStart.setDate(historicalStart.getDate() - 60);

      const orders = await prisma.orders.findMany({
        where: {
          store_id: storeId,
          created_at: { gte: historicalStart, lte: today },
          status: { not: 'cancelled' },
        },
        select: { total_amount: true, created_at: true },
        orderBy: { created_at: 'asc' },
      });

      const dailyMap = {};
      for (const order of orders) {
        const dateKey = order.created_at.toISOString().slice(0, 10);
        dailyMap[dateKey] = (dailyMap[dateKey] || 0) + Number(order.total_amount);
      }

      const dailyData = [];
      const cursor = new Date(historicalStart);
      while (cursor <= today) {
        const dateKey = cursor.toISOString().slice(0, 10);
        dailyData.push({
          date: dateKey,
          sales: dailyMap[dateKey] || 0,
          dayOfWeek: cursor.getDay(),
        });
        cursor.setDate(cursor.getDate() + 1);
      }

      if (dailyData.length === 0) {
        return { forecast: [], confidence: 0, metadata: null };
      }

      const movingAverages = dailyData.map((d, i) => {
        if (i < 6) return null;
        const slice = dailyData.slice(i - 6, i + 1);
        return slice.reduce((sum, s) => sum + s.sales, 0) / 7;
      });

      const dowGroups = [[], [], [], [], [], [], []];
      dailyData.forEach((d) => {
        if (d.sales > 0) dowGroups[d.dayOfWeek].push(d.sales);
      });
      const allSales = dailyData.map((d) => d.sales);
      const overallAvg = allSales.reduce((a, b) => a + b, 0) / allSales.length || 1;
      const dowFactors = dowGroups.map((group) => {
        if (group.length === 0) return 1;
        const avg = group.reduce((a, b) => a + b, 0) / group.length;
        return avg / overallAvg;
      });

      const residuals = [];
      const recentStart = Math.max(7, dailyData.length - 14);
      for (let i = recentStart; i < dailyData.length; i++) {
        const ma = movingAverages[i];
        if (ma !== null && ma > 0) {
          residuals.push(Math.abs(dailyData[i].sales - ma) / ma);
        }
      }
      const avgResidual =
        residuals.length > 0 ? residuals.reduce((a, b) => a + b, 0) / residuals.length : 0.3;
      const volatility = Math.min(Math.max(avgResidual, 0.1), 0.8);

      const validMA = movingAverages.filter((m) => m !== null);
      const baseMA = validMA.length > 0 ? validMA[validMA.length - 1] : 0;
      const recentTrend =
        validMA.length > 14 ? (validMA[validMA.length - 1] - validMA[validMA.length - 15]) / 14 : 0;

      const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
      const forecast = [];
      for (let i = 1; i <= days; i++) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + i);
        const dow = futureDate.getDay();
        const trendAdjusted = baseMA + recentTrend * i;
        const predicted = Math.max(0, Math.round(trendAdjusted * dowFactors[dow]));
        const interval = Math.round(predicted * volatility);
        forecast.push({
          date: futureDate.toISOString().slice(0, 10),
          dayOfWeek: DOW_LABELS[dow],
          predicted,
          lower_bound: Math.max(0, predicted - interval),
          upper_bound: predicted + interval,
        });
      }

      return {
        forecast,
        confidence: Math.max(0, Math.min(1, 1 - volatility)),
        metadata: {
          training_days: dailyData.filter((d) => d.sales > 0).length,
          total_period_days: dailyData.length,
          avg_daily_sales: Math.round(overallAvg),
          dow_factors: Object.fromEntries(
            dowFactors.map((f, i) => [DOW_LABELS[i], Math.round(f * 100) / 100])
          ),
        },
      };
    } catch (error) {
      console.error('[Prisma Error] getForecast failed:', error);
      return { forecast: [], confidence: 0, metadata: null };
    }
  },

  // [트렌딩 상품 ID 조회]
  findTrendingProducts: async (storeId, durationHours = 6, limit = 5) => {
    try {
      const thresholdTime = new Date(Date.now() - durationHours * 60 * 60 * 1000);
      const trendingData = await prisma.order_items.groupBy({
        by: ['product_id'],
        where: {
          product_id: { not: null },
          created_at: { gte: thresholdTime },
          orders: {
            store_id: parseInt(storeId),
          },
        },
        _count: { product_id: true },
        orderBy: { _count: { product_id: 'desc' } },
        take: limit,
      });
      return trendingData.map((t) => t.product_id).filter(Boolean);
    } catch (error) {
      console.error('[Prisma Error] findTrendingProducts failed:', error);
      return [];
    }
  },

  // [상품 조합 페어링 데이터 조회]
  findPairingData: async (productIds, limit = 10) => {
    try {
      const parsedProductIds = productIds.map((id) => parseInt(id));

      // 1. 해당 상품들이 포함된 주문 ID 조회
      const orderItemsWithProducts = await prisma.order_items.findMany({
        where: { product_id: { in: parsedProductIds } },
        select: { order_id: true },
      });
      const orderIds = orderItemsWithProducts.map((i) => i.order_id);

      if (orderIds.length === 0) return [];

      // 2. 그 주문들 안에서 원본 상품을 제외하고 같이 구매된 상품 집계
      const pairingData = await prisma.order_items.groupBy({
        by: ['product_id'],
        where: {
          order_id: { in: orderIds },
          product_id: { notIn: parsedProductIds },
        },
        _count: { product_id: true },
        orderBy: { _count: { product_id: 'desc' } },
        take: limit,
      });

      return pairingData;
    } catch (error) {
      console.error('[Prisma Error] findPairingData failed:', error);
      return [];
    }
  },
};

module.exports = Order;
