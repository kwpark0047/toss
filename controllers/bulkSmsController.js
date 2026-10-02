const prisma = require('../config/prisma');
const { sendSms } = require('../utils/smsService');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

const bulkSmsController = {
    // 필터링 옵션 조회
    getFilterOptions: catchAsync(async (req, res) => {
        if (req.user.role !== 'super_admin') return res.status(403).json({ error: '최고관리자만 접근 가능합니다.' });

        const stores = await prisma.stores.findMany({
            where: { is_active: true },
            select: { id: true, name: true, address: true, business_type: true }
        });

        const regions = [...new Set(stores.map(s => s.address?.split(' ')[0]).filter(Boolean))];
        const businessTypes = [...new Set(stores.map(s => s.business_type).filter(Boolean))];

        res.success({
            stores: stores.map(s => ({ id: s.id, name: s.name })),
            regions,
            businessTypes
        });
    }),

    // 필터링된 고객 목록 조회
    getFilteredCustomers: catchAsync(async (req, res) => {
        if (req.user.role !== 'super_admin') return res.status(403).json({ error: '최고관리자만 접근 가능합니다.' });

        const { storeId, region, businessType } = req.query;
        const where = {};
        if (storeId) where.store_id = parseInt(storeId);

        const storeWhere = {};
        if (region) storeWhere.address = { startsWith: region };
        if (businessType) storeWhere.business_type = businessType;

        // [성능] 이 엔드포인트는 화면용 미리보기이므로 최대 100건만 반환한다.
        // 이전 구현은 take 없이 전체 고객을 조회한 뒤 slice(0, 100) 으로 버려,
        // 고객 수가 많으면 DB→Node 메모리→폐기 구간에서 OOM/지연이 발생했다.
        // take 로 DB 레벨에서 제한하고, 총 건수는 별도 count 로 정확히 산출한다.
        const CUSTOMER_PREVIEW_LIMIT = 100;

        const customerWhere = {
            ...where,
            stores: Object.keys(storeWhere).length > 0 ? storeWhere : undefined
        };

        const [customers, totalCount] = await Promise.all([
            prisma.store_customers.findMany({
                where: customerWhere,
                include: {
                    stores: { select: { name: true, address: true, business_type: true } }
                },
                orderBy: { created_at: 'desc' },
                take: CUSTOMER_PREVIEW_LIMIT
            }),
            prisma.store_customers.count({ where: customerWhere })
        ]);

        res.success({
            count: totalCount,
            hasMore: totalCount > CUSTOMER_PREVIEW_LIMIT,
            customers
        });
    }),

    // Bulk SMS 발송
    sendBulkSms: catchAsync(async (req, res) => {
        if (req.user.role !== 'super_admin') return res.status(403).json({ error: '최고관리자만 접근 가능합니다.' });

        const { filters, message } = req.body;
        if (!message) return res.status(400).json({ error: '메시지 내용이 필요합니다.' });

        const { storeId, region, businessType } = filters || {};
        const where = {};
        if (storeId) where.store_id = parseInt(storeId);
        const storeWhere = {};
        if (region) storeWhere.address = { startsWith: region };
        if (businessType) storeWhere.business_type = businessType;

        const targets = await prisma.store_customers.findMany({
            where: {
                ...where,
                stores: Object.keys(storeWhere).length > 0 ? storeWhere : undefined
            },
            select: { customer_phone: true }
        });

        const uniquePhones = [...new Set(targets.map(t => t.customer_phone))];

        // 비동기 발송
        setImmediate(async () => {
            let sentCount = 0;
            for (const phone of uniquePhones) {
                try {
                    await sendSms(phone, message);
                    sentCount++;
                } catch (e) {
                    logger.error(`[BulkSMS] 발송 실패: ${phone}`, e.message);
                }
            }
            logger.info(`[BulkSMS] 발송 완료: ${sentCount}/${uniquePhones.length}`);
        });

        res.success({ targetCount: uniquePhones.length }, '발송이 시작되었습니다. 대량 발송의 경우 수 분이 소요될 수 있습니다.');
    })
};

module.exports = bulkSmsController;
