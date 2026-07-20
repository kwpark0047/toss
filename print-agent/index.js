require('dotenv').config();
const { createPrinter } = require('./lib/printer');
const ApiClient = require('./lib/client');

const config = {
    backendUrl: process.env.BACKEND_URL,
    apiKey: process.env.API_KEY,
    storeId: process.env.STORE_ID,
    printerType: process.env.PRINTER_TYPE || 'tcp',
    printerHost: process.env.PRINTER_HOST,
    printerPort: parseInt(process.env.PRINTER_PORT || '9100', 10),
    printerVid: process.env.PRINTER_VID,
    printerPid: process.env.PRINTER_PID,
    pollInterval: parseInt(process.env.POLL_INTERVAL || '3000', 10)
};

const log = {
    info: (...args) => console.log(`[${new Date().toISOString()}] INFO`, ...args),
    warn: (...args) => console.warn(`[${new Date().toISOString()}] WARN`, ...args),
    error: (...args) => console.error(`[${new Date().toISOString()}] ERROR`, ...args)
};

if (!config.backendUrl || !config.apiKey || !config.storeId) {
    log.error('BACKEND_URL, API_KEY, STORE_ID가 필요합니다. .env 파일을 확인하세요.');
    process.exit(1);
}

const api = new ApiClient({
    baseUrl: config.backendUrl,
    apiKey: config.apiKey,
    storeId: config.storeId
});

const printer = createPrinter({
    type: config.printerType,
    host: config.printerHost,
    port: config.printerPort,
    vid: config.printerVid,
    pid: config.printerPid
});

let running = true;
let printing = false;

process.on('SIGINT', () => { running = false; log.info('종료 시그널 수신'); });
process.on('SIGTERM', () => { running = false; log.info('종료 시그널 수신'); });

async function processJobs() {
    if (printing) return;
    printing = true;

    try {
        const jobs = await api.fetchPendingJobs();
        if (!jobs.length) { printing = false; return; }

        log.info(`${jobs.length}개의 인쇄 대기 작업 발견`);

        for (const job of jobs) {
            try {
                await api.claimJob(job.id);
                await printer.print(job.payload_b64);
                await api.completeJob(job.id);
                log.info(`인쇄 완료: job=${job.id}, order=${job.order_id || '?'}`);
            } catch (err) {
                log.error(`인쇄 실패: job=${job.id} — ${err.message}`);
                await api.failJob(job.id, err.message).catch(() => {});
            }
        }
    } catch (err) {
        log.error(`작업 조회 실패: ${err.message}`);
    } finally {
        printing = false;
    }
}

async function main() {
    log.info(`WeMarket Print Agent 시작 (store=${config.storeId})`);
    log.info(`프린터: ${config.printerType.toUpperCase()} ${config.printerHost || 'USB'}:${config.printerPort || 'N/A'}`);
    log.info(`백엔드: ${config.backendUrl}`);
    log.info(`폴링 간격: ${config.pollInterval}ms`);

    while (running) {
        await processJobs();
        await new Promise(r => setTimeout(r, config.pollInterval));
    }

    log.info('WeMarket Print Agent 종료');
}

main().catch(err => {
    log.error(`치명적 오류: ${err.message}`);
    process.exit(1);
});
