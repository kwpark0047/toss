const express = require('express');
const router = express.Router();
const StoreCustomer = require('../models/StoreCustomer');
const { checkStorePermission, getStoreRole } = require('../middleware/storeAuth');
const authMiddleware = require('../middleware/auth');
const prisma = require('../config/prisma');
const Point = require('../models/Point');
const StoreTier = require('../models/StoreTier');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { normalizePhone } = require('../utils/phoneEncryption');

/**
 * [고객 핸드폰 번호 통합 등록]
 * POST /api/customers/phone-join
 * 한 트랜잭션으로 고객 upsert, 포인트 적립, 웰컴 쿠폰 발급, 알림 등록을 처리합니다.
 */
router.post('/phone-join', catchAsync(async (req, res) => {
    const { phone, store_id, order_id, total_amount } = req.body;

    if (!phone || !store_id) {
        return res.status(400).json({ success: false, message: '핸드폰 번호와 매장 ID는 필수입니다.' });
    }

    const normalizedPhone = normalizePhone(phone);
    const storeId = parseInt(store_id);
    const amount = parseInt(total_amount) || 0;
    const orderId = order_id ? parseInt(order_id) : null;

    if (orderId) {
        const alreadyEarned = await prisma.point_transactions.findFirst({
            where: { order_id: orderId, type: 'earn' }
        });
        if (alreadyEarned) {
            return res.json({
                success: false,
                message: '이미 포인트가 적립된 주문입니다.',
                already_joined: true
            });
        }
    }

    const existingCustomer = await prisma.store_customers.findFirst({
        where: { store_id: storeId, customer_phone: normalizedPhone }
    });
    const isNewCustomer = !existingCustomer;

    const newTotalSpent = (existingCustomer?.total_spent || 0) + amount;
    const newTier = await StoreTier.calculateTier(storeId, newTotalSpent);

    const customer = await prisma.store_customers.upsert({
        where: { uk_store_customer: { store_id: storeId, customer_phone: normalizedPhone } },
        create: {
            store_id: storeId,
            customer_phone: normalizedPhone,
            visit_count: 1,
            total_spent: amount,
            tier: newTier.tier_name,
            last_visit_at: new Date()
        },
        update: {
            visit_count: { increment: 1 },
            total_spent: { increment: amount },
            tier: newTier.tier_name,
            last_visit_at: new Date(),
            updated_at: new Date()
        }
    });

    const earnPoints = amount > 0
        ? await Point.calculateEarnPoints(amount, storeId, { phone: normalizedPhone })
        : 0;

    let pointResult = null;
    let totalPoints = 0;
    if (earnPoints > 0) {
        pointResult = await Point.earn({
            identifier: { phone: normalizedPhone },
            store_id: storeId,
            order_id: orderId,
            amount: earnPoints,
            description: `주문 적립 (${amount.toLocaleString()}원)`
        });
        totalPoints = pointResult.balance;
    } else {
        const balance = await Point.getBalance({ phone: normalizedPhone });
        totalPoints = balance.total_points;
    }

    let welcomeCoupon = null;
    if (isNewCustomer) {
        const coupon = await prisma.coupons.findFirst({
            where: {
                store_id: storeId,
                is_active: 1,
                name: { contains: '웰컴' }
            }
        });
        if (coupon) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + coupon.valid_days);
            await prisma.user_coupons.create({
                data: {
                    customer_phone: normalizedPhone,
                    coupon_id: coupon.id,
                    status: 'UNUSED',
                    expires_at: expiresAt
                }
            });
            welcomeCoupon = { name: coupon.name, amount: coupon.amount, type: coupon.type };
        }
    }

    if (orderId) {
        await prisma.notifications.create({
            data: {
                store_id: storeId,
                type: 'NEW_ORDER',
                title: '주문 알림 등록',
                message: `${normalizedPhone} 고객의 알림이 등록되었습니다.`,
                priority: 'low'
            }
        }).catch(err => logger.warn(`[알림 실패] 고객 알림 등록 (store ${storeId}): ${err.message}`));
    }

    const allTiers = await StoreTier.getTiers(storeId);
    const nextTier = allTiers
        .filter(t => t.min_spent > newTotalSpent)
        .sort((a, b) => a.min_spent - b.min_spent)[0] || null;

    return res.json({
        success: true,
        is_new_customer: isNewCustomer,
        points_earned: earnPoints,
        total_points: totalPoints,
        customer_tier: newTier.tier_name,
        earn_rate: newTier.earn_rate,
        visit_count: customer.visit_count,
        total_spent: customer.total_spent,
        welcome_coupon: welcomeCoupon,
        next_tier: nextTier
            ? {
                name: nextTier.tier_name,
                remaining: nextTier.min_spent - newTotalSpent
            }
            : null,
        socket_channel: `customer-orders-${normalizedPhone}`
    });
}));

/**
 * [매장별 단골고객 통계 요약]
 * GET /api/customers/:storeId/stats
 */
router.get('/:storeId/stats', authMiddleware, checkStorePermission('owner'), catchAsync(async (req, res) => {
    const sid = parseInt(req.params.storeId);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [all, newThisMonth, tierCounts, churned, tiers] = await Promise.all([
        prisma.store_customers.aggregate({
            where: { store_id: sid },
            _count: { id: true },
            _avg: { visit_count: true, total_spent: true },
        }),
        prisma.store_customers.count({
            where: { store_id: sid, created_at: { gte: startOfMonth } },
        }),
        prisma.store_customers.groupBy({
            by: ['tier'],
            where: { store_id: sid },
            _count: { id: true },
        }),
        prisma.store_customers.count({
            where: { store_id: sid, last_visit_at: { lt: thirtyDaysAgo } },
        }),
        prisma.store_tier_settings.findMany({
            where: { store_id: sid }, orderBy: { min_spent: 'asc' },
        }),
    ]);

    const tierMap = {};
    tierCounts.forEach(t => { tierMap[t.tier] = t._count.id; });

    res.json({
        success: true,
        data: {
            total_customers: all._count.id || 0,
            new_this_month: newThisMonth,
            avg_visit_count: Math.round((all._avg.visit_count || 0) * 10) / 10,
            avg_spent: Math.round(all._avg.total_spent || 0),
            tier_distribution: tierMap,
            churned_30d: churned,
            tiers,
        },
    });
}));

/**
 * [단골고객 상세 이력 조회]
 * GET /api/customers/:storeId/customer/:customerId/history
 */
router.get('/:storeId/customer/:customerId/history', authMiddleware, checkStorePermission('owner'), catchAsync(async (req, res) => {
    const { storeId, customerId } = req.params;
    const customer = await prisma.store_customers.findFirst({
        where: { id: parseInt(customerId), store_id: parseInt(storeId) },
    });
    if (!customer) return res.status(404).json({ success: false, error: '고객 정보 없음' });

    const [pointInfo, recentOrders, pointHistory, activeCoupons, tiers] = await Promise.all([
        prisma.user_points.findFirst({
            where: { phone: customer.customer_phone },
            select: { total_points: true, lifetime_earned: true, lifetime_used: true },
        }),
        prisma.orders.findMany({
            where: { store_id: customer.store_id, customer_phone: customer.customer_phone },
            orderBy: { created_at: 'desc' },
            take: 10,
            select: { id: true, total_amount: true, status: true, created_at: true, order_type: true },
        }),
        prisma.point_transactions.findMany({
            where: { store_id: customer.store_id, user_points: { phone: customer.customer_phone } },
            orderBy: { created_at: 'desc' },
            take: 15,
            select: { id: true, type: true, amount: true, balance_after: true, description: true, created_at: true },
        }),
        prisma.user_coupons.findMany({
            where: { customer_phone: customer.customer_phone, status: 'UNUSED', OR: [{ expires_at: null }, { expires_at: { gte: new Date() } }] },
            include: { coupons: { select: { name: true, amount: true, type: true, store_id: true } } },
            orderBy: { created_at: 'desc' },
            take: 10,
        }),
        prisma.store_tier_settings.findMany({
            where: { store_id: customer.store_id }, orderBy: { min_spent: 'asc' },
        }),
    ]);

    const nextTier = tiers
        .filter(t => t.min_spent > customer.total_spent)
        .sort((a, b) => a.min_spent - b.min_spent)[0] || null;

    res.json({
        success: true,
        data: {
            customer,
            point_balance: pointInfo?.total_points || 0,
            lifetime_earned: pointInfo?.lifetime_earned || 0,
            lifetime_used: pointInfo?.lifetime_used || 0,
            recent_orders: recentOrders,
            point_history: pointHistory,
            active_coupons: activeCoupons,
            tiers,
            next_tier: nextTier,
        },
    });
}));

/**
 * [매장 쿠폰 목록 조회 (발급용)]
 * GET /api/customers/:storeId/coupons
 */
router.get('/:storeId/coupons', authMiddleware, checkStorePermission('owner'), catchAsync(async (req, res) => {
    const coupons = await prisma.coupons.findMany({
        where: { store_id: parseInt(req.params.storeId), is_active: 1 },
        orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data: coupons });
}));

/**
 * [고객에게 쿠폰 발급]
 * POST /api/customers/:storeId/customer/:customerId/coupon
 */
router.post('/:storeId/customer/:customerId/coupon', authMiddleware, checkStorePermission('owner'), catchAsync(async (req, res) => {
    const { coupon_id } = req.body;
    if (!coupon_id) return res.status(400).json({ success: false, error: '쿠폰 ID가 필요합니다' });

    const customer = await prisma.store_customers.findFirst({
        where: { id: parseInt(req.params.customerId), store_id: parseInt(req.params.storeId) },
    });
    if (!customer) return res.status(404).json({ success: false, error: '고객 없음' });

    const coupon = await prisma.coupons.findFirst({
        where: { id: parseInt(coupon_id), store_id: parseInt(req.params.storeId), is_active: 1 },
    });
    if (!coupon) return res.status(404).json({ success: false, error: '쿠폰 없음' });

    const alreadyHas = await prisma.user_coupons.findFirst({
        where: { customer_phone: customer.customer_phone, coupon_id: coupon.id, status: 'UNUSED' },
    });
    if (alreadyHas) return res.status(409).json({ success: false, error: '이미 보유 중인 쿠폰입니다.' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (coupon.valid_days || 30));

    const issued = await prisma.user_coupons.create({
        data: { customer_phone: customer.customer_phone, coupon_id: coupon.id, status: 'UNUSED', expires_at: expiresAt },
    });
    res.json({ success: true, data: issued, message: `${coupon.name} 쿠폰이 발급되었습니다.` });
}));

/**
 * [특정 단골고객 상세 조회]
 * GET /api/customers/detail/:customerId
 * ⚠️ /:storeId 보다 먼저 등록해야 "detail"이 storeId로 매칭되는 버그 방지
 */
router.get('/detail/:customerId', authMiddleware, catchAsync(async (req, res) => {
    const { customerId } = req.params;
    const customer = await StoreCustomer.findById(customerId);
    if (!customer) {
        return res.status(404).json({ error: '고객 정보를 찾을 수 없습니다.' });
    }

    const role = await getStoreRole(req.user.id, customer.store_id);
    if (!role && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '해당 매장의 고객 정보에 접근할 권한이 없습니다.' });
    }

    res.json({
        success: true,
        data: customer
    });
}));

/**
 * [매장별 단골고객 리스트 조회]
 * GET /api/customers/:storeId
 */
router.get('/:storeId', authMiddleware, checkStorePermission('owner'), catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { sortBy, order, limit, search } = req.query;
    const customers = await StoreCustomer.findByStoreId(storeId, {
        sortBy,
        order,
        limit: limit ? parseInt(limit) : 50,
        search
    });

    res.json({
        success: true,
        data: customers
    });
}));

/**
 * [고객 실시간 위치 업데이트 및 근처 매장 혜택 알림]
 * POST /api/customers/update-location
 */
router.post('/update-location', catchAsync(async (req, res) => {
    const { phone, latitude, longitude } = req.body;
    const notificationService = require('../utils/notifications');

    const activeStores = await prisma.stores.findMany({
        where: {
            is_active: true,
            latitude: { not: null },
            longitude: { not: null }
        },
        include: { coupons: { where: { is_active: 1 }, take: 1 } }
    });

    const NEARBY_DISTANCE_KM = 0.5;

    // Haversine 공식: 두 좌표 간 거리(km) 계산
    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const nearbyStore = activeStores.find(store => {
        const distance = getDistance(latitude, longitude, store.latitude, store.longitude);
        return distance <= NEARBY_DISTANCE_KM;
    });

    if (nearbyStore && nearbyStore.coupons.length > 0) {
        const user = await prisma.users.findFirst({
            where: { user_points: { some: { phone: phone } } },
            select: { fcm_token: true }
        });

        if (user && user.fcm_token) {
            await notificationService.sendPushNotification(user.fcm_token, {
                title: `🎁 ${nearbyStore.name}이 근처에 있어요!`,
                body: `'${nearbyStore.coupons[0].name}' 쿠폰이 준비되어 있습니다. 지금 방문해 보세요!`,
                data: { storeId: nearbyStore.id.toString(), type: 'GEO_MARKETING' }
            });

            return res.json({ success: true, message: '근처 매장 혜택 알림을 발송했습니다.', storeName: nearbyStore.name });
        }
    }

    res.json({ success: true, message: '업데이트 완료 (근처 혜택 없음)' });
}));

module.exports = router;
