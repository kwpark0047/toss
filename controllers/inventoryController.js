const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const notificationService = require('../services/notificationService');

/**
 * 1. 재고 현황 목록 조회
 * GET /api/inventory/store/:storeId
 */
const getInventory = async (req, res, next) => {
    try {
        const storeId = Number(req.params.storeId);
        const { status, category_id, search, page = 1, limit = 50 } = req.query;

        const where = { store_id: storeId };

        if (category_id) where.category_id = Number(category_id);
        if (search) where.name = { contains: search, mode: 'insensitive' };

        // 재고 상태 필터
        if (status === 'low') {
            // stock_quantity <= low_stock_threshold AND stock_quantity IS NOT NULL
            where.stock_quantity = { not: null, lte: prisma.raw('low_stock_threshold') };
        } else if (status === 'out') {
            where.stock_quantity = 0;
            where.is_sold_out = true;
        } else if (status === 'managed') {
            where.stock_quantity = { not: null };
        } else if (status === 'unlimited') {
            where.stock_quantity = null;
        }

        const skip = (Number(page) - 1) * Number(limit);
        const [total, products] = await Promise.all([
            prisma.products.count({ where }),
            prisma.products.findMany({
                where,
                include: { categories: { select: { id: true, name: true } } },
                orderBy: [{ category_id: 'asc' }, { sort_order: 'asc' }],
                skip,
                take: Number(limit)
            })
        ]);

        // 저재고 경고 계산 후 포함
        const enriched = products.map(p => ({
            ...p,
            stock_status: p.stock_quantity === null
                ? 'unlimited'
                : p.stock_quantity === 0
                ? 'out'
                : p.stock_quantity <= p.low_stock_threshold
                ? 'low'
                : 'ok',
        }));

        // 대시보드 요약 수치
        const allManaged = await prisma.products.findMany({
            where: { store_id: storeId, stock_quantity: { not: null } },
            select: { stock_quantity: true, low_stock_threshold: true }
        });
        const summary = {
            total_managed: allManaged.length,
            out_of_stock:  allManaged.filter(p => p.stock_quantity === 0).length,
            low_stock:     allManaged.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold).length,
            ok:            allManaged.filter(p => p.stock_quantity > p.low_stock_threshold).length,
        };

        res.success({
            products: enriched,
            summary,
            pagination: { total, page: Number(page), limit: Number(limit), total_pages: Math.ceil(total / Number(limit)) }
        }, '재고 현황 조회 완료');
    } catch (err) { next(err); }
};

/**
 * 2. 단일 상품 재고 수동 조정
 * PUT /api/inventory/products/:productId/stock
 * body: { change, reason, note }
 *   change > 0 → 입고, change < 0 → 차감, reason: MANUAL_IN | MANUAL_OUT | CORRECTION | RETURN
 */
const adjustStock = async (req, res, next) => {
    try {
        const productId = Number(req.params.productId);
        const { change, reason, note } = req.body;

        if (change === undefined || change === null) return next(new AppError('change 값이 필요합니다.', 400));
        if (!['MANUAL_IN', 'MANUAL_OUT', 'CORRECTION', 'RETURN'].includes(reason)) {
            return next(new AppError('reason은 MANUAL_IN | MANUAL_OUT | CORRECTION | RETURN 중 하나여야 합니다.', 400));
        }

        const product = await prisma.products.findUnique({ where: { id: productId } });
        if (!product) return next(new AppError('상품을 찾을 수 없습니다.', 404));

        const currentQty = product.stock_quantity ?? 0;
        const newQty = Math.max(0, currentQty + Number(change));

        const [updated] = await prisma.$transaction([
            prisma.products.update({
                where: { id: productId },
                data: {
                    stock_quantity: newQty,
                    is_sold_out: newQty === 0,
                    updated_at: new Date()
                }
            }),
            prisma.stock_history.create({
                data: {
                    product_id:  productId,
                    store_id:    product.store_id,
                    change:      Number(change),
                    qty_after:   newQty,
                    reason,
                    note:        note || null,
                    created_by:  req.user?.id || null
                }
            })
        ]);

        // 저재고 알림
        if (newQty <= product.low_stock_threshold && newQty > 0) {
            await notificationService.notifyLowStockDB({ ...updated, name: product.name });
        } else if (newQty === 0) {
            await notificationService.notifyLowStockDB({ ...updated, name: product.name, stock_quantity: 0 });
        }

        res.success({
            product_id: productId,
            previous_qty: currentQty,
            change: Number(change),
            new_qty: newQty,
            stock_status: newQty === 0 ? 'out' : newQty <= product.low_stock_threshold ? 'low' : 'ok'
        }, `재고가 ${newQty}개로 업데이트되었습니다.`);
    } catch (err) { next(err); }
};

/**
 * 3. 재고 수량 절대값 설정 (초기 설정용)
 * PUT /api/inventory/products/:productId/stock/set
 * body: { quantity, low_stock_threshold }
 */
const setStock = async (req, res, next) => {
    try {
        const productId = Number(req.params.productId);
        const { quantity, low_stock_threshold } = req.body;

        const product = await prisma.products.findUnique({ where: { id: productId } });
        if (!product) return next(new AppError('상품을 찾을 수 없습니다.', 404));

        const previousQty = product.stock_quantity;
        const newQty = quantity === null || quantity === undefined ? null : Math.max(0, Number(quantity));
        const newThreshold = low_stock_threshold !== undefined ? Math.max(0, Number(low_stock_threshold)) : product.low_stock_threshold;

        const updateData = {
            low_stock_threshold: newThreshold,
            updated_at: new Date()
        };
        if (newQty !== undefined) {
            updateData.stock_quantity = newQty;
            updateData.is_sold_out = newQty === 0;
        }

        await prisma.products.update({ where: { id: productId }, data: updateData });

        // 재고 이력 기록 (null → 숫자인 경우만)
        if (newQty !== null && previousQty !== newQty) {
            const change = newQty - (previousQty ?? 0);
            await prisma.stock_history.create({
                data: {
                    product_id: productId,
                    store_id:   product.store_id,
                    change,
                    qty_after:  newQty,
                    reason:     'CORRECTION',
                    note:       '재고 초기 설정',
                    created_by: req.user?.id || null
                }
            });
        }

        res.success({ product_id: productId, stock_quantity: newQty, low_stock_threshold: newThreshold }, '재고 설정 완료');
    } catch (err) { next(err); }
};

/**
 * 4. 재고 변동 이력 조회
 * GET /api/inventory/products/:productId/history
 */
const getStockHistory = async (req, res, next) => {
    try {
        const productId = Number(req.params.productId);
        const { page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const [total, history] = await Promise.all([
            prisma.stock_history.count({ where: { product_id: productId } }),
            prisma.stock_history.findMany({
                where: { product_id: productId },
                orderBy: { created_at: 'desc' },
                skip,
                take: Number(limit)
            })
        ]);

        res.success({
            history,
            pagination: { total, page: Number(page), limit: Number(limit), total_pages: Math.ceil(total / Number(limit)) }
        }, '재고 이력 조회 완료');
    } catch (err) { next(err); }
};

/**
 * 5. 매장 전체 재고 이력 조회
 * GET /api/inventory/store/:storeId/history
 */
const getStoreStockHistory = async (req, res, next) => {
    try {
        const storeId = Number(req.params.storeId);
        const { reason, page = 1, limit = 30 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where = { store_id: storeId };
        if (reason) where.reason = reason;

        const [total, history] = await Promise.all([
            prisma.stock_history.count({ where }),
            prisma.stock_history.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: Number(limit),
                include: { products: { select: { id: true, name: true, image_url: true } } }
            })
        ]);

        res.success({
            history,
            pagination: { total, page: Number(page), limit: Number(limit), total_pages: Math.ceil(total / Number(limit)) }
        }, '매장 재고 이력 조회 완료');
    } catch (err) { next(err); }
};

/**
 * 6. 재고 부족 상품 목록 (빠른 조회용 — 알림 센터 배지용)
 * GET /api/inventory/store/:storeId/alerts
 */
const getLowStockAlerts = async (req, res, next) => {
    try {
        const storeId = Number(req.params.storeId);

        const products = await prisma.$queryRaw`
            SELECT id, name, stock_quantity, low_stock_threshold, is_sold_out,
                CASE
                    WHEN stock_quantity = 0 THEN 'out'
                    WHEN stock_quantity <= low_stock_threshold THEN 'low'
                    ELSE 'ok'
                END as stock_status
            FROM products
            WHERE store_id = ${storeId}
              AND stock_quantity IS NOT NULL
              AND stock_quantity <= low_stock_threshold
            ORDER BY stock_quantity ASC
            LIMIT 20
        `;

        res.success({ alerts: products, count: products.length }, '저재고 알림 조회 완료');
    } catch (err) { next(err); }
};

module.exports = {
    getInventory,
    adjustStock,
    setStock,
    getStockHistory,
    getStoreStockHistory,
    getLowStockAlerts
};
