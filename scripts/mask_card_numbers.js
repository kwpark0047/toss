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

  // [보안] 접속 대상 DB 표시(자격증명 제외) - 실행 전 실수 여부 확인용
  let dbTarget = '알 수 없음(DATABASE_URL 미설정)';
  try {
    const url = new URL(process.env.DATABASE_URL || '');
    dbTarget = `${url.hostname}/${url.pathname.replace(/^\//, '')}`;
  } catch {
    // DATABASE_URL 파싱 실패 시 기본값 유지
  }

  logger.info(`[Backfill] 기존 payments.card_number 마스킹 시작 (${mode})`, { db: dbTarget });

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
    logger.warn('실제 변경을 수행하려면 --apply 옵션을 명시하세요(운영 환경은 --yes도 필요).');
  }
}

backfillMaskCardNumbers()
  .catch((e) => {
    logger.error({ error: e.message }, '[Backfill] 실패');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
