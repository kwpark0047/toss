/**
 * @swagger
 * tags:
 *   name: Health
 *   description: 서비스 가용성 진단 (Health Check)
 */
const router  = require('express').Router();
const prisma  = require('../config/prisma');
const cb      = require('../utils/circuitBreaker');
const alerting = require('../utils/alerting');
const axios   = require('axios');

// CORS 허용 도메인은 단일 모듈(config/domain)에서 관리한다.
const { getAllowedOrigins, isOriginAllowed } = require('../config/domain');

// DB 슬립/서버 503 가용성 장애 시에도 브라우저 전송에 필요한 CORS 헤더를 원자적으로 강제 반사 (Workbox fetch 우회 차단 해결)
router.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = origin && isOriginAllowed(origin, getAllowedOrigins());
    if (allowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

const START_TIME = Date.now();
// 버전 단일 소스: package.json (npm_package_version은 `node index.js` 직접 실행 시 누락됨)
const APP_VERSION = require('../package.json').version;

// ── 요청/에러 카운터 (인메모리 슬라이딩 윈도우 5분) ──────────────────────────
const _req5m = [];
const _err5m = [];
// 응답시간도 5분 윈도우로 관리 — 개수 기반(최근 1000건)이면 콜드스타트 직후의
// 느린 요청이 트래픽이 적을 때 몇 시간씩 잔류해 P99를 오염시킨다
const _lat5m = []; // { t, ms }
const W = 5 * 60_000;
const LAT_MAX = 5000; // 고트래픽 시 메모리 상한

const recordReq = (ms, isErr) => {
    const now = Date.now();
    _req5m.push(now);
    if (isErr) _err5m.push(now);
    _lat5m.push({ t: now, ms });
    // 만료 항목 정리
    while (_req5m.length && _req5m[0]   < now - W) _req5m.shift();
    while (_err5m.length && _err5m[0]   < now - W) _err5m.shift();
    while (_lat5m.length && (_lat5m[0].t < now - W || _lat5m.length > LAT_MAX)) _lat5m.shift();
};

// 현재 윈도우의 지연시간 배열 (읽기 시점에도 만료 반영)
const latencies = () => {
    const cutoff = Date.now() - W;
    return _lat5m.filter(x => x.t >= cutoff).map(x => x.ms);
};

const percentile = (arr, p) => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * p / 100)];
};

// app.js에서 미들웨어로 호출
const requestTracker = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => recordReq(Date.now() - start, res.statusCode >= 500));
    next();
};

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: 서비스 헬스체크 (Render liveness probe)
 *     description: DB 연결 상태, 업타임, 암호화 설정 여부를 반환합니다.
 *     responses:
 *       200:
 *         description: 정상 (DB 연결)
 *       503:
 *         description: 서비스 저하 (DB 불가)
 */
router.get('/', async (req, res) => {
    // DB 핑 타임아웃 3초
    let dbOk = false;
    try {
        await Promise.race([
            prisma.$queryRaw`SELECT 1`,
            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))
        ]);
        dbOk = true;
    } catch { /* pass */ }

    const status = dbOk ? 'ok' : 'degraded';
    res.status(dbOk ? 200 : 503).json({
        status,
        db: dbOk ? 'connected' : 'unreachable',
        uptime: Math.floor((Date.now() - START_TIME) / 1000),
        ts: new Date().toISOString(),
        version: APP_VERSION,
        enc: !!(process.env.PHONE_ENC_KEY || process.env.JWT_SECRET)
    });
});

/**
 * @swagger
 * /api/health/deep:
 *   get:
 *     tags: [Health]
 *     summary: 심층 헬스체크 (DB, 메모리, 외부 API, SLA)
 *     description: DB 지연시간, 힙 메모리, TossPayments Circuit Breaker, P50/P95/P99 응답시간을 포함한 전체 의존성 점검
 *     responses:
 *       200:
 *         description: 전체 점검 정상
 *       503:
 *         description: 점검 항목 중 이상 감지
 */
router.get('/deep', async (req, res) => {
    const checks = {};
    let overallOk = true;

    // 1. DB — 3초 초과 지연은 장애 전조로 warn 표시 (overall은 유지)
    // SELECT 1: 테이블 스캔 없는 순수 연결+왕복 지연 측정
    const t0 = Date.now();
    try {
        await Promise.race([
            prisma.$queryRaw`SELECT 1`,
            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000))
        ]);
        const latencyMs = Date.now() - t0;
        checks.database = { status: latencyMs > 3000 ? 'warn' : 'ok', latencyMs };
    } catch (e) {
        checks.database = { status: 'error', error: e.message };
        overallOk = false;
    }

    // 2. 메모리
    const mem = process.memoryUsage();
    const heapUsedMB  = Math.round(mem.heapUsed  / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const memOk = heapUsedMB < 400; // 400MB 미만이면 정상
    checks.memory = {
        status: memOk ? 'ok' : 'warn',
        heapUsedMB,
        heapTotalMB,
        rssMB: Math.round(mem.rss / 1024 / 1024)
    };
    if (!memOk) overallOk = false;

    // 3. 외부 API (Toss) — circuit breaker 상태만 확인 (실제 호출 X)
    const tossCB = cb.get('toss-api');
    checks.tossPayments = {
        status: tossCB.state === 'OPEN' ? 'circuit_open' : 'ok',
        circuitState: tossCB.state
    };
    if (tossCB.state === 'OPEN') overallOk = false;

    // 4. OmniRoute (AI fallback gateway) — 연결 가능 여부 확인
    const omniUrl = process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1';
    let omniOk = false;
    let omniLatencyMs = null;
    try {
        const t0 = Date.now();
        await axios.get(`${omniUrl.replace(/\/v1$/, '')}/v1/models`, {
            headers: { Authorization: 'Bearer sk-omniroute' },
            timeout: 3000,
        });
        omniLatencyMs = Date.now() - t0;
        omniOk = true;
    } catch { /* OmniRoute unavailable */ }
    checks.omniroute = {
        status: omniOk ? 'ok' : 'unavailable',
        baseUrl: omniUrl,
        latencyMs: omniLatencyMs,
    };

    // 5. SLA 지표
    const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
    const errorRate = _req5m.length ? ((_err5m.length / _req5m.length) * 100).toFixed(1) : '0.0';
    checks.sla = {
        uptimeSeconds: uptimeSec,
        uptimeFormatted: _formatUptime(uptimeSec),
        req5m: _req5m.length,
        err5m: _err5m.length,
        errorRatePct: errorRate,
        p50Ms: percentile(latencies(), 50),
        p95Ms: percentile(latencies(), 95),
        p99Ms: percentile(latencies(), 99)
    };

    const payload = {
        status: overallOk ? 'ok' : 'degraded',
        checks,
        ts: new Date().toISOString()
    };

    if (!overallOk) {
        alerting.send({ level: 'warn', title: '헬스체크 이상 감지', message: JSON.stringify(checks.database || checks.memory), meta: payload });
    }

    res.status(overallOk ? 200 : 503).json(payload);
});

/**
 * @swagger
 * /api/health/circuits:
 *   get:
 *     tags: [Health]
 *     summary: Circuit Breaker 상태 조회
 *     description: 모든 외부 의존성의 Circuit Breaker 통계를 반환합니다.
 *     responses:
 *       200:
 *         description: Circuit Breaker 상태 목록
 */
router.get('/circuits', (req, res) => {
    res.json({ circuits: cb.allStats(), ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/health/sla:
 *   get:
 *     tags: [Health]
 *     summary: SLA 지표 조회
 *     description: SLO 목표 및 현재 업타임, 에러율, P50/P95/P99 응답시간을 반환합니다.
 *     responses:
 *       200:
 *         description: SLA/SLO 메트릭
 */
router.get('/sla', (req, res) => {
    const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
    // SLO: 99.5% 가용성 = 분기당 최대 10.8시간 다운 허용
    const SLO_UPTIME_PCT = 99.5;

    res.json({
        // p99 목표 3000ms: Render(미국)↔Supabase(싱가포르) 크로스리전 왕복을 반영한 현실 값.
        // 리전 정렬 또는 세션 모드 전환 후 2000ms로 복원 권장
        target: { uptimePct: SLO_UPTIME_PCT, maxDowntimePerQuarterMin: 648, p99MaxMs: 3000, errorRateMaxPct: 1.0 },
        current: {
            uptimeSeconds: uptimeSec,
            uptimeFormatted: _formatUptime(uptimeSec),
            req5m: _req5m.length,
            err5m: _err5m.length,
            errorRatePct: _req5m.length ? ((_err5m.length / _req5m.length) * 100).toFixed(2) : '0.00',
            p50Ms: percentile(latencies(), 50),
            p95Ms: percentile(latencies(), 95),
            p99Ms: percentile(latencies(), 99),
        },
        ts: new Date().toISOString()
    });
});

const _formatUptime = (sec) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${d}일 ${h}시간 ${m}분`;
};

module.exports = router;
module.exports.requestTracker = requestTracker;
