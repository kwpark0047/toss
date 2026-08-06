require('dotenv').config();
const prisma = require('../config/prisma');
const { dbLogger: logger } = require('../utils/logger');

function maskCardNumber(cardNumber) {
  if (!cardNumber) return null;
  const digits = String(cardNumber).replace(/\D/g, '');
  if (digits.length < 4) return null;
  const lastFour = digits.slice(-4);
  return `****-****-****-${lastFour}`;
}

async function backfillMaskCardNumbers() {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1])) : undefined;
  const mode = apply ? 'APPLY' : 'DRY-RUN';

  logger.info(`[Backfill] 기존 payments.card_number 마스킹 시작 (${mode})`);

  const raw = await prisma.payments.findMany({
    where: {
      card_number: { not: null },
    },
    select: { id: true, card_number: true },
    orderBy: { id: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  logger.info(`마스킹 후보 레코드: ${raw.length}개`, { total: raw.length });

  let updated = 0;
  let skipped = 0;
  let alreadyMasked = 0;

  for (const row of raw) {
    if (/^\*{4}-\*{4}-\*{4}-\d{4}$/.test(String(row.card_number))) {
      alreadyMasked++;
      continue;
    }

    const masked = maskCardNumber(row.card_number);
    if (!masked) {
      skipped++;
      continue;
    }

    if (apply) {
      await prisma.payments.update({
        where: { id: row.id },
        data: { card_number: masked, updated_at: new Date() },
      });
    }
    updated++;
  }

  logger.info('[Backfill] 완료', {
    mode,
    candidates: raw.length,
    updated: apply ? updated : 0,
    wouldUpdate: apply ? undefined : updated,
    alreadyMasked,
    skipped,
  });

  if (!apply && updated > 0) {
    logger.warn('실제 변경을 수행하려면 --apply 옵션을 명시하세요.');
  }
}

backfillMaskCardNumbers()
  .catch((e) => {
    logger.error({ error: e.message }, '[Backfill] 실패');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
