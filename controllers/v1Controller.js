const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const { decryptPhone } = require('../utils/phoneEncryption');
const { kstDayRange } = require('../utils/kstTime');
const OrderRepository = require('../repositories/Order');
const { emitEvent } = require('../services/webhookDispatcher');

// 개인정보 마스킹 유틸리티 (Open API 전용)
const maskPhone = (enc) => {
  const p = decryptPhone(enc) || '';
  const d = p.replace(/\D/g, '');
  if (d.length < 8) return null;
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
};

/**
 * WeMarket Open API v1 컨트롤러
 * 외부 개발자 및 온프레미스 인쇄 교량과의 상호작용 비즈니스 로직을 격리 처리합니다.
 */
const v1Controller = {
  /**
   * [GET] API 키 소유 매장 정보 조회
   */
  getStore: catchAsync(async (req, res) => {
    const storeId = req.apiClient.storeId;
    const store = await prisma.stores.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        phone: true,
        open_time: true,
        close_time: true,
        business_type: true,
      },
    });

    if (!store) {
      return res.status(404).json({ error: 'not_found', message: '매장 정보를 찾을 수 없습니다.' });
    }

    res.json({ data: store });
  }),

  /**
   * [GET] 해당 매장의 메뉴 목록 조회
   */
  getMenus: catchAsync(async (req, res) => {
    const storeId = req.apiClient.storeId;
    const products = await prisma.products.findMany({
      where: { store_id: storeId },
      select: {
        id: true,
        name: true,
        price: true,
        description: true,
        image_url: true,
        category_id: true,
        is_sold_out: true,
        is_popular: true,
        is_new: true,
      },
      orderBy: { id: 'asc' },
    });

    res.json({ data: products, meta: { count: products.length } });
  }),

  /**
   * [GET] 매장 주문 목록 조회 (상태, 날짜별 필터 가능)
   */
  getOrders: catchAsync(async (req, res) => {
    const storeId = req.apiClient.storeId;
    const { status, date, limit = 50 } = req.query;

    const where = { store_id: storeId };

    if (status) {
      where.status = status.includes(',') ? { in: status.split(',').map((s) => s.trim()) } : status;
    }

    if (date) {
      const { startOfDay, endOfDay } = kstDayRange(date);
      where.created_at = { gte: startOfDay, lte: endOfDay };
    }

    const orders = await prisma.orders.findMany({
      where,
      include: { order_items: true },
      orderBy: { created_at: 'desc' },
      take: Math.min(parseInt(limit) || 50, 200),
    });

    const formattedOrders = orders.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      total_amount: o.total_amount,
      table_id: o.table_id,
      customer_phone: maskPhone(o.customer_phone),
      created_at: o.created_at,
      items: (o.order_items || []).map((i) => ({
        name: i.product_name,
        quantity: i.quantity,
        price: i.price,
      })),
    }));

    res.json({ data: formattedOrders, meta: { count: formattedOrders.length } });
  }),

  /**
   * [GET] 주문 ID 단일 상세 조회
   */
  getOrderById: catchAsync(async (req, res) => {
    const storeId = req.apiClient.storeId;
    const orderId = parseInt(req.params.id);

    if (isNaN(orderId)) {
      return res
        .status(400)
        .json({ error: 'invalid_request', message: '올바르지 않은 주문 ID 형식입니다.' });
    }

    const order = await prisma.orders.findFirst({
      where: { id: orderId, store_id: storeId },
      include: { order_items: true },
    });

    if (!order) {
      return res.status(404).json({ error: 'not_found', message: '주문을 찾을 수 없습니다.' });
    }

    res.json({
      data: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total_amount: order.total_amount,
        table_id: order.table_id,
        customer_phone: maskPhone(order.customer_phone),
        created_at: order.created_at,
        items: (order.order_items || []).map((i) => ({
          name: i.product_name,
          quantity: i.quantity,
          price: i.price,
        })),
      },
    });
  }),

  /**
   * [POST] 외부 주문 생성 및 웹훅 발송 (Write Scope 필요)
   */
  createOrder: catchAsync(async (req, res) => {
    const storeId = req.apiClient.storeId;
    const { items, table_id, customer_phone, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: 'invalid_request', message: 'items 배열이 필요합니다.' });
    }
    if (items.some((i) => !i.product_id)) {
      return res
        .status(400)
        .json({
          error: 'invalid_request',
          message: '각 item에 매장 메뉴의 product_id가 필요합니다. GET /v1/menus로 조회하세요.',
        });
    }

    // 서버가 DB 가격으로 총액 재검증
    const productIds = [...new Set(items.map((i) => Number(i.product_id)))];
    const products = await prisma.products.findMany({
      where: { id: { in: productIds }, store_id: storeId },
      select: { id: true, price: true },
    });

    const priceMap = Object.fromEntries(products.map((p) => [p.id, p.price]));
    const invalid = productIds.filter((id) => !(id in priceMap));
    if (invalid.length) {
      return res
        .status(400)
        .json({
          error: 'invalid_request',
          message: `이 매장에 존재하지 않는 product_id: ${invalid.join(', ')}`,
        });
    }

    const total = items.reduce(
      (s, i) => s + (priceMap[Number(i.product_id)] || 0) * (Number(i.quantity) || 1),
      0
    );

    const order = await OrderRepository.create({
      store_id: storeId,
      table_id: table_id || null,
      customer_phone: customer_phone || null,
      method: 'external',
      notes: notes || 'Open API 주문',
      total_amount: total,
      status: 'pending',
      items: items.map((i) => ({
        product_id: Number(i.product_id),
        quantity: Number(i.quantity) || 1,
        options: i.options || null,
      })),
    });

    // 비동기 웹훅 비즈니스 피드백 이벤트 방출
    emitEvent(storeId, 'order.created', {
      order_id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      source: 'open_api',
    });

    res.created({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      total_amount: order.total_amount,
    });
  }),

  /**
   * [GET] 기간 매출 통계 분석 요약
   */
  getAnalyticsSummary: catchAsync(async (req, res) => {
    const storeId = req.apiClient.storeId;
    const { date } = req.query;

    const where = { store_id: storeId, status: { notIn: ['cancelled'] } };

    if (date) {
      const { startOfDay, endOfDay } = kstDayRange(date);
      where.created_at = { gte: startOfDay, lte: endOfDay };
    }

    const orders = await prisma.orders.findMany({
      where,
      select: { total_amount: true },
    });

    const revenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);

    res.json({
      data: {
        order_count: orders.length,
        revenue,
        avg_order_value: orders.length ? Math.round(revenue / orders.length) : 0,
        period: date || 'all_time',
      },
    });
  }),

  /**
   * [POST] 주방 프린트 잡 원자적 점유 처리 (FOR UPDATE SKIP LOCKED 우회 스펙)
   */
  claimPrintJobs: catchAsync(async (req, res) => {
    const storeId = req.apiClient.storeId;
    const max = Math.min(parseInt(req.body?.max) || 5, 20);

    // PostgreSQL 원자적 SELECT FOR UPDATE SKIP LOCKED 쿼리를 트랜잭션 Safe하게 수행
    const claimed = await prisma.$queryRawUnsafe(
      `UPDATE print_jobs SET status='printing', claimed_at=NOW(), attempts=attempts+1
             WHERE id IN (
               SELECT id FROM print_jobs WHERE store_id=$1 AND status='pending'
               ORDER BY created_at ASC LIMIT $2 FOR UPDATE SKIP LOCKED
             ) RETURNING id, order_id, kind, payload_b64, attempts`,
      storeId,
      max
    );

    res.json({ data: claimed, meta: { count: claimed.length } });
  }),

  /**
   * [POST] 인쇄 작업 성공 피드백 완료 수신 처리
   */
  ackPrintJob: catchAsync(async (req, res) => {
    const storeId = req.apiClient.storeId;
    const { success, error } = req.body || {};
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res
        .status(400)
        .json({ error: 'invalid_request', message: '올바르지 않은 프린트 잡 ID 형식입니다.' });
    }

    if (success) {
      await prisma.$executeRawUnsafe(
        `UPDATE print_jobs SET status='done', printed_at=NOW(), error=NULL WHERE id=$1 AND store_id=$2`,
        id,
        storeId
      );
    } else {
      // 3회 실패 전까지는 대기열(pending) 복귀, 이상이면 최종 실패('failed') 처리
      const rows = await prisma.$queryRawUnsafe(
        `SELECT attempts FROM print_jobs WHERE id=$1 AND store_id=$2`,
        id,
        storeId
      );
      const status = (rows[0]?.attempts || 0) >= 3 ? 'failed' : 'pending';

      await prisma.$executeRawUnsafe(
        `UPDATE print_jobs SET status=$1, error=$2 WHERE id=$3 AND store_id=$4`,
        status,
        String(error || '').slice(0, 300),
        id,
        storeId
      );
    }

    res.json({ data: { id, ok: true } });
  }),
};

module.exports = v1Controller;
