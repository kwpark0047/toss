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
const cb      = require('../utils/circuitBreaker');
const alerting = require('../utils/alerting');

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
        version: APP_VERSION,
        enc: !!(process.env.PHONE_ENC_KEY || process.env.JWT_SECRET)
    });
});

// ── GET /api/health/deep ───────────────────────────────────────────────────
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

    // 4. SLA 지표
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
