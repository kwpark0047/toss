const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const Store = require('../repositories/Store');
const storeInfoEnhancementService = require('../services/StoreInfoEnhancementService');

// 매장 정보 완성도에 기여하는 핵심 필드 (정보 보강 가시화용)
const ENRICHMENT_FIELDS = [
  'name',
  'address',
  'phone',
  'business_type',
  'business_number',
  'ceo_name',
  'business_address',
  'open_time',
  'close_time',
  'description',
  'latitude',
  'longitude',
];

// 가벼운 완성도 점수(0~100)와 레벨 — 대시보드 목록에서 즉시 판단 가능하도록 JS로만 계산
function computeInfoScore(store) {
  const filled = ENRICHMENT_FIELDS.filter((f) => {
    const v = store[f];
    return v !== null && v !== undefined && v !== '';
  }).length;
  const score = Math.round((filled / ENRICHMENT_FIELDS.length) * 100);
  const level = score >= 80 ? 'good' : score >= 50 ? 'partial' : 'poor';
  return { infoScore: score, infoLevel: level };
}

const kstDate = (value) =>
  new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 10);
function period(days) {
  const today = kstDate(new Date());
  const end = new Date(today + 'T00:00:00+09:00');
  end.setDate(end.getDate() + 1);
  const start = new Date(end.getTime() - days * 86400000);
  const daily = {};
  for (let i = 0; i < days; i++)
    daily[kstDate(new Date(start.getTime() + i * 86400000))] = {
      date: kstDate(new Date(start.getTime() + i * 86400000)),
      orders: 0,
      sales: 0,
      newStores: 0,
    };
  return { start, end, daily };
}
const netAmount = (rows) =>
  rows.reduce(
    (sum, row) =>
      sum +
      (row.type === 'INCOME' ? row.amount : row.type === 'REFUND' ? -Math.abs(row.amount) : 0),
    0
  );
async function trendData(days, storeId) {
  const { start, end, daily } = period(days);
  const scope = storeId ? { store_id: storeId } : {};
  const [orders, entries, stores] = await Promise.all([
    prisma.orders.findMany({
      where: { ...scope, created_at: { gte: start, lt: end } },
      select: { created_at: true },
    }),
    prisma.ledger.findMany({
      where: { ...scope, type: { in: ['INCOME', 'REFUND'] }, created_at: { gte: start, lt: end } },
      select: { created_at: true, type: true, amount: true },
    }),
    storeId
      ? Promise.resolve([])
      : prisma.stores.findMany({
          where: { created_at: { gte: start, lt: end } },
          select: { created_at: true },
        }),
  ]);
  for (const row of orders) {
    const bucket = daily[kstDate(row.created_at)];
    if (bucket) bucket.orders++;
  }
  for (const row of entries) {
    const bucket = daily[kstDate(row.created_at)];
    if (bucket) bucket.sales += netAmount([row]);
  }
  for (const row of stores) {
    const bucket = daily[kstDate(row.created_at)];
    if (bucket) bucket.newStores++;
  }
  return Object.values(daily);
}

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
  if (business_type)
    where.store_business_info = {
      is: { business_type: { contains: business_type, mode: 'insensitive' } },
    };
  if (status === 'active') where.is_active = true;
  else if (status === 'inactive') where.is_active = false;

  const [stores, total] = await Promise.all([
    prisma.stores.findMany({
      where,
      select: {
        id: true,
        name: true,
        address: true,
        is_active: true,
        phone: true,
        created_at: true,
        plan: true,
        latitude: true,
        longitude: true,
        description: true,
        store_business_info: {
          select: {
            business_type: true,
            business_number: true,
            ceo_name: true,
            business_address: true,
          },
        },
        store_operating_hours: { select: { open_time: true, close_time: true } },
        _count: { select: { orders: true, store_customers: true } },
      },
      orderBy: { id: 'desc' },
      skip,
      take: limit,
    }),
    prisma.stores.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  const totals = stores.length
    ? await prisma.ledger.groupBy({
        by: ['store_id', 'type'],
        where: {
          store_id: { in: stores.map((store) => store.id) },
          type: { in: ['INCOME', 'REFUND'] },
        },
        _sum: { amount: true },
      })
    : [];
  const sales = new Map();
  for (const row of totals)
    sales.set(
      row.store_id,
      (sales.get(row.store_id) || 0) + netAmount([{ type: row.type, amount: row._sum.amount || 0 }])
    );
  const rows = stores.map((raw) => {
    const s = { ...raw, ...raw.store_business_info, ...raw.store_operating_hours };
    return {
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
      sales: sales.get(s.id) || 0,
      ...computeInfoScore(s),
    };
  });

  res.success({ stores: rows, total, totalPages, page });
});

exports.getTrend = catchAsync(async (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));
  res.success({ daily: await trendData(days), timezone: 'Asia/Seoul', sales_basis: 'ledger_net' });
});

exports.getStoreDetail = catchAsync(async (req, res) => {
  const { id } = req.params;
  const storeId = parseInt(id, 10);
  if (!storeId) return res.status(400).json({ success: false, error: '잘못된 매장 ID입니다.' });

  const store = await prisma.stores.findUnique({
    where: { id: storeId },
    include: {
      store_business_info: { select: { business_type: true } },
      store_operating_hours: { select: { open_time: true, close_time: true } },
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
        point_transactions: { some: { store_id: storeId } },
      },
      select: { total_points: true },
    }),
  ]);

  const daily = await trendData(days, storeId);
  const ledgerTotals = await prisma.ledger.groupBy({
    by: ['type'],
    where: { store_id: storeId, type: { in: ['INCOME', 'REFUND'] } },
    _sum: { amount: true },
  });
  const totalSales = netAmount(
    ledgerTotals.map((row) => ({ type: row.type, amount: row._sum.amount || 0 }))
  );

  const totalPoints = pointsAgg.reduce((sum, p) => sum + (p.total_points || 0), 0);

  res.success({
    store: {
      id: store.id,
      name: store.name,
      address: store.address,
      is_active: store.is_active,
      business_type: store.store_business_info?.business_type,
    },
    summary: {
      totalOrders: orderAgg._count.id || 0,
      totalSales,
      customers: store._count.store_customers,
      points: totalPoints,
      points_basis: 'global_wallets_with_store_transactions',
    },
    recentOrders,
    daily,
  });
});

exports.toggleActive = catchAsync(async (req, res) => {
  const { id } = req.params;
  const storeId = parseInt(id, 10);
  if (!storeId) return res.status(400).json({ success: false, error: '잘못된 매장 ID입니다.' });

  const { is_active } = req.body;
  if (typeof is_active !== 'boolean')
    throw new (require('../utils/errorHandler').AppError)('활성 상태는 boolean이어야 합니다.', 400);
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
  const result = await require('../services/AdminPointAdjustment')(prisma, {
    storeId,
    phone: String(phone || '').replace(/[-\s]/g, ''),
    delta: Number(amount),
    reason: typeof reason === 'string' ? reason.slice(0, 500) : '',
    key: req.get('Idempotency-Key'),
  });
  logger.info(
    { storeId, delta: Number(amount), replayed: result.replayed },
    '포인트 수동 지급/차감'
  );
  res.success({ delta: Number(amount), ...result }, '처리 완료');
});

// ── 매장 정보 보강 (super_admin) ─────────────────────────────────────────────

// 플랫폼 전역 매장 정보 커버리지 — 대시보드 위젯용 필드별 누락 집계
exports.getEnrichmentCoverage = catchAsync(async (req, res) => {
  const totalStores = await prisma.stores.count();

  const keyFields = [
    { field: 'phone', label: '전화번호', where: { phone: null } },
    {
      field: 'business_type',
      label: '업종',
      where: {
        OR: [
          { store_business_info: { is: null } },
          { store_business_info: { is: { business_type: null } } },
          { store_business_info: { is: { business_type: '' } } },
        ],
      },
    },
    { field: 'latitude', label: '위도', where: { latitude: null } },
    { field: 'longitude', label: '경도', where: { longitude: null } },
    {
      field: 'open_time',
      label: '영업시간',
      where: {
        OR: [
          { store_operating_hours: { is: null } },
          {
            store_operating_hours: {
              is: {
                OR: [
                  { open_time: null },
                  { close_time: null },
                  { open_time: '' },
                  { close_time: '' },
                ],
              },
            },
          },
        ],
      },
    },
    { field: 'description', label: '매장 설명', where: { description: null } },
    {
      field: 'business_number',
      label: '사업자등록번호',
      where: {
        OR: [
          { store_business_info: { is: null } },
          { store_business_info: { is: { business_number: null } } },
          { store_business_info: { is: { business_number: '' } } },
        ],
      },
    },
    {
      field: 'ceo_name',
      label: '대표자명',
      where: {
        OR: [
          { store_business_info: { is: null } },
          { store_business_info: { is: { ceo_name: null } } },
          { store_business_info: { is: { ceo_name: '' } } },
        ],
      },
    },
    {
      field: 'business_address',
      label: '사업장 주소',
      where: {
        OR: [
          { store_business_info: { is: null } },
          { store_business_info: { is: { business_address: null } } },
          { store_business_info: { is: { business_address: '' } } },
        ],
      },
    },
  ];

  const missingCounts = await Promise.all(
    keyFields.map((f) => prisma.stores.count({ where: f.where }))
  );
  const coverage = {};
  keyFields.forEach((f, i) => {
    coverage[f.field] = { label: f.label, missing: missingCounts[i] };
  });

  const filled = keyFields.reduce((acc, f, i) => acc + (totalStores - missingCounts[i]), 0);
  const overallScore =
    totalStores > 0 ? Math.round((filled / (totalStores * keyFields.length)) * 100) : 100;

  res.success({ totalStores, overallScore, coverage });
});

// 매장별 정보 완성도 리포트 (AI 보강 컨텍스트)
exports.getStoreCompletion = catchAsync(async (req, res) => {
  const storeId = parseInt(req.params.id, 10);
  if (!storeId) return res.status(400).json({ success: false, error: '잘못된 매장 ID입니다.' });

  const store = await prisma.stores.findUnique({ where: { id: storeId } });
  if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });

  const report = await storeInfoEnhancementService.generateCompletionReport(storeId);
  res.success(report);
});

// 매장 정보 AI 보강 실행 (autoSave=true 시 즉시 반영, false 시 제안만 생성)
exports.runStoreEnhance = catchAsync(async (req, res) => {
  const storeId = parseInt(req.params.id, 10);
  if (!storeId) return res.status(400).json({ success: false, error: '잘못된 매장 ID입니다.' });

  const store = await prisma.stores.findUnique({ where: { id: storeId } });
  if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });

  const autoSave = req.query.autoSave === 'true';
  let enhancement;
  try {
    enhancement = autoSave
      ? await storeInfoEnhancementService.autoCompleteStoreInfo(storeId, { autoSave: true })
      : await storeInfoEnhancementService.enhanceStoreInfo(storeId);
  } catch (error) {
    logger.warn({ storeId, error: error.message }, 'AI 매장 정보 보강 실패');
    return res
      .status(502)
      .json({ success: false, error: 'AI 보강에 실패했습니다. 잠시 후 다시 시도하세요.' });
  }

  res.success(
    enhancement,
    autoSave ? '보강 데이터가 적용되었습니다.' : '보강 제안이 생성되었습니다.'
  );
});

// 생성된 보강 데이터 적용 (화이트리스트 필드만 허용)
exports.applyStoreEnhance = catchAsync(async (req, res) => {
  const storeId = parseInt(req.params.id, 10);
  if (!storeId) return res.status(400).json({ success: false, error: '잘못된 매장 ID입니다.' });

  const { enhancements } = req.body;
  if (!enhancements || typeof enhancements !== 'object' || Object.keys(enhancements).length === 0) {
    return res.status(400).json({ success: false, error: '적용할 보강 필드가 없습니다.' });
  }

  const allowed = new Set([
    'name',
    'description',
    'address',
    'phone',
    'business_type',
    'open_time',
    'close_time',
    'business_hours',
    'latitude',
    'longitude',
    'business_number',
    'business_name',
    'ceo_name',
    'tax_invoice_email',
    'mail_order_number',
    'business_address',
    'customer_service_phone',
    'customer_service_email',
    'terms_of_service',
    'privacy_policy',
    'refund_policy',
  ]);

  const sanitized = {};
  for (const [key, value] of Object.entries(enhancements)) {
    if (allowed.has(key)) sanitized[key] = value;
  }
  if (Object.keys(sanitized).length === 0) {
    return res.status(400).json({ success: false, error: '적용 가능한 필드가 없습니다.' });
  }

  const updated = await Store.update(storeId, sanitized);
  logger.info({ storeId, fields: Object.keys(sanitized) }, '슈퍼관리자 매장 정보 보강 적용');
  res.success(
    { store: updated, applied: Object.keys(sanitized) },
    `${Object.keys(sanitized).length}개 필드가 보강되었습니다.`
  );
});
