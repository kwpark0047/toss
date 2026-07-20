/**
 * @swagger
 * tags:
 *   name: DevOps
 *   description: 운영 편의용 시드/DB 마이그레이션 엔드포인트 ( ENABLE_DEV_OPS + SEED_KEY 이중 인증 )
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

/**
 * @swagger
 * /api/_devops/seed-start:
 *   post:
 *     tags: [DevOps]
 *     summary: 시드 데이터 생성 실행
 *     security:
 *       - devopsToken: []
 *     responses:
 *       200:
 *         description: 시드 실행 시작
 */
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

/**
 * @swagger
 * /api/_devops/seed-status:
 *   get:
 *     tags: [DevOps]
 *     summary: 시드 실행 상태 조회
 *     security:
 *       - devopsToken: []
 *     responses:
 *       200:
 *         description: 시드 작업 상태
 */
router.get('/seed-status', (req, res) => res.json(_seedJob || { status: 'not_started' }));

/**
 * @swagger
 * /api/_devops/db-push:
 *   post:
 *     tags: [DevOps]
 *     summary: Prisma DB Push 실행
 *     security:
 *       - devopsToken: []
 *     responses:
 *       200:
 *         description: DB Push 시작
 */
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

/**
 * @swagger
 * /api/_devops/db-push-status:
 *   get:
 *     tags: [DevOps]
 *     summary: Prisma DB Push 상태 조회
 *     security:
 *       - devopsToken: []
 *     responses:
 *       200:
 *         description: DB Push 작업 상태
 */
router.get('/db-push-status', (req, res) => res.json(_dbPushJob || { status: 'not_started' }));

/**
 * @swagger
 * /api/_devops/db-tables:
 *   get:
 *     tags: [DevOps]
 *     summary: 공개 스키마 테이블 목록 조회 (진단용)
 *     security:
 *       - devopsToken: []
 *     responses:
 *       200:
 *         description: 테이블 목록
 */
router.get('/db-tables', async (req, res) => {
    try {
        const prisma = require('../config/prisma');
        const rows = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
        res.json({ tables: rows.map(r => r.table_name) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
