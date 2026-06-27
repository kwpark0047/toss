const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');

/**
 * 직원 성과 점수 계산
 * - 처리 주문 수 × 10점
 * - 완료 주문 중 신속 처리(15분 이내) × 5점 보너스
 * - 평균 처리 시간 (낮을수록 좋음)
 */
async function calcStaffScore(storeId, staffId, since) {
    const orders = await prisma.orders.findMany({
        where: {
            store_id: Number(storeId),
            handled_by_staff_id: Number(staffId),
            created_at: { gte: since },
            status: { in: ['completed', 'ready'] }
        },
        select: {
            id: true,
            created_at: true,
            ready_at: true,
            completed_at: true,
            total_amount: true,
            status: true
        }
    });

    let totalScore = 0;
    let fastCount = 0;
    let totalMinutes = 0;
    let validTimes = 0;

    for (const o of orders) {
        totalScore += 10;
        const endTime = o.completed_at || o.ready_at;
        if (endTime && o.created_at) {
            const minutes = (new Date(endTime) - new Date(o.created_at)) / 60000;
            totalMinutes += minutes;
            validTimes++;
            if (minutes <= 15) {
                totalScore += 5;
                fastCount++;
            }
        }
    }

    const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
    const avgMinutes = validTimes ? Math.round(totalMinutes / validTimes) : null;

    return {
        order_count: orders.length,
        fast_order_count: fastCount,
        total_score: totalScore,
        total_revenue: totalRevenue,
        avg_processing_minutes: avgMinutes
    };
}

/**
 * 1. 매장 직원 성과 리더보드
 * GET /api/staff-gamification/store/:storeId/leaderboard
 * query: days=30 (기간, 기본 30일)
 */
const getLeaderboard = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const { days = 30 } = req.query;
        const since = new Date(Date.now() - Number(days) * 86400000);

        const staffList = await prisma.staff.findMany({
            where: { store_id: Number(storeId) },
            include: { users: { select: { id: true, name: true, email: true } } }
        });

        if (!staffList.length) {
            return res.success({ leaderboard: [], period_days: Number(days) }, '등록된 직원이 없습니다.');
        }

        const results = await Promise.all(
            staffList.map(async (s) => {
                const score = await calcStaffScore(storeId, s.user_id, since);
                return {
                    staff_id: s.id,
                    user_id: s.user_id,
                    name: s.users?.name || '알 수 없음',
                    email: s.users?.email,
                    role: s.role,
                    ...score
                };
            })
        );

        const ranked = results
            .sort((a, b) => b.total_score - a.total_score)
            .map((r, i) => ({
                rank: i + 1,
                badge: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '',
                ...r
            }));

        res.success({ leaderboard: ranked, period_days: Number(days) }, '직원 리더보드 조회 완료');
    } catch (err) {
        next(err);
    }
};

/**
 * 2. 특정 직원 상세 성과
 * GET /api/staff-gamification/store/:storeId/performance/:staffId
 * query: days=30
 */
const getStaffDetailPerformance = async (req, res, next) => {
    try {
        const { storeId, staffId } = req.params;
        const { days = 30 } = req.query;
        const since = new Date(Date.now() - Number(days) * 86400000);

        const staffMember = await prisma.staff.findFirst({
            where: { id: Number(staffId), store_id: Number(storeId) },
            include: { users: { select: { id: true, name: true, email: true } } }
        });
        if (!staffMember) return next(new AppError('직원을 찾을 수 없습니다.', 404));

        const score = await calcStaffScore(storeId, staffMember.user_id, since);

        // 일별 처리 주문 수 (최근 7일)
        const recent7 = new Date(Date.now() - 7 * 86400000);
        const recentOrders = await prisma.orders.findMany({
            where: {
                store_id: Number(storeId),
                handled_by_staff_id: Number(staffMember.user_id),
                created_at: { gte: recent7 }
            },
            select: { created_at: true, status: true }
        });

        const dailyMap = {};
        for (const o of recentOrders) {
            const d = o.created_at?.toISOString().split('T')[0];
            if (!d) continue;
            dailyMap[d] = (dailyMap[d] || 0) + 1;
        }
        const daily_trend = Object.entries(dailyMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, count]) => ({ date, count }));

        res.success({
            staff: {
                staff_id: staffMember.id,
                name: staffMember.users?.name,
                email: staffMember.users?.email,
                role: staffMember.role
            },
            period_days: Number(days),
            performance: score,
            daily_trend
        }, '직원 상세 성과 조회 완료');
    } catch (err) {
        next(err);
    }
};

module.exports = { getLeaderboard, getStaffDetailPerformance };
