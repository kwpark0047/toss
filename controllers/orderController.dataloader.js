/**
 * 주문 컨트롤러 — DataLoader 적용 버전 (N+1 쿼리 해결)
 * 
 * 핵심 변경점:
 * 1. 리포지토리 직접 호출 대신 DataLoader 사용
 * 2. 배치 로딩으로 DB 라운드트립 최소화
 * 3. 요청 단위 캐시로 중복 조회 방지
 * 
 * 사용법: 기존 orderController.js 대신 이 파일 사용하거나,
 * 필요한 메서드만 가져와 적용
 */

const Order = require('../repositories/Order');
const OrderService = require('../services/OrderService');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const prisma = require('../config/prisma');
const {
  createOrderCapability,
  createCustomerHistoryCapability,
  verifyCustomerHistoryCapability,
} = require('../utils/orderCapability');
const EtaPredictionService = require('../services/EtaPredictionService');

// ===========================================
// DataLoader 인스턴스 가져오기 (요청 단위 초기화)
// ===========================================
const getLoaders = (req) => {
  // 요청별 DataLoader 캐시 초기화 (미들웨어에서 설정)
  if (!req.dataLoaders) {
    const { 
      orderLoader, 
      orderItemsLoader, 
      orderPaymentsLoader,
      storeLoader,
      productLoader,
      userLoader,
    } = require('../utils/dataLoaders');
    
    req.dataLoaders = {
      orderLoader,
      orderItemsLoader,
      orderPaymentsLoader,
      storeLoader,
      productLoader,
      userLoader,
    };
  }
  return req.dataLoaders;
};

/**
 * DataLoader 캐시 클리어 미들웨어 (요청 종료 시)
 */
const clearDataLoaderCache = (req, res, next) => {
  res.on('finish', () => {
    if (req.dataLoaders) {
      Object.values(req.dataLoaders).forEach(loader => {
        if (loader && typeof loader.clearAll === 'function') {
          loader.clearAll();
        }
      });
    }
  });
  next();
};

const orderControllerDataLoader = {
  // 미들웨어: DataLoader 캐시 초기화 + 정리
  initializeDataLoaders: (req, res, next) => {
    getLoaders(req);
    clearDataLoaderCache(req, res, next);
  },

  // 주문 생성 (기존과 동일 — DataLoader 불필요)
  createOrder: catchAsync(async (req, res) => {
    const orderService = new OrderService(req.app.get('io'));
    const order = await orderService.createOrder(req.body);
    const customerHistoryCapability = createCustomerHistoryCapability({
      phone: req.body.phone || req.body.customer_phone,
      toss_user_key: req.body.toss_user_key,
    });
    res.created(
      {
        ...order,
        order_capability: createOrderCapability(order),
        customer_history_capability: customerHistoryCapability,
      },
      '주문이 생성되었습니다.'
    );
  }),

  // 고객별 주문 내역 조회 — DataLoader로 배치 로딩
  getCustomerHistory: catchAsync(async (req, res) => {
    const capability = verifyCustomerHistoryCapability(req.get('x-customer-history-capability'));
    if (!capability) {
      return res.status(403).json({ error: '고객 주문내역 조회 권한이 없거나 만료되었습니다.' });
    }
    
    // DataLoader 사용: 동일 요청 내 중복 조회 방지
    const { orderLoader } = getLoaders(req);
    
    // Repository에서 전화번호/토스키로 주문 ID 리스트 조회 후 DataLoader로 상세 로드
    const orderIds = await Order.findIdsByCustomer(capability.phone, capability.toss_user_key);
    const orders = await orderLoader.loadMany(orderIds);
    
    // null 필터링 (존재하지 않는 ID)
    const validOrders = orders.filter(o => o !== null);
    res.success(validOrders);
  }),

  // 매장별 주문 목록 조회 — DataLoader로 아이템/결제 일괄 로드
  getStoreOrders: catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { status, date } = req.query;
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    
    // 기본 주문 리스트 조회 (Repository)
    const result = await Order.findByStoreId(storeId, status, date, {
      page: req.query.page,
      limit: req.query.limit,
      paginated: hasPagination,
    });
    
    const orders = hasPagination ? result.items : result;
    
    // DataLoader로 연관 데이터 배치 로드 (N+1 방지)
    if (orders.length > 0) {
      const { orderItemsLoader, orderPaymentsLoader } = getLoaders(req);
      
      const orderIds = orders.map(o => String(o.id));
      
      // 병렬로 아이템 + 결제 로드
      const [itemsMap, paymentsMap] = await Promise.all([
        orderItemsLoader.loadMany(orderIds),
        orderPaymentsLoader.loadMany(orderIds),
      ]);
      
      // 주문 객체에 연관 데이터 합치기
      orders.forEach((order, idx) => {
        order.items = itemsMap[idx] || [];
        order.payments = paymentsMap[idx] || [];
      });
    }
    
    if (hasPagination) {
      return res.paginated(orders, result, '주문 목록을 조회했습니다.');
    }
    res.success(orders);
  }),

  // 주문 단일 상세 조회 — DataLoader로 아이템/결제/매장 일괄 로드
  getOrderDetails: catchAsync(async (req, res) => {
    const { orderLoader, orderItemsLoader, orderPaymentsLoader, storeLoader, productLoader } = getLoaders(req);
    
    const orderId = String(req.params.id);
    
    // 주문 기본 정보 + 연관 데이터 병렬 로드
    const [order, items, payments] = await Promise.all([
      orderLoader.load(orderId),
      orderItemsLoader.load(orderId),
      orderPaymentsLoader.load(orderId),
    ]);
    
    if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다' });
    
    // 매장/상품 정보도 필요시 로드
    if (order.store_id) {
      order.store = await storeLoader.load(String(order.store_id));
    }
    
    // 아이템별 상품 정보 로드
    if (items.length > 0) {
      const productIds = [...new Set(items.map(i => String(i.product_id)))];
      const products = await productLoader.loadMany(productIds);
      const productMap = new Map(products.map((p, i) => [productIds[i], p]));
      
      items.forEach(item => {
        item.product = productMap.get(String(item.product_id)) || null;
      });
    }
    
    order.items = items;
    order.payments = payments;
    
    res.success(order);
  }),

  // 주문 상태 업데이트
  updateStatus: catchAsync(async (req, res) => {
    const orderService = new OrderService(req.app.get('io'));
    const { status, staff_id } = req.body;
    const updated = await orderService.updateStatus(req.params.id, status, staff_id, {
      userId: req.user?.id,
      role: req.user?.role,
    });
    
    // DataLoader 캐시 무효화
    const { orderLoader } = getLoaders(req);
    orderLoader.clear(String(req.params.id));
    
    res.json({ success: true, order: updated, message: '주문 상태가 변경되었습니다' });
  }),

  // 주문 취소
  cancelOrder: catchAsync(async (req, res) => {
    const orderService = new OrderService(req.app.get('io'));
    const result = await orderService.cancelOrder(req.params.id, req.user?.id, req.user?.role);
    
    // DataLoader 캐시 무효화
    const { orderLoader, orderItemsLoader, orderPaymentsLoader } = getLoaders(req);
    const orderId = String(req.params.id);
    orderLoader.clear(orderId);
    orderItemsLoader.clear(orderId);
    orderPaymentsLoader.clear(orderId);
    
    res.json(result);
  }),

  // 주문 삭제
  deleteOrder: catchAsync(async (req, res) => {
    const orderId = parseInt(req.params.id);
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('주문을 찾을 수 없습니다.', 404);
    if (order.status !== 'cancelled')
      throw new AppError('취소된 주문만 삭제할 수 있습니다. 활성 주문은 먼저 취소해 주세요.', 400);
    await Order.delete(orderId);
    
    // DataLoader 캐시 무효화
    const { orderLoader, orderItemsLoader, orderPaymentsLoader } = getLoaders(req);
    const orderIdStr = String(orderId);
    orderLoader.clear(orderIdStr);
    orderItemsLoader.clear(orderIdStr);
    orderPaymentsLoader.clear(orderIdStr);
    
    res.success(null, '주문이 삭제되었습니다.');
  }),

  // ETA 조회
  getEta: catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { items } = req.query;
    let parsedItems = [];
    try {
      parsedItems = items ? JSON.parse(items) : [];
    } catch {
      parsedItems = [];
    }

    const etaService = new EtaPredictionService();
    const eta = await etaService.calculateEta(storeId, parsedItems);
    res.success(eta);
  }),

  // 통계 조회
  getStats: catchAsync(async (req, res) => {
    const { start_date, end_date } = req.query;
    const stats = await Order.getStats(req.params.storeId, start_date, end_date);
    res.success(stats);
  }),

  // 상세 통계 조회
  getDetailedStats: catchAsync(async (req, res) => {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
    }
    const stats = await Order.getDetailedStats(req.params.storeId, start_date, end_date);
    res.success(stats);
  }),

  // 고객 FCM 토큰 등록
  registerCustomerToken: catchAsync(async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const { token } = req.body;

    if (isNaN(orderId)) {
      return res
        .status(400)
        .json({ error: 'invalid_request', message: '올바르지 않은 주문 ID 형식입니다.' });
    }
    if (!token) {
      return res
        .status(400)
        .json({ error: 'invalid_request', message: 'FCM 토큰이 제공되지 않았습니다.' });
    }

    // DataLoader로 주문 조회 (캐시 활용)
    const { orderLoader } = getLoaders(req);
    const order = await orderLoader.load(String(orderId));
    
    if (!order) {
      return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
    }

    // 1. 주문 모델 내 customer_fcm_token 갱신
    const updated = await prisma.orders.update({
      where: { id: orderId },
      data: { customer_fcm_token: token },
    });

    // 2. 해당 주문에 연결된 고객 전화번호가 존재한다면, 단골고객 테이블도 자동 갱신
    if (order.customer_phone) {
      await prisma.store_customers.updateMany({
        where: {
          store_id: order.store_id,
          customer_phone: order.customer_phone,
        },
        data: { fcm_token: token },
      });
      logger.info(`[FCM Token] Synced customer PWA push token: Store ${order.store_id}`);
    }

    // DataLoader 캐시 무효화
    orderLoader.clear(String(orderId));

    res.json({
      success: true,
      message: '고객용 실시간 웹 푸시 온보딩 토큰이 성공적으로 등록되었습니다.',
    });
  }),
};

module.exports = {
  orderControllerDataLoader,
  getLoaders,
  clearDataLoaderCache,
};