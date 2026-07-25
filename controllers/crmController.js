const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const aiService = require('../services/aiService');
const { sendSms } = require('../utils/smsService');
const logger = require('../utils/logger');

/**
 * RFM 세그먼트 기준
 * Champions    : 최근 방문 ≤ 7일,  방문횟수 ≥ 5,  총결제 ≥ 50000
 * Loyal        : 최근 방문 ≤ 30일, 방문횟수 ≥ 3,  총결제 ≥ 20000
 * At_Risk      : 최근 방문 > 60일, 방문횟수 ≥ 2
 * Lost         : 최근 방문 > 90일
 * New          : 방문횟수 = 1
 */
function classifySegment(customer) {
    const daysSinceLast = customer.last_visited_at
        ? Math.floor((Date.now() - new Date(customer.last_visited_at)) / 86400000)
        : 9999;
    const visits = customer.visit_count || 0;
    const spent = customer.total_spent || 0;

    if (daysSinceLast <= 7 && visits >= 5 && spent >= 50000) return 'Champions';
    if (daysSinceLast <= 30 && visits >= 3 && spent >= 20000) return 'Loyal';
    if (daysSinceLast > 90) return 'Lost';
    if (daysSinceLast > 60 && visits >= 2) return 'At_Risk';
    if (visits === 1) return 'New';
    return 'General';
}

/**
 * 1. 매장 전체 고객 RFM 분석
 * GET /api/crm/store/:storeId/analysis
 */
const getCustomerAnalysis = async (req, res, next) => {
    try {
        const { storeId } = req.params;

        const customers = await prisma.store_customers.findMany({
            where: { store_id: Number(storeId) },
            orderBy: { total_spent: 'desc' }
        });

        const segments = { Champions: 0, Loyal: 0, At_Risk: 0, Lost: 0, New: 0, General: 0 };
        const segmented = customers.map(c => {
            const segment = classifySegment(c);
            segments[segment]++;
            return { ...c, segment };
        });

        const totalRevenue = customers.reduce((s, c) => s + (c.total_spent || 0), 0);
        const avgSpent = customers.length ? Math.round(totalRevenue / customers.length) : 0;

        res.success({
            summary: {
                total_customers: customers.length,
                total_revenue: totalRevenue,
                avg_spent_per_customer: avgSpent,
                segments
            },
            customers: segmented
        }, 'CRM 고객 분석 완료');
    } catch (err) {
        next(err);
    }
};

/**
 * 2. 세그먼트별 고객 목록
 * GET /api/crm/store/:storeId/segment/:segmentName
 */
const getSegmentCustomers = async (req, res, next) => {
    try {
        const { storeId, segmentName } = req.params;

        const customers = await prisma.store_customers.findMany({
            where: { store_id: Number(storeId) }
        });

        const filtered = customers
            .map(c => ({ ...c, segment: classifySegment(c) }))
            .filter(c => c.segment === segmentName);

        res.success({ segment: segmentName, count: filtered.length, customers: filtered });
    } catch (err) {
        next(err);
    }
};

/**
 * 3. AI 스마트 마케팅 SMS 발송
 * POST /api/crm/store/:storeId/send-smart-sms
 * body: { segmentName, customMessage? }
 */
const sendSmartMarketingSms = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const { segmentName, customMessage } = req.body;

        if (!segmentName) return next(new AppError('segmentName이 필요합니다.', 400));

        const store = await prisma.stores.findUnique({ where: { id: Number(storeId) } });
        if (!store) return next(new AppError('매장을 찾을 수 없습니다.', 404));
        if (!store.can_send_sms) return next(new AppError('이 매장은 SMS 발송 권한이 없습니다.', 403));

        const customers = await prisma.store_customers.findMany({
            where: { store_id: Number(storeId) }
        });
        const targets = customers
            .map(c => ({ ...c, segment: classifySegment(c) }))
            .filter(c => c.segment === segmentName && c.customer_phone);

        if (!targets.length) {
            return res.success({ sent: 0 }, '발송 대상 고객이 없습니다.');
        }

        let message = customMessage;
        if (!message) {
            const segmentMessages = {
                Champions: `[${store.name}] 최고의 단골 고객님께 감사드립니다! 특별 혜택을 준비했어요 🎁`,
                Loyal: `[${store.name}] 자주 찾아주시는 고객님, 포인트 2배 적립 이벤트 중입니다!`,
                At_Risk: `[${store.name}] 오랫동안 뵙지 못했어요 😢 특별 할인 쿠폰을 드립니다.`,
                Lost: `[${store.name}] 다시 한번 찾아주세요! 재방문 고객 전용 10% 할인권 증정 🎟️`,
                New: `[${store.name}] 첫 방문 감사합니다! 다음 방문 시 음료 1잔 무료 제공 ☕`,
                General: `[${store.name}] 방문해 주셔서 감사합니다. 새로운 메뉴를 소개합니다!`
            };
            message = segmentMessages[segmentName] || `[${store.name}] 감사합니다.`;
        }

        // AI로 메시지 개선
        try {
            const improved = await aiService.translateText(
                `다음 SMS를 더 매력적이고 자연스럽게 개선해줘 (80자 이내): ${message}`,
                'ko'
            );
            if (improved && improved.length <= 80) message = improved;
        } catch (_) { /* AI 실패 시 기본 메시지 사용 */ }

        const phones = targets.map(c => c.customer_phone);
        setImmediate(async () => {
            let successCount = 0;
            let failCount = 0;
            for (const phone of phones) {
                try {
                    const result = await sendSms(phone, message);
                    if (result.sent || result.dev || result.fallback) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (smsErr) {
                    logger.error(`[CRM SMS] ${phone} 발송 실패:`, smsErr.message);
                    failCount++;
                }
            }
            logger.info(`[CRM SMS] ${store.name} → 성공 ${successCount}건, 실패 ${failCount}건`);
        });

        res.success({
            sent: phones.length,
            segment: segmentName,
            message,
            preview_phones: phones.slice(0, 3)
        }, `${phones.length}명에게 SMS 발송이 예약되었습니다.`);
    } catch (err) {
        next(err);
    }
};

module.exports = { getCustomerAnalysis, getSegmentCustomers, sendSmartMarketingSms };
