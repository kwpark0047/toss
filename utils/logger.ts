import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors, splat } = winston.format;

// [로그 포맷 정의]
const logFormat = printf((info: any) => {
  const { level, timestamp } = info;
  const stack = info.stack;
  const message = info.message;
  const splatSym = Symbol.for('splat');
  const splatVals = info[splatSym] || [];

  // 문자열 메시지 채택, 에러면 스택을 최우선
  let text = '';
  if (stack) {
    text = stack;
  } else if (typeof info.message === 'string') {
    text = info.message;
  } else if (info.message instanceof Error) {
    text = info.message.stack || info.message.message;
  }

  // 메타 구성: 객체형 message와 splat에 넘어온 값들을 모두 병합해 표기
  const metaParts = [];
  if (info.message && typeof info.message === 'object' && !(info.message instanceof Error)) {
    metaParts.push(info.message);
  }
  for (const v of info[splatSym] || []) metaParts.push(v);

  const metaStr = metaParts
    .map((v: any) => (typeof v === 'string' ? v : safeStringify(v)))
    .filter((v: string) => v && v !== '{}')
    .join(' ');

  return metaStr && metaStr.length
    ? `${timestamp} [${level}]: ${text || ''} ${metaStr}`.trim()
    : `${timestamp} [${level}]: ${text}`;
});

function safeStringify(value: any): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// [로거 인스턴스 생성]
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }), // 에러 스택 추적 지원
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    splat(),
    logFormat
  ),
  transports: [
    // 1. 콘솔 출력 (색상 적용)
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), splat(), logFormat),
    }),
    // 2. 파일 출력 (에러 전용) — LOG_DIR 환경변수로 경로 변경 가능
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || path.join(__dirname, '../logs'), 'error.log'),
      level: 'error',
    }),
    // 3. 파일 출력 (전체 로그)
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || path.join(__dirname, '../logs'), 'combined.log'),
    }),
  ],
});

// ── 도메인별 네임드 로거 ────────────────────────────────────────────
// [배경] 일부 모듈이 `const { apiLogger } = require('../utils/logger')` 형태로
// 가져다 쓰는데 apiLogger 가 export 되지 않아 `undefined.info(...)` 로 터졌다.
// (newsController / weatherController 가 500 을 반환하던 원인)
// 당장은 동일 winston 인스턴스를 재노출해 호환을 보장하고,
// 추후 child logger(라벨 부착)로 승격한다.
const namedLoggers = [
  'apiLogger',
  'dbLogger',
  'syncLogger',
  'webLogger',
  'authLogger',
  'notificationLogger',
];
for (const name of namedLoggers) {
  (module.exports as any)[name] = logger;
}

export default logger;
export { logger as apiLogger, logger as dbLogger, logger as syncLogger, logger as webLogger, logger as authLogger, logger as notificationLogger };