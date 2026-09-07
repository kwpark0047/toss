require('dotenv').config();
const prisma = require('../config/prisma');
const { dbLogger: logger } = require('../utils/logger');

function mapOrderStatus(status) {
  const map = {
    pending: 'pending',
    confirmed: 'confirmed',
    preparing: 'preparing',
    ready: 'ready',
    completed: 'completed',
    cancelled: 'cancelled',
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PREPARING: 'preparing',
    READY: 'ready',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  };
  return map[status] || status;
}

function mapOrderPaymentStatus(status) {
  const map = {
    pending: 'pending',
    paid: 'paid',
    partial: 'partial',
    failed: 'failed',
    refunded: 'refunded',
    PENDING: 'pending',
    PAID: 'paid',
    PARTIAL: 'partial',
    FAILED: 'failed',
    REFUNDED: 'refunded',
  };
  return map[status] || status;
}

function mapPaymentTxStatus(status) {
  const map = {
    pending: 'pending',
    READY: 'READY',
    DONE: 'DONE',
    CANCELED: 'CANCELED',
    PARTIAL_CANCELED: 'PARTIAL_CANCELED',
    PENDING: 'pending',
    READY: 'READY',
    DONE: 'DONE',
    CANCELED: 'CANCELED',
    PARTIAL_CANCELED: 'PARTIAL_CANCELED',
  };
  return map[status] || status;
}

async function backfillEnums() {
  const apply = process.argv.includes('--apply');
  const yes = process.argv.includes('--yes');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limitValue = limitArg ? Number(limitArg.split('=')[1]) : NaN;
  const limit = Number.isInteger(limitValue) && limitValue > 0 ? limitValue : undefined;
  if (limitArg && !limit) {
    throw new Error(`잘못된 --limit 값: ${limitArg} (양의 정수 필요, 예: --limit=100)`);
  }
  const mode = apply ? 'APPLY' : 'DRY-RUN';

  // [보안] 운영 환경 실수 변경 방지: --apply에 더해 --yes 이중 확인 요구
  if (apply && process.env.NODE_ENV === 'production' && !yes) {
    throw new Error('운영 환경(NODE_ENV=production)에서는 --apply와 함께 --yes 옵션이 필요합니다.');
  }

  let dbTarget = '알 수 없음(DATABASE_URL 미설정)';
  try {
    const url = new URL(process.env.DATABASE_URL || '');
    dbTarget = `${url.hostname}/${url.pathname.replace(/^\//, '')}`;
  } catch {}

  logger.info(`[Enum Migration] 기존 상태 필드 타입 변환 시작 (${mode})`, { db: dbTarget });

  // 1) orders 테이블: status 문자열 → enum 변환
  const rawOrders = await prisma.orders.findMany({
    where: {
      status: { not: null },
    },
    select: { id: true, status: true, payment_status: true },
    orderBy: { id: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  logger.info(`주문 레코드: ${rawOrders.length}개`, { total: rawOrders.length });

  let updatedOrders = 0;
  let skippedOrders = 0;

  for (const row of rawOrders) {
    let needsUpdate = false;
    const newData = {};

    if (row.status && row.status !== mapOrderStatus(row.status)) {
      newData.status = mapOrderStatus(row.status);
      needsUpdate = true;
    }

    if (row.payment_status && row.payment_status !== mapOrderPaymentStatus(row.payment_status)) {
      newData.payment_status = mapOrderPaymentStatus(row.payment_status);
      needsUpdate = true;
    }

    if (needsUpdate) {
      if (apply) {
        await prisma.orders.update({
          where: { id: row.id },
          data: { ...newData, updated_at: new Date() },
        });
      }
      updatedOrders++;
    } else {
      skippedOrders++;
    }
  }

  // 2) payments 테이블: status 문자열 → enum 변환
  const rawPayments = await prisma.payments.findMany({
    where: {
      status: { not: null },
    },
    select: { id: true, status: true },
    orderBy: { id: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  logger.info(`결제 레코드: ${rawPayments.length}개`, { total: rawPayments.length });

  let updatedPayments = 0;
  let skippedPayments = 0;

  for (const row of rawPayments) {
    let needsUpdate = false;
    const newData = {};

    if (row.status && row.status !== mapPaymentTxStatus(row.status)) {
      newData.status = mapPaymentTxStatus(row.status);
      needsUpdate = true;
    }

    if (needsUpdate) {
      if (apply) {
        await prisma.payments.update({
          where: { id: row.id },
          data: { ...newData, updated_at: new Date() },
        });
      }
      updatedPayments++;
    } else {
      skippedPayments++;
    }
  }

  logger.info('[Enum Migration] 완료', {
    mode,
    orders: {
      candidates: rawOrders.length,
      updated: apply ? updatedOrders : 0,
      wouldUpdate: apply ? undefined : updatedOrders,
      skipped: skippedOrders,
    },
    payments: {
      candidates: rawPayments.length,
      updated: apply ? updatedPayments : 0,
      wouldUpdate: apply ? undefined : updatedPayments,
      skipped: skippedPayments,
    },
  });

  if ((!apply && updatedOrders > 0) || updatedPayments > 0) {
    logger.warn('실제 변경을 수행하려면 --apply 옵션을 명시하세요(운영 환경은 --yes도 필요).');
  }
}

backfillEnums()
  .catch((e) => {
    logger.error({ error: e.message }, '[Enum Migration] 실패');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
