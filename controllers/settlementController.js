const Settlement = require('../repositories/Settlement');
const prisma = require('../config/prisma');
const Store = require('../repositories/Store');
const notificationService = require('../utils/notifications');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');

const settlementController = {
    // 매장별 정산 목록 조회
    getStoreSettlements: catchAsync(async (req, res) => {
        const list = await Settlement.findByStore(req.params.storeId);
        res.success(list);
    }),

    // 정산 생성 (관리자용)
    generateSettlement: catchAsync(async (req, res) => {
        const { period_start, period_end } = req.body;
        const settlement = await Settlement.create({ store_id: req.params.storeId, period_start, period_end });

        const io = req.app.get('io');
        const store = await Store.findById(req.params.storeId);
        if (store) {
            const users = await prisma.users.findMany({ where: { id: store.user_id } });
            const managerTokens = users.map(u => u.fcm_token).filter(t => t);
            notificationService.sendSettlementNotification(io, store, {
                period_start,
                period_end,
                net_amount: settlement.net_amount
            }, managerTokens);
        }

        res.success({ settlement }, '정산이 생성되었습니다');
    }),

    // 정산 상태 업데이트
    updateStatus: catchAsync(async (req, res) => {
        const { status } = req.body;
        if (!['PENDING', 'COMPLETED', 'PAID', 'CANCELLED'].includes(status)) {
            throw new AppError('유효하지 않은 상태값입니다.', 400);
        }

        const updated = await Settlement.updateStatus(req.params.id, status);
        if (!updated) throw new AppError('정산 내역을 찾을 수 없습니다.', 404);

        res.success(updated, '정산 상태가 업데이트되었습니다.');
    }),

    // 세금계산서 발행
    issueTaxInvoice: catchAsync(async (req, res) => {
        const updated = await Settlement.issueTaxInvoice(req.params.id);
        res.success(updated, `세금계산서가 발행되었습니다. (${updated.tax_invoice_number})`);
    }),

    // 정산 상세 조회
    getSettlementDetails: catchAsync(async (req, res) => {
        const settlement = await prisma.settlements.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { stores: { select: { name: true, business_type: true, business_name: true, business_number: true, ceo_name: true } } }
        });
        if (!settlement) throw new AppError('정산 내역을 찾을 수 없습니다.', 404);

        let breakdown = {};
        try { breakdown = JSON.parse(settlement.payment_method_breakdown || '{}'); } catch {}

        res.success({ ...settlement, breakdown });
    })
};

module.exports = settlementController;
