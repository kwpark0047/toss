/**
 * health.js — 서비스 가용성 진단 엔드포인트
 *
 * GET /api/health          — Render 자동 재시작 프로브 (가볍고 빠름)
 * GET /api/health/deep     — 전체 의존성 점검 (DB, 외부 API, 메모리)
 * GET /api/health/circuits — Circuit Breaker 상태
 * GET /api/health/sla      — SLA 지표 (업타임, 에러율, 응답시간)
 */
const router  = require('express').Router();
const prisma  = require('../config/prisma');
const logger  = require('../utils/logger');
const cb      = require('../utils/circuitBreaker');
const alerting = require('../utils/alerting');

const START_TIME = Date.now();

// ── 요청/에러 카운터 (인메모리 슬라이딩 윈도우 5분) ──────────────────────────
const _req5m   = [];
const _err5m   = [];
const _p99_buf = []; // 응답시간 버퍼 (최근 1000건)
const W = 5 * 60_000;

const recordReq = (ms, isErr) => {
    const now = Date.now();
    _req5m.push(now);
    if (isErr) _err5m.push(now);
    _p99_buf.push(ms);
    if (_p99_buf.length > 1000) _p99_buf.shift();
    // 만료 항목 정리
    while (_req5m.length  && _req5m[0]  < now - W) _req5m.shift();
    while (_err5m.length  && _err5m[0]  < now - W) _err5m.shift();
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

// ── GET /api/health (Render liveness probe) ────────────────────────────────
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
        version: process.env.npm_package_version || '1.x',
        enc: !!(process.env.PHONE_ENC_KEY || process.env.JWT_SECRET)
    });
});

// ── GET /api/health/deep ───────────────────────────────────────────────────
router.get('/deep', async (req, res) => {
    const checks = {};
    let overallOk = true;

    // 1. DB
    const t0 = Date.now();
    try {
        await Promise.race([
            prisma.$queryRaw`SELECT COUNT(*) FROM stores`,
            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000))
        ]);
        checks.database = { status: 'ok', latencyMs: Date.now() - t0 };
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

    // 4. SLA 지표
    const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
    const errorRate = _req5m.length ? ((_err5m.length / _req5m.length) * 100).toFixed(1) : '0.0';
    checks.sla = {
        uptimeSeconds: uptimeSec,
        uptimeFormatted: _formatUptime(uptimeSec),
        req5m: _req5m.length,
        err5m: _err5m.length,
        errorRatePct: errorRate,
        p50Ms: percentile(_p99_buf, 50),
        p95Ms: percentile(_p99_buf, 95),
        p99Ms: percentile(_p99_buf, 99)
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

// ── GET /api/health/circuits ───────────────────────────────────────────────
router.get('/circuits', (req, res) => {
    res.json({ circuits: cb.allStats(), ts: new Date().toISOString() });
});

// ── GET /api/health/sla ────────────────────────────────────────────────────
router.get('/sla', (req, res) => {
    const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
    // SLO: 99.5% 가용성 = 분기당 최대 10.8시간 다운 허용
    const SLO_UPTIME_PCT = 99.5;

    res.json({
        target: { uptimePct: SLO_UPTIME_PCT, maxDowntimePerQuarterMin: 648, p99MaxMs: 2000, errorRateMaxPct: 1.0 },
        current: {
            uptimeSeconds: uptimeSec,
            uptimeFormatted: _formatUptime(uptimeSec),
            req5m: _req5m.length,
            err5m: _err5m.length,
            errorRatePct: _req5m.length ? ((_err5m.length / _req5m.length) * 100).toFixed(2) : '0.00',
            p50Ms: percentile(_p99_buf, 50),
            p95Ms: percentile(_p99_buf, 95),
            p99Ms: percentile(_p99_buf, 99),
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
