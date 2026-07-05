require('dotenv').config();
const { httpServer, io } = require('./app');
const logger   = require('./utils/logger');
const alerting = require('./utils/alerting');
const prisma   = require('./config/prisma');

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    logger.info(`[서버] WeMarket API 서버 실행 중: http://localhost:${PORT}`);
    logger.info(`[환경] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`[버전] v${require('./package.json').version}`);

    // 주간 매출 리포트 스케줄러 (매주 월요일 09:00 KST)
    require('./services/weeklyReportService').start();
});

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
process.on('SIGINT',  () => shutdown('SIGINT'));
