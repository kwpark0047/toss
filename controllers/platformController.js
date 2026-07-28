const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

exports.getOverview = catchAsync(async (req, res) => {
  const [totalStores, activeStores, totalCustomers, totalOrders, pointsAgg] = await Promise.all([
    prisma.stores.count(),
    prisma.stores.count({ where: { is_active: true } }),
    prisma.store_customers.count(),
    prisma.orders.count(),
    prisma.user_points.aggregate({
      _sum: { lifetime_earned: true, total_points: true },
    }),
  ]);

  res.success({
    totalStores,
    activeStores,
    totalCustomers,
    totalOrders,
    pointsIssued: pointsAgg._sum.lifetime_earned || 0,
    pointsBalance: pointsAgg._sum.total_points || 0,
  });
});

exports.getStores = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const { search, region, business_type, status } = req.query;

  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (region) where.address = { contains: region, mode: 'insensitive' };
  if (business_type) where.business_type = { contains: business_type, mode: 'insensitive' };
  if (status === 'active') where.is_active = true;
  else if (status === 'inactive') where.is_active = false;

  const [stores, total] = await Promise.all([
    prisma.stores.findMany({
      where,
      select: {
        id: true, name: true, address: true, is_active: true,
        business_type: true, phone: true, created_at: true, plan: true,
        latitude: true, longitude: true,
        _count: { select: { orders: true, store_customers: true } },
      },
      orderBy: { id: 'desc' },
      skip,
      take: limit,
    }),
    prisma.stores.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  const rows = stores.map(s => ({
    id: s.id,
    name: s.name,
    address: s.address,
    is_active: s.is_active,
    business_type: s.business_type,
    phone: s.phone,
    created_at: s.created_at,
    plan: s.plan,
    latitude: s.latitude,
    longitude: s.longitude,
    orders: s._count.orders,
    customers: s._count.store_customers,
    sales: 0,
  }));

  res.success({ stores: rows, total, totalPages, page });
});

exports.getTrend = catchAsync(async (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));
  const since = new Date();
  since.setDate(since.getDate() - days);

  const orders = await prisma.orders.findMany({
    where: { created_at: { gte: since } },
    select: { created_at: true, total_amount: true },
    orderBy: { created_at: 'asc' },
  });

  const stores = await prisma.stores.findMany({
    where: { created_at: { gte: since } },
    select: { created_at: true },
    orderBy: { created_at: 'asc' },
  });

  const dailyMap = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = { date: key, orders: 0, sales: 0, newStores: 0 };
  }

  for (const o of orders) {
    const key = new Date(o.created_at).toISOString().slice(0, 10);
    if (dailyMap[key]) {
      dailyMap[key].orders += 1;
      dailyMap[key].sales += o.total_amount || 0;
    }
  }

  for (const s of stores) {
    const key = new Date(s.created_at).toISOString().slice(0, 10);
    if (dailyMap[key]) dailyMap[key].newStores += 1;
  }

  res.success({ daily: Object.values(dailyMap) });
});

exports.getStoreDetail = catchAsync(async (req, res) => {
  const { id } = req.params;
  const storeId = parseInt(id, 10);
  if (!storeId) return res.status(400).json({ success: false, error: '잘못된 매장 ID입니다.' });

  const store = await prisma.stores.findUnique({
    where: { id: storeId },
    include: {
      _count: { select: { orders: true, products: true, store_customers: true, reviews: true } },
    },
  });
  if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });

  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [recentOrders, orderAgg, pointsAgg] = await Promise.all([
    prisma.orders.findMany({
      where: { store_id: storeId, created_at: { gte: since } },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: { id: true, order_number: true, total_amount: true, status: true, created_at: true },
    }),
    prisma.orders.aggregate({
      where: { store_id: storeId },
      _sum: { total_amount: true },
      _count: { id: true },
    }),
    prisma.user_points.findMany({
      where: {
        store_customers: { some: { store_id: storeId } },
      },
      select: { total_points: true },
    }),
  ]);

  const firstCustomer = await prisma.store_customers.findFirst({
    where: { store_id: storeId },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  const dailyOrders = await prisma.orders.findMany({
    where: { store_id: storeId, created_at: { gte: since } },
    select: { created_at: true, total_amount: true },
    orderBy: { created_at: 'asc' },
  });

  const dailyMap = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = { date: key, orders: 0, sales: 0 };
  }
  for (const o of dailyOrders) {
    const key = new Date(o.created_at).toISOString().slice(0, 10);
    if (dailyMap[key]) {
      dailyMap[key].orders += 1;
      dailyMap[key].sales += o.total_amount || 0;
    }
  }

  const totalPoints = pointsAgg.reduce((sum, p) => sum + (p.total_points || 0), 0);

  res.success({
    store,
    summary: {
      totalOrders: orderAgg._count.id || 0,
      totalSales: orderAgg._sum.total_amount || 0,
      customers: store._count.store_customers,
      points: totalPoints,
    },
    recentOrders,
    daily: Object.values(dailyMap),
  });
});

exports.toggleActive = catchAsync(async (req, res) => {
  const { id } = req.params;
  const storeId = parseInt(id, 10);
  if (!storeId) return res.status(400).json({ success: false, error: '잘못된 매장 ID입니다.' });

  const { is_active } = req.body;
  const store = await prisma.stores.update({
    where: { id: storeId },
    data: { is_active: !!is_active },
  });

  logger.info({ storeId, is_active }, '매장 활성 상태 변경');
  res.updated({ id: store.id, is_active: store.is_active });
});

exports.grantPoints = catchAsync(async (req, res) => {
  const { id } = req.params;
  const storeId = parseInt(id, 10);
  if (!storeId) return res.status(400).json({ success: false, error: '잘못된 매장 ID입니다.' });

  const { phone, amount, reason } = req.body;
  if (!phone || !amount) {
    return res.status(400).json({ success: false, error: '전화번호와 포인트 금액이 필요합니다.' });
  }

  const delta = parseInt(amount, 10);
  if (!delta) return res.status(400).json({ success: false, error: '유효한 포인트 금액이 아닙니다.' });

  let point = await prisma.user_points.findFirst({ where: { phone } });
  if (point) {
    if (delta < 0 && (point.total_points || 0) < -delta) {
      return res.status(400).json({ success: false, error: '포인트 잔액이 부족합니다.' });
    }
    const updateData = { total_points: { increment: delta } };
    if (delta > 0) updateData.lifetime_earned = { increment: delta };
    point = await prisma.user_points.update({ where: { id: point.id }, data: updateData });
  } else {
    if (delta < 0) return res.status(400).json({ success: false, error: '포인트 내역이 없는 고객입니다.' });
    point = await prisma.user_points.create({
      data: { phone, total_points: delta, lifetime_earned: delta },
    });
  }

  await prisma.point_transactions.create({
    data: {
      user_point_id: point.id,
      store_id: storeId,
      amount: Math.abs(delta),
      balance_after: point.total_points || 0,
      type: delta > 0 ? 'earn' : 'use',
      description: reason || (delta > 0 ? '관리자 지급' : '관리자 차감'),
    },
  });

  logger.info({ storeId, phone, delta, reason }, '포인트 수동 지급/차감');
  res.success({ phone, delta, balance: point.total_points || 0 }, '처리 완료');
});
