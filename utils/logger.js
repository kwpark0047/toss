const winston = require('winston');
const path = require('path');
const Transport = require('winston-transport');

// [Sentry 연동] SENTRY_DSN 환경변수가 있을 때만 활성화 (로컬/테스트는 무시)
// 외부 aggregator(Sentry)로 에러/경고 로그 전송 — 운영 가시성 확보
let Sentry = null;
let sentryTransport = null;
if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
  sentryTransport = new Transport({ level: 'warn' });
  const originalLog = sentryTransport.log.bind(sentryTransport);
  sentryTransport.log = (info, callback) => {
    if (Sentry && info.level === 'error') {
      Sentry.captureException(info.stack || info.message);
    } else if (Sentry && info.level === 'warn') {
      Sentry.captureMessage(info.message, 'warning');
    }
    originalLog(info, callback);
  };
}

const { combine, timestamp, printf, colorize, errors } = winston.format;

// [로그 포맷 정의]
const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

// [로거 인스턴스 생성]
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(
        errors({ stack: true }), // 에러 스택 추적 지원
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        // 1. 콘솔 출력 (색상 적용)
        new winston.transports.Console({
            format: combine(
                colorize(),
                logFormat
            )
        }),
        // 2. 파일 출력 (에러 전용) — LOG_DIR 환경변수로 경로 변경 가능
        new winston.transports.File({
            filename: path.join(process.env.LOG_DIR || path.join(__dirname, '../logs'), 'error.log'),
            level: 'error'
        }),
        // 3. 파일 출력 (전체 로그)
        new winston.transports.File({
            filename: path.join(process.env.LOG_DIR || path.join(__dirname, '../logs'), 'combined.log')
        }),
        // 4. Sentry 전송 (SENTRY_DSN + production 에서만 존재)
        ...(sentryTransport ? [sentryTransport] : [])
    ]
});

module.exports = logger;
