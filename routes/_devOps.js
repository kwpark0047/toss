/**
 * _devOps.js — 운영 편의를 위한 시드/DB 마이그레이션 원격 실행 엔드포인트
 *
 * ⚠️ 보안: 이 라우터는 임의 명령 실행(execFile) 및 raw SQL을 노출하므로
 * 기본적으로 프로덕션에서 마운트되지 않는다. 프로덕션에서 한시적으로 필요할 때만
 * 환경변수 ENABLE_DEV_OPS=<고유값> 으로 명시적으로 켜야 하며, 모든 요청은 SEED_KEY
 * (timingSafeEqual) 인증을 통과해야 한다. 사용 후 즉시 플래그를 내릴 것.
 *
 * ENABLE_DEV_OPS 단순히 "true"가 아니라 특정 토큰값을 요구하도록 변경:
 *   process.env.ENABLE_DEV_OPS 가 문자열 "true"가 아닌, 설정한 실제 값과
 *   x-devops-token 헤더가 일치해야 접근 가능 (2중 인증).
 *
 * app.js에서 조건부 마운트:
 *   if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_OPS)
 *       app.use('/api/_devops', require('./routes/_devOps'));
 *   (ENABLE_DEV_OPS= 가 설정된 값과 x-devops-token 헤더가 일치해야 접근 가능)
 */
const router = require('express').Router();
const { timingSafeEqual } = require('crypto');
const { execFile } = require('child_process');
const logger = require('../utils/logger');

const _SEED_KEY = Buffer.from(process.env.SEED_KEY || '');
const _DEVOPS_TOKEN = process.env.ENABLE_DEV_OPS || '';

function checkSeedKey(k) {
    if (!k) return false;
    try {
        const b = Buffer.from(String(k));
        return b.length === _SEED_KEY.length && timingSafeEqual(b, _SEED_KEY);
    } catch { return false; }
}

// 모든 devops 라우트에 공통 인증 (2중 검증)
router.use((req, res, next) => {
    // 1차: ENABLE_DEV_OPS 토큰 일치 확인 (단순 "true" 방지)
    const tokenHeader = req.headers['x-devops-token'] || '';
    if (!_DEVOPS_TOKEN || _DEVOPS_TOKEN === 'true' || !timingSafeEqual(Buffer.from(_DEVOPS_TOKEN), Buffer.from(tokenHeader))) {
        logger.warn(`[devOps] 토큰 인증 실패: ${req.method} ${req.originalUrl} from ${req.ip}`);
        return res.status(403).json({ error: 'forbidden' });
    }
    // 2차: SEED_KEY 일치 확인
    if (!checkSeedKey(req.headers['x-seed-key'])) {
        logger.warn(`[devOps] SEED_KEY 인증 실패: ${req.method} ${req.originalUrl} from ${req.ip}`);
        return res.status(403).json({ error: 'forbidden' });
    }
    next();
});

// ── 시드 실행 ────────────────────────────────────────────────────────────────
let _seedJob = null;
router.post('/seed-start', (req, res) => {
    if (_seedJob?.status === 'running') return res.json({ status: 'already_running', output: _seedJob.output });

    _seedJob = { status: 'running', output: '', startedAt: new Date().toISOString() };
    const child = execFile('node', ['scripts/seed_test.js'], {
        cwd: process.cwd(), timeout: 900000, env: process.env, maxBuffer: 10 * 1024 * 1024
    });
    child.stdout?.on('data', d => { _seedJob.output += d; });
    child.stderr?.on('data', d => { _seedJob.output += '[ERR] ' + d; });
    child.on('close', code => {
        _seedJob.status = code === 0 ? 'done' : 'failed';
        _seedJob.exitCode = code;
        _seedJob.finishedAt = new Date().toISOString();
    });
    res.json({ status: 'started', message: '시드 실행 시작. /api/_devops/seed-status 로 확인하세요.' });
});

router.get('/seed-status', (req, res) => res.json(_seedJob || { status: 'not_started' }));

// ── prisma db push ───────────────────────────────────────────────────────────
let _dbPushJob = null;
router.post('/db-push', (req, res) => {
    if (_dbPushJob?.status === 'running') return res.json({ status: 'already_running' });

    _dbPushJob = { status: 'running', output: '', startedAt: new Date().toISOString() };
    const child = execFile('npx', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'], {
        cwd: process.cwd(), timeout: 120000, env: process.env, maxBuffer: 5 * 1024 * 1024
    });
    child.stdout?.on('data', d => { _dbPushJob.output += d; });
    child.stderr?.on('data', d => { _dbPushJob.output += d; });
    child.on('close', code => {
        _dbPushJob.status = code === 0 ? 'done' : 'failed';
        _dbPushJob.exitCode = code;
        _dbPushJob.finishedAt = new Date().toISOString();
    });
    res.json({ status: 'started', message: 'prisma db push 실행 중. /api/_devops/db-push-status 로 확인하세요.' });
});

router.get('/db-push-status', (req, res) => res.json(_dbPushJob || { status: 'not_started' }));

// ── 공개 스키마 테이블 목록 (진단용) ──────────────────────────────────────────
router.get('/db-tables', async (req, res) => {
    try {
        const prisma = require('../config/prisma');
        const rows = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
        res.json({ tables: rows.map(r => r.table_name) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
