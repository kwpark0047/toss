const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const aiService = require('../services/aiService');

/**
 * 1. 매장 메뉴 판매 분석
 * GET /api/menu-optimization/store/:storeId/analysis
 */
const getMenuAnalysis = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const { days = 30 } = req.query;

        const since = new Date(Date.now() - Number(days) * 86400000);

        // 기간 내 주문 아이템 집계
        const items = await prisma.order_items.findMany({
            where: {
                orders: {
                    store_id: Number(storeId),
                    created_at: { gte: since },
                    status: { not: 'cancelled' }
                }
            },
            include: { products: true }
        });

        // 상품별 판매 집계
        const productMap = {};
        for (const item of items) {
            const pid = item.product_id || item.product_name;
            if (!productMap[pid]) {
                productMap[pid] = {
                    product_id: item.product_id,
                    product_name: item.product_name,
                    price: item.price,
                    total_quantity: 0,
                    total_revenue: 0,
                    order_count: 0
                };
            }
            productMap[pid].total_quantity += item.quantity;
            productMap[pid].total_revenue += item.subtotal || (item.price * item.quantity);
            productMap[pid].order_count++;
        }

        const ranked = Object.values(productMap)
            .sort((a, b) => b.total_revenue - a.total_revenue);

        const totalRevenue = ranked.reduce((s, p) => s + p.total_revenue, 0);

        // 매출 기여도 및 등급 분류 (ABC 분석)
        let cumulative = 0;
        const analyzed = ranked.map((p, i) => {
            cumulative += p.total_revenue;
            const share = totalRevenue ? ((p.total_revenue / totalRevenue) * 100).toFixed(1) : 0;
            const cumulativeShare = totalRevenue ? ((cumulative / totalRevenue) * 100).toFixed(1) : 0;
            return {
                rank: i + 1,
                ...p,
                revenue_share: Number(share),
                cumulative_share: Number(cumulativeShare),
                grade: cumulativeShare <= 70 ? 'A' : cumulativeShare <= 90 ? 'B' : 'C'
            };
        });

        res.success({
            period_days: Number(days),
            total_revenue: totalRevenue,
            total_items_sold: items.reduce((s, i) => s + i.quantity, 0),
            products: analyzed
        }, '메뉴 최적화 분석 완료');
    } catch (err) {
        next(err);
    }
};

/**
 * 2. AI 기반 세트 메뉴 제안
 * GET /api/menu-optimization/store/:storeId/proposal
 */
const proposeSetMenus = async (req, res, next) => {
    try {
        const { storeId } = req.params;

        // 최근 30일 판매 데이터
        const since = new Date(Date.now() - 30 * 86400000);
        const orders = await prisma.orders.findMany({
            where: {
                store_id: Number(storeId),
                created_at: { gte: since },
                status: { not: 'cancelled' }
            },
            include: { order_items: true }
        });

        // 같이 주문된 메뉴 조합 집계 (페어링 분석)
        const pairCount = {};
        for (const order of orders) {
            const names = order.order_items.map(i => i.product_name);
            for (let i = 0; i < names.length; i++) {
                for (let j = i + 1; j < names.length; j++) {
                    const key = [names[i], names[j]].sort().join(' + ');
                    pairCount[key] = (pairCount[key] || 0) + 1;
                }
            }
        }

        const topPairs = Object.entries(pairCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([pair, count]) => ({ pair, count }));

        // 전체 메뉴 목록
        const products = await prisma.products.findMany({
            where: { store_id: Number(storeId) },
            select: { id: true, name: true, price: true, category_id: true }
        });

        // AI 세트 메뉴 제안
        let aiProposal = null;
        try {
            const menuList = products.map(p => p.name).join(', ');
            const pairList = topPairs.map(p => p.pair).join('; ');
            const prompt = `
다음은 식당 메뉴와 자주 함께 주문된 조합입니다.
메뉴: ${menuList}
인기 조합: ${pairList}

위 데이터를 바탕으로 3가지 세트 메뉴를 제안해주세요.
각 세트는 JSON 배열로 반환해주세요:
[{"name":"세트명","items":["메뉴1","메뉴2"],"price":가격,"description":"설명"}]
JSON만 반환하고 다른 설명은 쓰지 마세요.`;
            const raw = await aiService.generateWithFallback(prompt);
            const match = raw.match(/\[[\s\S]*\]/);
            if (match) aiProposal = JSON.parse(match[0]);
        } catch (_) { /* AI 실패 시 null */ }

        res.success({
            top_pairs: topPairs,
            ai_set_proposals: aiProposal,
            products_count: products.length
        }, '세트 메뉴 제안 완료');
    } catch (err) {
        next(err);
    }
};

module.exports = { getMenuAnalysis, proposeSetMenus };
