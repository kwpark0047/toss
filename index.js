require('dotenv').config();
const { httpServer, io } = require('./app');
const logger = require('./utils/logger');
const alerting = require('./utils/alerting');
const prisma = require('./config/prisma');
const cron = require('node-cron');
const { startKeepAlive } = require('./utils/keepAlive');

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, async () => {
  logger.info(`[서버] WeMarket API 서버 실행 중: http://localhost:${PORT}`);
  logger.info(`[환경] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`[버전] v${require('./package.json').version}`);

  // Socket.IO Redis Adapter setup for horizontal scaling
  try {
    const { setupSocketRedisAdapter } = require('./socket/adapter');
    await setupSocketRedisAdapter(io);
  } catch (err) {
    logger.warn('[서버] Socket.IO Redis Adapter 초기화 실패', { error: err.message });
  }

  // 주간 매출 리포트 스케줄러 (매주 월요일 09:00 KST)
  require('./services/weeklyReportService').start();

  // Open Commerce Hub 웹훅 재시도 스케줄러
  require('./services/webhookDispatcher').startRetryScheduler();

  // 결제 대사 스케줄러 (매시간 정각)
  require('./services/PaymentReconciliationService').startScheduler();

  // 네이버 뉴스 자동 수집 스케줄러 (매일 07:00 KST)
  // Heroku/Render는 UTC 기준이므로 KST 07:00 = UTC 22:00 (전날)
  const { collectAndPost } = require('./services/newsCollectorService');
  cron.schedule(
    '0 7 * * *',
    async () => {
      logger.info('[뉴스수집] 스케줄러 시작 — 매일 07:00 KST 뉴스 수집');
      try {
        const count = await collectAndPost();
        logger.info(`[뉴스수집] 스케줄러 완료 — ${count}건 등록`);
      } catch (err) {
        logger.error('[뉴스수집] 스케줄러 오류', { error: err.message });
      }
    },
    { timezone: 'Asia/Seoul' }
  );
  logger.info('[뉴스수집] 스케줄러 등록 완료 (매일 07:00 KST)');

  const archiveLogs = require('./scripts/archiveLogs');
  cron.schedule(
    '0 4 1 * *',
    async () => {
      logger.info('[아카이빙] 월간 데이터 정리 시작');
      await archiveLogs();
    },
    { timezone: 'Asia/Seoul' }
  );
  logger.info('[아카이빙] 스케줄러 등록 완료 (매월 1일 04:00 KST)');

  // 동적 가격 규칙 스케줄러 (매시간 정각) — 날씨/시간대 기반 자동 가격 조정
  const { activateAllStores } = require('./services/DynamicPricingService');
  cron.schedule(
    '0 * * * *',
    async () => {
      logger.info('[동적가격] 스케줄러 시작 — 매시간 정각 가격 규칙 적용');
      try {
        await activateAllStores();
      } catch (err) {
        logger.error('[동적가격] 스케줄러 오류', { error: err.message });
      }
    },
    { timezone: 'Asia/Seoul' }
  );
  logger.info('[동적가격] 스케줄러 등록 완료 (매시간 정각 KST)');

  // 매장 연동 요청 알림 기본 템플릿 등록
  initStoreLinkTemplates();

  // Render Free Tier 슬립 방지 자가 핑 데몬 가동 (인프라 레이턴시 원천 차단)
  startKeepAlive();
});

// ── 매장 연동 요청 알림 기본 템플릿 ──────────────────────────────────────────
const STORE_LINK_TEMPLATES = [
  {
    type: 'STORE_LINK_CREATED',
    title: '매장 연동 요청 도착',
    message: '{{userName}}님이 "{{storeName}}" 매장 연동을 요청했습니다.',
    variables: ['userName', 'storeName'],
  },
  {
    type: 'STORE_LINK_APPROVED',
    title: '매장 연동 승인 완료',
    message: '"{{storeName}}" 매장 연동이 승인되었습니다. 이제 내 매장에서 관리할 수 있습니다.',
    variables: ['storeName'],
  },
  {
    type: 'STORE_LINK_REJECTED',
    title: '매장 연동 거절',
    message: '"{{storeName}}" 매장 연동 요청이 거절되었습니다. 사유: {{adminNote}}',
    variables: ['storeName', 'adminNote'],
  },
];

async function initStoreLinkTemplates() {
  for (const tpl of STORE_LINK_TEMPLATES) {
    try {
      const existing = await prisma.notification_templates.findFirst({
        where: { type: tpl.type, store_id: null },
      });
      if (!existing) {
        await prisma.notification_templates.create({
          data: {
            type: tpl.type,
            title: tpl.title,
            message: tpl.message,
            variables: JSON.stringify(tpl.variables),
            channel: 'all',
            is_active: true,
          },
        });
        logger.info(`[알림템플릿] ${tpl.type} 기본 템플릿 등록 완료`);
      }
    } catch (e) {
      logger.warn(`[알림템플릿] ${tpl.type} 등록 실패`, { error: e.message });
    }
  }
}

// ── Graceful Shutdown ────────────────────────────────────────────────────────
// Render는 배포/재시작 전 SIGTERM을 보낸다.
// 진행 중인 요청을 최대 30초 동안 완료한 후 종료.

let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`[Shutdown] ${signal} 수신 — Graceful Shutdown 시작`);
  await alerting.send({
    level: 'warn',
    title: `서버 종료 시작 (${signal})`,
    message: 'Graceful Shutdown — 30초 이내 재시작 예정',
  });

  // 1. 신규 연결 차단
  httpServer.close(async () => {
    logger.info('[Shutdown] HTTP 서버 닫힘');
  });

  // 2. Socket.io 연결 종료
  io.close(() => {
    logger.info('[Shutdown] Socket.IO 닫힘');
  });

  // 3. Prisma 연결 해제
  try {
    await prisma.$disconnect();
    logger.info('[Shutdown] Prisma 연결 해제');
  } catch (e) {
    logger.error('[Shutdown] Prisma 해제 실패', e.message);
  }

  // 4. 최대 30초 대기 후 강제 종료
  const forceExit = setTimeout(() => {
    logger.error('[Shutdown] 강제 종료 (타임아웃 30초)');
    process.exit(1);
  }, 30_000);
  forceExit.unref(); // 타이머가 프로세스 종료를 막지 않도록

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
