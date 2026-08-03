require('dotenv').config();
const prisma = require('../config/prisma');
const { dbLogger: logger } = require('../utils/logger');

function maskCardNumber(cardNumber) {
  if (!cardNumber) return null;
  const digits = String(cardNumber).replace(/\D/g, '');
  const lastFour = digits.slice(-4);
  return `****-****-****-${lastFour}`;
}

async function backfillMaskCardNumbers() {
  logger.info('[Backfill] 기존 payments.card_number 평문 데이터 마스킹 시작');

  const raw = await prisma.payments.findMany({
    where: {
      card_number: { not: null },
      NOT: { card_number: { startsWith: '****-' } },
    },
    select: { id: true, card_number: true },
  });

  logger.info({ total: raw.length }, `마스킹 대상 레코드: ${raw.length}개`);

  let updated = 0;
  let skipped = 0;

  for (const row of raw) {
    const masked = maskCardNumber(row.card_number);
    if (!masked) {
      skipped++;
      continue;
    }

    await prisma.payments.update({
      where: { id: row.id },
      data: { card_number: masked, updated_at: new Date() },
    });
    updated++;
  }

  logger.info({ updated, skipped, total: raw.length }, '[Backfill] 완료');
}

backfillMaskCardNumbers()
  .catch((e) => {
    logger.error({ error: e.message }, '[Backfill] 실패');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
