/**
 * settlementAutomationService.js
 * 정산 자동화 스케줄러 — 매장 정산 주기(DAILY|WEEKLY|MONTHLY)에 따라
 * 직전 완료 기간의 정산을 자동 생성하고, 신규 생성 시 DB 알림을 발송한다.
 *
 * - 스케줄: 10분 간격 폴링 → 과거 기간 정산이므로 멱등(Settlement.create)이라
 *   프로세스 재시작·다중 인스턴스에도 안전. 이미 존재하면 스킵.
 * - 정산 기간: KST 기준 직전 기간 (DAILY=어제 / WEEKLY=지난 월~일 / MONTHLY=지난 달력월)
 * - MANUAL 주기 매장은 자동 생성을 하지 않는다.
 */
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const Settlement = require('../repositories/Settlement');
const notificationService = require('./notificationService');
const { kstNow, KST_OFFSET_MS } = require('../utils/kstTime');

const POLL_INTERVAL_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** 현재 주기의 직전 완료 기간을 KST 기준으로 계산해 ISO 문자열로 반환 */
function getLastCyclePeriod(reference = kstNow(), cycle = 'MONTHLY') {
  const KST = KST_OFFSET_MS;
  const startOfTodayKst = Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()) - KST;

  if (cycle === 'DAILY') {
    return {
      period_start: new Date(startOfTodayKst - DAY_MS).toISOString(),
      period_end: new Date(startOfTodayKst - 1).toISOString(),
    };
  }
  if (cycle === 'WEEKLY') {
    const dow = (reference.getUTCDay() + 6) % 7; // KST 요일 기준, 월=0 … 일=6
    const thisWeekStartUtc = startOfTodayKst - dow * DAY_MS;
    return {
      period_start: new Date(thisWeekStartUtc - WEEK_MS).toISOString(),
      period_end: new Date(thisWeekStartUtc - 1).toISOString(),
    };
  }
  const thisMonthStartUtc = Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1) - KST;
  return {
    period_start: new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 1) - KST).toISOString(),
    period_end: new Date(thisMonthStartUtc - 1).toISOString(),
  };
}

/** 전체 매장 순회 → 직전 기간 정산 자동 생성 (멱등) */
async function runCycle(reference = kstNow()) {
  const stores = await prisma.stores.findMany({
    where: { is_active: true },
    select: { id: true },
  });
  if (stores.length === 0) return { created: 0, skipped: 0 };

  const configs = await prisma.store_settlement_config.findMany();
  const configByStore = new Map(configs.map((c) => [c.store_id, c]));

  let created = 0;
  let skipped = 0;
  for (const { id } of stores) {
    const cycle = configByStore.get(id)?.settlement_cycle || 'MONTHLY';
    if (cycle === 'MANUAL') {
      skipped++;
      continue;
    }
    const { period_start, period_end } = getLastCyclePeriod(reference, cycle);
    try {
      const result = await Settlement.create({ store_id: id, period_start, period_end });
      if (result && result._calc) {
        await notificationService.notifySettlementDB(result);
        created++;
      } else {
        skipped++;
      }
    } catch (err) {
      logger.warn(`[정산자동화] store ${id} 생성 생략: ${err.message}`);
      skipped++;
    }
  }
  logger.info(`[정산자동화] 완료 — ${created}건 자동 생성, ${skipped}건 스킵`);
  return { created, skipped };
}

let timer = null;

function start() {
  if (timer) return;
  timer = setInterval(async () => {
    try {
      await runCycle();
    } catch (err) {
      logger.error(`[정산자동화] 실행 오류: ${err.message}`);
    }
  }, POLL_INTERVAL_MS);
  timer.unref();
  logger.info('[정산자동화] 스케줄러 등록 완료 (10분 폴링, 멱등)');
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop, runCycle, getLastCyclePeriod };