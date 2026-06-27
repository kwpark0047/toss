const prisma = require('../config/prisma');

/**
 * 장부 모델 (Prisma 기반)
 * 매장의 모든 금전적 흐름(결제, 취소, 포인트 지출 등)을 기록하고 통계를 제공합니다.
 */
const Ledger = {
    // [트랜잭션 기록 추가]
    add: async (data) => {
        const {
            store_id, order_id, payment_id, type,
            category, amount, method, description
        } = data;

        return await prisma.ledger.create({
            data: {
                store_id: parseInt(store_id),
                order_id: order_id ? parseInt(order_id) : null,
                payment_id: payment_id ? parseInt(payment_id) : null,
                type,
                category,
                amount: parseInt(amount),
                method,
                description
            }
        });
    },

    // [특정 매장/기간의 장부 조회]
    findByStore: async (storeId, startDate, endDate) => {
        const where = { store_id: parseInt(storeId) };

        if (startDate || endDate) {
            where.created_at = {};
            if (startDate) where.created_at.gte = new Date(startDate);
            if (endDate) where.created_at.lte = new Date(endDate);
        }

        return await prisma.ledger.findMany({
            where,
            orderBy: { created_at: 'desc' },
            include: {
                orders: { select: { order_number: true } },
                payments: { select: { payment_key: true } }
            }
        });
    },

    // [매출 통계 요약]
    getSummary: async (storeId, startDate, endDate) => {
        const where = {
            store_id: parseInt(storeId),
            created_at: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        };

        const result = await prisma.ledger.findMany({ where });

        const summary = result.reduce((acc, curr) => {
            if (curr.type === 'INCOME') acc.total_income += curr.amount;
            if (curr.type === 'REFUND') acc.total_refund += curr.amount;
            if (curr.category === 'POINT_USE') acc.total_point_expense += curr.amount;
            acc.transaction_count++;
            return acc;
        }, {
            total_income: 0,
            total_refund: 0,
            total_point_expense: 0,
            transaction_count: 0
        });

        return summary;
    }
};

module.exports = Ledger;
