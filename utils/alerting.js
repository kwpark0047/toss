/**
 * alerting.js — 장애 알림 유틸리티
 *
 * 환경변수:
 *   ALERT_WEBHOOK_URL  — Slack / Discord / 커스텀 웹훅 URL
 *   ALERT_MIN_LEVEL    — 'info'|'warn'|'critical' (기본: 'warn')
 *   NODE_ENV
 */
const https = require('https');
const logger = require('./logger');

const LEVELS = { info: 0, warn: 1, critical: 2 };
const MIN_LEVEL = LEVELS[process.env.ALERT_MIN_LEVEL || 'warn'] ?? 1;
const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || '';

// 에러 버스트 억제: 동일 title은 5분에 1회만 발송
const _cooldowns = new Map();
const COOLDOWN_MS = 5 * 60 * 1000;

/**
 * @param {{ level: 'info'|'warn'|'critical', title: string, message: string, meta?: object }} opts
 */
const send = async (opts) => {
    const { level = 'warn', title, message, meta = {} } = opts;

    if ((LEVELS[level] ?? 0) < MIN_LEVEL) return;

    const now = Date.now();
    const lastSent = _cooldowns.get(title) || 0;
    if (now - lastSent < COOLDOWN_MS) return;
    _cooldowns.set(title, now);

    const emoji  = { info: 'ℹ️', warn: '⚠️', critical: '🚨' }[level] || '📢';
    const env    = process.env.NODE_ENV || 'unknown';
    const metaStr = Object.keys(meta).length
        ? '\n```\n' + JSON.stringify(meta, null, 2) + '\n```'
        : '';

    const body = {
        text: `${emoji} *[WeMarket ${env.toUpperCase()}] ${title}*`,
        attachments: [{
            color: level === 'critical' ? '#FF0000' : level === 'warn' ? '#FFA500' : '#36A64F',
            text: `${message}${metaStr}`,
            footer: `WeMarket | ${new Date().toISOString()}`
        }]
    };

    if (!WEBHOOK_URL) {
        // 웹훅 미설정 시 로컬 로그로 대체
        logger[level === 'critical' ? 'error' : level](`[Alert:${level}] ${title} — ${message}`);
        return;
    }

    try {
        await _post(WEBHOOK_URL, body);
    } catch (e) {
        logger.error(`[Alerting] 웹훅 전송 실패: ${e.message}`);
    }
};

const _post = (webhookUrl, payload) => new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(webhookUrl);
    const data = Buffer.from(JSON.stringify(payload));
    const req = https.request(
        { hostname, path: pathname + (search || ''), method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } },
        (res) => {
            res.resume();
            res.on('end', resolve);
        }
    );
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
});

// ── 에러율 추적 (슬라이딩 윈도우 5분) ───────────────────────────────────────
const _errorWindow = [];
const ERROR_RATE_THRESHOLD = 20; // 5분 내 20건 초과 시 알림
const WINDOW_MS = 5 * 60 * 1000;

const trackError = (err, context = {}) => {
    const now = Date.now();
    _errorWindow.push(now);
    // 윈도우 밖 항목 제거
    while (_errorWindow.length && _errorWindow[0] < now - WINDOW_MS) _errorWindow.shift();

    if (_errorWindow.length >= ERROR_RATE_THRESHOLD) {
        send({
            level: 'critical',
            title: `에러율 급증 (5분 내 ${_errorWindow.length}건)`,
            message: `최근 에러: ${err?.message || String(err)}`,
            meta: { ...context, errorCount: _errorWindow.length }
        });
    }
};

// ── 미처리 예외 글로벌 캐치 ──────────────────────────────────────────────────
const registerGlobalHandlers = () => {
    process.on('uncaughtException', (err) => {
        logger.error('[uncaughtException]', { message: err.message, stack: err.stack });
        send({ level: 'critical', title: '서버 미처리 예외 (uncaughtException)', message: err.message, meta: { stack: err.stack?.split('\n')[1] } });
    });

    process.on('unhandledRejection', (reason) => {
        const msg = reason instanceof Error ? reason.message : String(reason);
        logger.error('[unhandledRejection]', { reason: msg });
        send({ level: 'warn', title: '미처리 Promise 거부 (unhandledRejection)', message: msg });
    });
};

module.exports = { send, trackError, registerGlobalHandlers };
