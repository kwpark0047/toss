const prisma = require('../config/prisma');

/**
 * [Settlement 모델]
 *
 * 정산 흐름:
 *   고객 결제 → 플랫폼 수령 → 수수료(공급가액) + 수수료 부가세(10%) 차감 → 점주 지급
 *
 * 법적 계산 구조 (부가가치세법 준수):
 *   순매출    = 총매출 - 환불
 *   수수료    = 순매출 × commission_rate          (공급가액, 세금계산서 발행 기준)
 *   수수료VAT = 수수료 × 0.10                     (플랫폼→점주 세금계산서 부가세)
 *   총수수료  = 수수료 + 수수료VAT
 *   점주수취  = 순매출 - 총수수료
 *
 * ※ 점주 매출의 부가세(10%)는 점주가 국세청에 직접 신고하며 이 시스템 범위 외입니다.
 */

/**
 * 세금계산서 번호 생성: YYYYMMDD-{storeId}-{seq}
 */
async function generateTaxInvoiceNumber(storeId) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.settlements.count({
        where: { store_id: parseInt(storeId), tax_invoice_number: { not: null } }
    });
    return `${today}-${storeId}-${String(count + 1).padStart(4, '0')}`;
}

const Settlement = {
    /**
     * 정산 생성
     * commission_rate / vat_rate는 stores 테이블에서 읽어 스냅샷 저장
     */
    create: async (data) => {
        const { store_id, period_start, period_end } = data;
        const start = new Date(period_start);
        const end = new Date(period_end);
        end.setHours(23, 59, 59, 999);

        // 매장 설정에서 수수료율·부가세율 읽기
        const store = await prisma.stores.findUnique({
            where: { id: parseInt(store_id) },
            select: { commission_rate: true, vat_rate: true }
        });
        const commissionRate = store?.commission_rate ?? 0.03;
        const vatRate = store?.vat_rate ?? 0.10;

        // 장부 데이터 집계 (결제수단별 분리)
        const stats = await prisma.ledger.groupBy({
            by: ['type', 'method'],
            where: {
                store_id: parseInt(store_id),
                created_at: { gte: start, lte: end }
            },
            _sum: { amount: true }
        });

        let totalSales = 0;
        let totalRefunds = 0;
        const breakdown = {};

        stats.forEach(stat => {
            const method = stat.method || 'unknown';
            const amt = stat._sum.amount || 0;
            if (stat.type === 'INCOME') {
                totalSales += amt;
                breakdown[method] = (breakdown[method] || 0) + amt;
            }
            if (stat.type === 'REFUND') {
                totalRefunds += Math.abs(amt);
            }
        });

        // ── 법적 계산 ──────────────────────────────────────────────
        const netSales = totalSales - totalRefunds;
        const commissionExVat = Math.floor(netSales * commissionRate);          // 수수료 공급가액
        const commissionVat = Math.floor(commissionExVat * vatRate);            // 수수료 부가세
        const totalCommission = commissionExVat + commissionVat;                // 점주 부담 총 수수료
        const netAmount = netSales - totalCommission;                           // 점주 최종 수취액

        const settlement = await prisma.settlements.create({
            data: {
                store_id: parseInt(store_id),
                period_start: start,
                period_end: end,
                total_sales: totalSales,
                total_refunds: totalRefunds,
                commission_ex_vat: commissionExVat,
                commission_vat: commissionVat,
                commission_amount: totalCommission,
                vat_amount: commissionVat,                    // 레거시 호환 필드
                net_amount: netAmount,
                commission_rate_snapshot: commissionRate,
                vat_rate_snapshot: vatRate,
                payment_method_breakdown: JSON.stringify(breakdown),
                status: 'PENDING'
            }
        });

        return {
            ...settlement,
            breakdown,
            _calc: { netSales, commissionRate, vatRate, commissionExVat, commissionVat, totalCommission, netAmount }
        };
    },

    /**
     * 세금계산서 발행 (COMPLETED 이상 상태에서만 허용)
     */
    issueTaxInvoice: async (settlementId) => {
        const s = await prisma.settlements.findUnique({ where: { id: parseInt(settlementId) } });
        if (!s) throw new Error('정산 내역을 찾을 수 없습니다.');
        if (s.status === 'PENDING') throw new Error('완료되지 않은 정산은 세금계산서를 발행할 수 없습니다.');
        if (s.tax_invoice_number) return s; // 이미 발행됨 (멱등성)

        const taxInvoiceNumber = await generateTaxInvoiceNumber(s.store_id);
        return await prisma.settlements.update({
            where: { id: parseInt(settlementId) },
            data: { tax_invoice_number: taxInvoiceNumber, tax_invoice_issued_at: new Date() }
        });
    },

    /**
     * 매장별 정산 내역 조회
     */
    findByStore: async (storeId) => {
        return await prisma.settlements.findMany({
            where: { store_id: parseInt(storeId) },
            orderBy: { period_end: 'desc' }
        });
    },

    /**
     * 정산 상태 업데이트
     */
    updateStatus: async (id, status) => {
        const data = { status };
        if (['COMPLETED', 'PAID'].includes(status)) {
            data.paid_at = new Date();
        }
        return await prisma.settlements.update({
            where: { id: parseInt(id) },
            data
        });
    }
};

module.exports = Settlement;
