/**
 * DataLoader 구현 — N+1 쿼리 문제 해결
 * GraphQL/REST 모두에서 배치 로딩으로 DB 라운드트립 최소화
 * 사용법: const userLoader = require('./utils/dataLoaders').userLoader;
 *        const user = await userLoader.load(userId);
 */

const DataLoader = require('dataloader');
const db = require('../config/prisma');

/**
 * 배치 로더 팩토리
 * @param {Function} batchFn - (keys: string[]) => Promise<Map<key, value>>
 * @param {Object} options - DataLoader 옵션
 */
const createLoader = (batchFn, options = {}) => {
  return new DataLoader(batchFn, {
    cacheKeyFn: key => key,
    maxBatchSize: options.maxBatchSize || 100,
    cacheMap: options.cacheMap || new Map(),
    ...options,
  });
};

// ===========================================
// User Loaders
// ===========================================

/**
 * 사용자 배치 조회
 */
const userLoader = createLoader(async (userIds) => {
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
  });
  const userMap = new Map(users.map(u => [String(u.id), u]));
  return userIds.map(id => userMap.get(String(id)) || null);
}, { maxBatchSize: 100 });

/**
 * 사용자 + 매장 관계 배치 조회
 */
const userWithStoresLoader = createLoader(async (userIds) => {
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    include: {
      stores: {
        where: { isActive: true },
        select: { id: true, name: true, role: true },
      },
    },
  });
  const userMap = new Map(users.map(u => [String(u.id), u]));
  return userIds.map(id => userMap.get(String(id)) || null);
});

// ===========================================
// Store Loaders
// ===========================================

/**
 * 매장 배치 조회
 */
const storeLoader = createLoader(async (storeIds) => {
  const stores = await db.store.findMany({
    where: { id: { in: storeIds } },
  });
  const storeMap = new Map(stores.map(s => [String(s.id), s]));
  return storeIds.map(id => storeMap.get(String(id)) || null);
});

/**
 * 매장 상세 정보 (설정, 계좌, 테마 포함) 배치 조회
 */
const storeDetailLoader = createLoader(async (storeIds) => {
  const stores = await db.store.findMany({
    where: { id: { in: storeIds } },
    include: {
      settings: true,
      account: true,
      theme: true,
      businessInfo: true,
    },
  });
  const storeMap = new Map(stores.map(s => [String(s.id), s]));
  return storeIds.map(id => storeMap.get(String(id)) || null);
});

/**
 * 매장의 카테고리 배치 조회
 */
const storeCategoriesLoader = createLoader(async (storeIds) => {
  const categories = await db.category.findMany({
    where: { storeId: { in: storeIds }, isActive: true },
    orderBy: { displayOrder: 'asc' },
  });
  const categoryMap = new Map();
  storeIds.forEach(id => categoryMap.set(String(id), []));
  categories.forEach(c => {
    const key = String(c.storeId);
    if (!categoryMap.has(key)) categoryMap.set(key, []);
    categoryMap.get(key).push(c);
  });
  return storeIds.map(id => categoryMap.get(String(id)) || []);
});

/**
 * 매장의 활성 상품 수 배치 조회
 */
const storeProductCountLoader = createLoader(async (storeIds) => {
  const counts = await db.product.groupBy({
    by: ['storeId'],
    where: { storeId: { in: storeIds }, isActive: true },
    _count: { id: true },
  });
  const countMap = new Map(counts.map(c => [String(c.storeId), c._count.id]));
  return storeIds.map(id => countMap.get(String(id)) || 0);
});

// ===========================================
// Product Loaders
// ===========================================

/**
 * 상품 배치 조회
 */
const productLoader = createLoader(async (productIds) => {
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: {
      category: true,
      options: {
        include: { items: true },
      },
      images: true,
    },
  });
  const productMap = new Map(products.map(p => [String(p.id), p]));
  return productIds.map(id => productMap.get(String(id)) || null);
});

/**
 * 상품 옵션 배치 조회
 */
const productOptionsLoader = createLoader(async (productIds) => {
  const options = await db.productOption.findMany({
    where: { productId: { in: productIds } },
    include: { items: true },
    orderBy: { displayOrder: 'asc' },
  });
  const optionMap = new Map();
  productIds.forEach(id => optionMap.set(String(id), []));
  options.forEach(o => {
    const key = String(o.productId);
    if (!optionMap.has(key)) optionMap.set(key, []);
    optionMap.get(key).push(o);
  });
  return productIds.map(id => optionMap.get(String(id)) || []);
});

/**
 * 매장별 상품 목록 배치 조회 (페이지네이션용)
 */
const storeProductsLoader = createLoader(async (storeIds) => {
  const products = await db.product.findMany({
    where: { storeId: { in: storeIds }, isActive: true },
    include: {
      category: true,
      options: { include: { items: true } },
      images: true,
    },
    orderBy: { displayOrder: 'asc' },
  });
  const productMap = new Map();
  storeIds.forEach(id => productMap.set(String(id), []));
  products.forEach(p => {
    const key = String(p.storeId);
    if (!productMap.has(key)) productMap.set(key, []);
    productMap.get(key).push(p);
  });
  return storeIds.map(id => productMap.get(String(id)) || []);
});

// ===========================================
// Order Loaders
// ===========================================

/**
 * 주문 배치 조회
 */
const orderLoader = createLoader(async (orderIds) => {
  const orders = await db.order.findMany({
    where: { id: { in: orderIds } },
    include: {
      items: {
        include: { product: true, options: true },
      },
      payments: true,
      store: true,
      customer: true,
      table: true,
    },
  });
  const orderMap = new Map(orders.map(o => [String(o.id), o]));
  return orderIds.map(id => orderMap.get(String(id)) || null);
});

/**
 * 주문 아이템 배치 조회
 */
const orderItemsLoader = createLoader(async (orderIds) => {
  const items = await db.orderItem.findMany({
    where: { orderId: { in: orderIds } },
    include: {
      product: true,
      options: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  const itemMap = new Map();
  orderIds.forEach(id => itemMap.set(String(id), []));
  items.forEach(item => {
    const key = String(item.orderId);
    if (!itemMap.has(key)) itemMap.set(key, []);
    itemMap.get(key).push(item);
  });
  return orderIds.map(id => itemMap.get(String(id)) || []);
});

/**
 * 주문 결제 정보 배치 조회
 */
const orderPaymentsLoader = createLoader(async (orderIds) => {
  const payments = await db.payment.findMany({
    where: { orderId: { in: orderIds } },
    orderBy: { createdAt: 'desc' },
  });
  const paymentMap = new Map();
  orderIds.forEach(id => paymentMap.set(String(id), []));
  payments.forEach(p => {
    const key = String(p.orderId);
    if (!paymentMap.has(key)) paymentMap.set(key, []);
    paymentMap.get(key).push(p);
  });
  return orderIds.map(id => paymentMap.get(String(id)) || []);
});

// ===========================================
// Category Loaders
// ===========================================

/**
 * 카테고리 배치 조회
 */
const categoryLoader = createLoader(async (categoryIds) => {
  const categories = await db.category.findMany({
    where: { id: { in: categoryIds } },
  });
  const categoryMap = new Map(categories.map(c => [String(c.id), c]));
  return categoryIds.map(id => categoryMap.get(String(id)) || null);
});

/**
 * 카테고리별 상품 수 배치 조회
 */
const categoryProductCountLoader = createLoader(async (categoryIds) => {
  const counts = await db.product.groupBy({
    by: ['categoryId'],
    where: { categoryId: { in: categoryIds }, isActive: true },
    _count: { id: true },
  });
  const countMap = new Map(counts.map(c => [String(c.categoryId), c._count.id]));
  return categoryIds.map(id => countMap.get(String(id)) || 0);
});

// ===========================================
// Waiting Loaders
// ===========================================

/**
 * 웨이팅 엔트리 배치 조회
 */
const waitingLoader = createLoader(async (waitingIds) => {
  const waitings = await db.waiting.findMany({
    where: { id: { in: waitingIds } },
    include: { store: true, table: true },
  });
  const waitingMap = new Map(waitings.map(w => [String(w.id), w]));
  return waitingIds.map(id => waitingMap.get(String(id)) || null);
});

/**
 * 매장별 대기열 배치 조회
 */
const storeWaitingListLoader = createLoader(async (storeIds) => {
  const waitings = await db.waiting.findMany({
    where: { storeId: { in: storeIds }, status: { in: ['waiting', 'called'] } },
    include: { table: true },
    orderBy: { queueNumber: 'asc' },
  });
  const waitingMap = new Map();
  storeIds.forEach(id => waitingMap.set(String(id), []));
  waitings.forEach(w => {
    const key = String(w.storeId);
    if (!waitingMap.has(key)) waitingMap.set(key, []);
    waitingMap.get(key).push(w);
  });
  return storeIds.map(id => waitingMap.get(String(id)) || []);
});

// ===========================================
// Reservation Loaders
// ===========================================

/**
 * 예약 배치 조회
 */
const reservationLoader = createLoader(async (reservationIds) => {
  const reservations = await db.reservation.findMany({
    where: { id: { in: reservationIds } },
    include: { store: true, table: true, customer: true },
  });
  const reservationMap = new Map(reservations.map(r => [String(r.id), r]));
  return reservationIds.map(id => reservationMap.get(String(id)) || null);
});

/**
 * 매장별 예약 목록 배치 조회
 */
const storeReservationsLoader = createLoader(async (storeIds) => {
  const reservations = await db.reservation.findMany({
    where: {
      storeId: { in: storeIds },
      status: { in: ['pending', 'confirmed'] },
      reservationTime: { gte: new Date() },
    },
    include: { table: true, customer: true },
    orderBy: { reservationTime: 'asc' },
  });
  const reservationMap = new Map();
  storeIds.forEach(id => reservationMap.set(String(id), []));
  reservations.forEach(r => {
    const key = String(r.storeId);
    if (!reservationMap.has(key)) reservationMap.set(key, []);
    reservationMap.get(key).push(r);
  });
  return storeIds.map(id => reservationMap.get(String(id)) || []);
});

// ===========================================
// Payment Loaders
// ===========================================

/**
 * 결제 배치 조회
 */
const paymentLoader = createLoader(async (paymentIds) => {
  const payments = await db.payment.findMany({
    where: { id: { in: paymentIds } },
    include: { order: true },
  });
  const paymentMap = new Map(payments.map(p => [String(p.id), p]));
  return paymentIds.map(id => paymentMap.get(String(id)) || null);
});

/**
 * 주문별 결제 내역 배치 조회
 */
const orderPaymentsDetailLoader = createLoader(async (orderIds) => {
  const payments = await db.payment.findMany({
    where: { orderId: { in: orderIds } },
    orderBy: { createdAt: 'desc' },
  });
  const paymentMap = new Map();
  orderIds.forEach(id => paymentMap.set(String(id), []));
  payments.forEach(p => {
    const key = String(p.orderId);
    if (!paymentMap.has(key)) paymentMap.set(key, []);
    paymentMap.get(key).push(p);
  });
  return orderIds.map(id => paymentMap.get(String(id)) || []);
});

// ===========================================
// Notification Loaders
// ===========================================

/**
 * 알림 배치 조회
 */
const notificationLoader = createLoader(async (notificationIds) => {
  const notifications = await db.notification.findMany({
    where: { id: { in: notificationIds } },
  });
  const notificationMap = new Map(notifications.map(n => [String(n.id), n]));
  return notificationIds.map(id => notificationMap.get(String(id)) || null);
});

/**
 * 사용자별 알림 배치 조회
 */
const userNotificationsLoader = createLoader(async (userIds) => {
  const notifications = await db.notification.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const notificationMap = new Map();
  userIds.forEach(id => notificationMap.set(String(id), []));
  notifications.forEach(n => {
    const key = String(n.userId);
    if (!notificationMap.has(key)) notificationMap.set(key, []);
    notificationMap.get(key).push(n);
  });
  return userIds.map(id => notificationMap.get(String(id)) || []);
});

// ===========================================
// Point Loaders
// ===========================================

/**
 * 포인트 내역 배치 조회
 */
const pointTransactionLoader = createLoader(async (userIds) => {
  const transactions = await db.pointTransaction.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const transactionMap = new Map();
  userIds.forEach(id => transactionMap.set(String(id), []));
  transactions.forEach(t => {
    const key = String(t.userId);
    if (!transactionMap.has(key)) transactionMap.set(key, []);
    transactionMap.get(key).push(t);
  });
  return userIds.map(id => transactionMap.get(String(id)) || []);
});

/**
 * 사용자 포인트 잔액 배치 조회
 */
const userPointsLoader = createLoader(async (userIds) => {
  const points = await db.userPoints.findMany({
    where: { userId: { in: userIds } },
  });
  const pointsMap = new Map(points.map(p => [String(p.userId), p]));
  return userIds.map(id => pointsMap.get(String(id)) || { balance: 0, totalEarned: 0, totalUsed: 0 });
});

// ===========================================
// Review Loaders
// ===========================================

/**
 * 리뷰 배치 조회
 */
const reviewLoader = createLoader(async (reviewIds) => {
  const reviews = await db.review.findMany({
    where: { id: { in: reviewIds } },
    include: { user: true, store: true, product: true },
  });
  const reviewMap = new Map(reviews.map(r => [String(r.id), r]));
  return reviewIds.map(id => reviewMap.get(String(id)) || null);
});

/**
 * 매장별 리뷰 배치 조회
 */
const storeReviewsLoader = createLoader(async (storeIds) => {
  const reviews = await db.review.findMany({
    where: { storeId: { in: storeIds } },
    include: { user: true, product: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const reviewMap = new Map();
  storeIds.forEach(id => reviewMap.set(String(id), []));
  reviews.forEach(r => {
    const key = String(r.storeId);
    if (!reviewMap.has(key)) reviewMap.set(key, []);
    reviewMap.get(key).push(r);
  });
  return storeIds.map(id => reviewMap.get(String(id)) || []);
});

/**
 * 상품별 리뷰 배치 조회
 */
const productReviewsLoader = createLoader(async (productIds) => {
  const reviews = await db.review.findMany({
    where: { productId: { in: productIds } },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const reviewMap = new Map();
  productIds.forEach(id => reviewMap.set(String(id), []));
  reviews.forEach(r => {
    const key = String(r.productId);
    if (!reviewMap.has(key)) reviewMap.set(key, []);
    reviewMap.get(key).push(r);
  });
  return productIds.map(id => reviewMap.get(String(id)) || []);
});

// ===========================================
// Coupon Loaders
// ===========================================

/**
 * 쿠폰 배치 조회
 */
const couponLoader = createLoader(async (couponIds) => {
  const coupons = await db.coupon.findMany({
    where: { id: { in: couponIds } },
  });
  const couponMap = new Map(coupons.map(c => [String(c.id), c]));
  return couponIds.map(id => couponMap.get(String(id)) || null);
});

/**
 * 사용자 보유 쿠폰 배치 조회
 */
const userCouponsLoader = createLoader(async (userIds) => {
  const coupons = await db.userCoupon.findMany({
    where: { userId: { in: userIds } },
    include: { coupon: true },
  });
  const couponMap = new Map();
  userIds.forEach(id => couponMap.set(String(id), []));
  coupons.forEach(c => {
    const key = String(c.userId);
    if (!couponMap.has(key)) couponMap.set(key, []);
    couponMap.get(key).push(c);
  });
  return userIds.map(id => couponMap.get(String(id)) || []);
});

// ===========================================
// Analytics Loaders
// ===========================================

/**
 * 매장 일일 매출 배치 조회
 */
const storeDailySalesLoader = createLoader(async (storeIds) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sales = await db.order.groupBy({
    by: ['storeId'],
    where: {
      storeId: { in: storeIds },
      status: { in: ['completed', 'paid'] },
      createdAt: { gte: today, lt: tomorrow },
    },
    _sum: { totalAmount: true },
    _count: { id: true },
  });
  const salesMap = new Map(sales.map(s => [String(s.storeId), {
    revenue: s._sum.totalAmount || 0,
    count: s._count.id || 0,
  }]));
  return storeIds.map(id => salesMap.get(String(id)) || { revenue: 0, count: 0 });
});

/**
 * 매장 상품별 매출 배치 조회
 */
const storeProductSalesLoader = createLoader(async (storeIds) => {
  const sales = await db.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: { storeId: { in: storeIds }, status: 'completed' },
    },
    _sum: { quantity: true, totalPrice: true },
    _count: { id: true },
  });
  const salesMap = new Map();
  storeIds.forEach(id => salesMap.set(String(id), []));
  sales.forEach(s => {
    // productId로 매장 ID를 알 수 없으므로 별도 쿼리 필요시 확장
    if (!salesMap.has(String(s.productId))) salesMap.set(String(s.productId), {
      quantity: s._sum.quantity || 0,
      revenue: s._sum.totalPrice || 0,
      count: s._count.id || 0,
    });
  });
  return storeIds.map(id => salesMap.get(String(id)) || {});
});

// ===========================================
// DataLoader 헬퍼 함수
// ===========================================

/**
 * DataLoader 캐시 클리어 (요청 단위 등에서 사용)
 */
const clearLoaderCache = (loaders) => {
  Object.values(loaders).forEach(loader => {
    if (loader && typeof loader.clear === 'function') {
      loader.clearAll();
    }
  });
};

/**
 * DataLoader 전체 캐시 비우기 (테스트/배치 작업 후)
 */
const clearAllLoaderCaches = () => {
  const allLoaders = [
    userLoader, userWithStoresLoader,
    storeLoader, storeDetailLoader, storeCategoriesLoader, storeProductCountLoader,
    productLoader, productOptionsLoader, storeProductsLoader,
    orderLoader, orderItemsLoader, orderPaymentsLoader,
    categoryLoader, categoryProductCountLoader,
    waitingLoader, storeWaitingListLoader,
    reservationLoader, storeReservationsLoader,
    paymentLoader, orderPaymentsDetailLoader,
    notificationLoader, userNotificationsLoader,
    pointTransactionLoader, userPointsLoader,
    reviewLoader, storeReviewsLoader, productReviewsLoader,
    couponLoader, userCouponsLoader,
    storeDailySalesLoader, storeProductSalesLoader,
  ];
  allLoaders.forEach(loader => loader.clearAll());
};

module.exports = {
  // Users
  userLoader,
  userWithStoresLoader,
  // Stores
  storeLoader,
  storeDetailLoader,
  storeCategoriesLoader,
  storeProductCountLoader,
  // Products
  productLoader,
  productOptionsLoader,
  storeProductsLoader,
  // Orders
  orderLoader,
  orderItemsLoader,
  orderPaymentsLoader,
  // Categories
  categoryLoader,
  categoryProductCountLoader,
  // Waiting
  waitingLoader,
  storeWaitingListLoader,
  // Reservations
  reservationLoader,
  storeReservationsLoader,
  // Payments
  paymentLoader,
  orderPaymentsDetailLoader,
  // Notifications
  notificationLoader,
  userNotificationsLoader,
  // Points
  pointTransactionLoader,
  userPointsLoader,
  // Reviews
  reviewLoader,
  storeReviewsLoader,
  productReviewsLoader,
  // Coupons
  couponLoader,
  userCouponsLoader,
  // Analytics
  storeDailySalesLoader,
  storeProductSalesLoader,
  // Helpers
  clearLoaderCache,
  clearAllLoaderCaches,
  // Factory
  createLoader,
};