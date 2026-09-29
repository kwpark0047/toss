import * as Sentry from '@sentry/node';
import logger from './logger.js';

let initialized = false;
let buffer: Array<{ type: 'exception' | 'message'; args: any[] }> = [];

/**
 * Sentry 초기화 전 예외/메시지 버퍼에 담아두었다가 initSentry() 호출 시 flush함.
 * captureException/captureMessage는 initialized가 true일 경우 즉시 전송하고,
 * false일 경우 버퍼에 쌓았다가 initSentry()가 성공하면 flush한다.
 */
function bufferCall(type: 'exception' | 'message', args: any[]) {
  buffer.push({ type, args });
}

/**
 * Sentry를 초기화한다.
 * SENTRY_DSN이 없으면 비활성화되며 null을 반환한다.
 * @returns {typeof Sentry | null}
 */
export const initSentry = (): typeof Sentry | null => {
  if (initialized) return Sentry;
  if (process.env.NODE_ENV === 'test') {
    buffer = [];
    return null;
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    buffer = [];
    logger.info('[Sentry] SENTRY_DSN이 설정되지 않아 Sentry가 비활성화되었습니다.');
    return null;
  }

  const pkg = require('../package.json');

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: `wemarket-api@${pkg.version}`,
    // 프로덕션에서만 트레이싱 샘플 (과금 최적화)
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.0,
    // 민감한 요청 헤더 제외
    beforeSend(event) {
      if (event.request) {
        delete event.request.headers;
      }
      return event;
    },
    // 사용자 식별 (개인정보 제외 — 사용자 ID만 포함)
    beforeSendTransaction(event) {
      return event;
    },
  });

  initialized = true;

  // 버퍼된 예외/메시지 flush
  buffer.forEach(({ type, args }) => {
    if (type === 'exception' && typeof Sentry.captureException === 'function') {
      Sentry.captureException(args[0], { extra: args[1] });
    }
    if (type === 'message' && typeof Sentry.captureMessage === 'function') {
      Sentry.captureMessage(args[0], { level: args[1], extra: args[2] });
    }
  });
  buffer = [];

  logger.info('[Sentry] 초기화 완료');
  return Sentry;
};

/**
 * 예외를 Sentry로 전송한다.
 * @param {Error|*} err - 전송할 에러 객체
 * @param {object} [context={}] - 추가 컨텍스트 (extra 필드)
 */
export const captureException = (err: any, context: Record<string, unknown> = {}) => {
  if (initialized) {
    Sentry.captureException(err, { extra: context });
  } else {
    bufferCall('exception', [err, context]);
  }
};

/**
 * 메시지를 Sentry로 전송한다.
 * @param {string} message - 전송할 메시지
 * @param {'info'|'warning'|'error'|'fatal'} [level='info'] - 메시지 레벨
 * @param {object} [context={}] - 추가 컨텍스트 (extra 필드)
 */
export const captureMessage = (message: string, level: 'info' | 'warning' | 'error' | 'fatal' = 'info', context: Record<string, unknown> = {}) => {
  if (initialized) {
    Sentry.captureMessage(message, { level, extra: context });
  } else {
    bufferCall('message', [message, level, context]);
  }
};

export { Sentry };

export default { initSentry, captureException, captureMessage, Sentry };
