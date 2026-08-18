const Settlement = require('../repositories/Settlement');
const prisma = require('../config/prisma');
const Store = require('../repositories/Store');
const notificationService = require('../utils/notifications');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');

/**
 * 정산 CSV 생성
 */
function generateSettlementCSV(settlement, breakdown) {
  const lines = [];

  // 헤더 정보
  lines.push('정산 상세 명세서');
  lines.push('');
  lines.push(`매장명,${settlement.stores?.name || ''}`);
  lines.push(`사업자번호,${settlement.stores?.business_number || ''}`);
  lines.push(`대표자명,${settlement.stores?.ceo_name || ''}`);
  lines.push(
    `정산 기간,${settlement.period_start.toISOString().split('T')[0]} ~ ${settlement.period_end.toISOString().split('T')[0]}`
  );
  lines.push(`집계 일시,${new Date(settlement.created_at).toLocaleString('ko-KR')}`);
  lines.push(`정산 상태,${settlement.status}`);
  lines.push(`세금계산서 번호,${settlement.tax_invoice_number || '미발행'}`);
  lines.push('');

  // 매출 요약
  lines.push('매출 요약');
  lines.push('구분,금액');
  lines.push(`총 매출액,${settlement.total_sales}`);
  lines.push(`총 환불액,${settlement.total_refunds}`);
  lines.push(
    `순 매출액,${settlement.net_sales ?? settlement.total_sales - settlement.total_refunds}`
  );
  lines.push('');

  // 수수료 상세
  lines.push('수수료 상세');
  lines.push('구분,금액');
  lines.push(`수수료 공급가액,${settlement.commission_ex_vat}`);
  lines.push(`수수료 부가세(10%),${settlement.commission_vat}`);
  lines.push(`총 공제 수수료,${settlement.commission_amount}`);
  lines.push('');

  // 최종 수취액
  lines.push('최종 수취액');
  lines.push('구분,금액');
  lines.push(`점주 최종 수취액,${settlement.net_amount}`);
  lines.push('');

  // 결제수단별 분해
  if (Object.keys(breakdown).length > 0) {
    lines.push('결제수단별 매출 분해');
    lines.push('결제수단,금액');
    const methodLabels = {
      cash: '현금',
      store_card: '매장 카드',
      transfer: '계좌이체',
      kakao: '카카오페이',
      naver: '네이버페이',
      toss_pay: '토스페이먼츠',
      point: '포인트',
      mixed: '혼합',
    };
    for (const [method, amount] of Object.entries(breakdown)) {
      const label = methodLabels[method] || method;
      lines.push(`${label},${amount}`);
    }
  }

  return lines.join('\n');
}

const settlementController = {
  // 매장별 정산 목록 조회
  getStoreSettlements: catchAsync(async (req, res) => {
    const list = await Settlement.findByStore(req.params.storeId);
    res.success(list);
  }),

  // 정산 생성 (관리자용)
  generateSettlement: catchAsync(async (req, res) => {
    const { period_start, period_end } = req.body;

    // 입력 검증
    if (!period_start || !period_end) {
      throw new AppError('정산 기간(시작일, 종료일)은 필수입니다.', 400);
    }

    const start = new Date(period_start);
    const end = new Date(period_end);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('올바르지 않은 날짜 형식입니다. (YYYY-MM-DD)', 400);
    }

    if (start > end) {
      throw new AppError('시작일은 종료일보다 이전이어야 합니다.', 400);
    }

    // 미래 날짜 제한 (당일 포함)
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (start > today) {
      throw new AppError('미래 날짜의 정산은 생성할 수 없습니다.', 400);
    }

    const settlement = await Settlement.create({
      store_id: req.params.storeId,
      period_start,
      period_end,
    });

    const io = req.app.get('io');
    const store = await Store.findById(req.params.storeId);
    if (store) {
      const users = await prisma.users.findMany({ where: { id: store.user_id } });
      const managerTokens = users.map((u) => u.fcm_token).filter((t) => t);
      notificationService.sendSettlementNotification(
        io,
        store,
        {
          period_start,
          period_end,
          net_amount: settlement.net_amount,
        },
        managerTokens
      );
    }

    res.success({ settlement }, '정산이 생성되었습니다');
  }),

  // 정산 상태 업데이트 (상태 전이 검증 포함)
  updateStatus: catchAsync(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'COMPLETED', 'PAID', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new AppError('유효하지 않은 상태값입니다.', 400);
    }

    // 현재 정산 조회
    const existing = await prisma.settlements.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!existing) throw new AppError('정산 내역을 찾을 수 없습니다.', 404);

    // 상태 전이 검증
    const invalidTransitions = {
      CANCELLED: ['PENDING', 'COMPLETED', 'PAID', 'CANCELLED'],
      PAID: ['PENDING', 'COMPLETED', 'PAID', 'CANCELLED'],
    };

    if (invalidTransitions[existing.status]?.includes(status)) {
      throw new AppError(
        `이미 ${existing.status} 상태인 정산은 ${status}로 변경할 수 없습니다.`,
        400
      );
    }

    // PENDING에서는 COMPLETED, CANCELLED만 허용
    if (existing.status === 'PENDING' && !['COMPLETED', 'CANCELLED'].includes(status)) {
      throw new AppError('대기 중인 정산은 완료 또는 취소만 가능합니다.', 400);
    }

    // COMPLETED에서는 PAID, CANCELLED만 허용
    if (existing.status === 'COMPLETED' && !['PAID', 'CANCELLED'].includes(status)) {
      throw new AppError('완료된 정산은 지급 완료 또는 취소만 가능합니다.', 400);
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

  // 정산 상세 조회 (CSV 다운로드 지원)
  getSettlementDetails: catchAsync(async (req, res) => {
    const settlement = await prisma.settlements.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        stores: {
          select: {
            name: true,
            business_type: true,
            business_name: true,
            business_number: true,
            ceo_name: true,
          },
        },
      },
    });
    if (!settlement) throw new AppError('정산 내역을 찾을 수 없습니다.', 404);

    let breakdown = {};
    try {
      breakdown = JSON.parse(settlement.payment_method_breakdown || '{}');
    } catch {}

    // CSV 다운로드 요청 시 CSV 반환
    if (req.query.format === 'csv') {
      const csv = generateSettlementCSV(settlement, breakdown);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="settlement_${settlement.id}_${settlement.period_start.toISOString().split('T')[0]}_${settlement.period_end.toISOString().split('T')[0]}.csv"`
      );
      return res.send('\uFEFF' + csv); // BOM for Excel
    }

    res.success({ ...settlement, breakdown });
  }),

  // 정산 삭제 (PENDING 상태만 가능)
  deleteSettlement: catchAsync(async (req, res) => {
    await deleteSettlementFn(req.params.id);
    res.success(null, '정산이 삭제되었습니다.');
  }),
};

async function deleteSettlementFn(settlementId) {
  const existing = await prisma.settlements.findUnique({
    where: { id: parseInt(settlementId) },
  });
  if (!existing) throw new AppError('정산 내역을 찾을 수 없습니다.', 404);

  if (existing.status !== 'PENDING') {
    throw new AppError('대기 중인 정산만 삭제할 수 있습니다.', 400);
  }

  await prisma.settlements.delete({ where: { id: parseInt(settlementId) } });
  return true;
}

module.exports = settlementController;
