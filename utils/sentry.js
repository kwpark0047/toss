/**
 * Sentry 통합 모듈
 *
 * - Express 요청 컨텍스트, 에러 핸들러, 성능 추적을 제공한다.
 * - SENTRY_DSN 환경변수가 비어있으면 자동 비활성화 (개발/테스트 환경에서는 무시).
 * - 기존 utils/logger.js의 Winston transport 기반 Sentry 전송과 연동:
 *   logger가 warn/error 레벨 로그를 남길 때 자동으로 Sentry로 전송된다.
 *
 * 사용법:
 *   const { initSentry, captureException } = require('./utils/sentry');
 *   initSentry(); // index.js 최상단에서 호출
 *
 *   // app.js에서 Express 미들웨어로 추가:
 *   const { Sentry } = require('./utils/sentry');
 *   app.use(Sentry.Handlers.requestHandler());
 *   app.use(Sentry.Handlers.errorHandler()); // errorHandler보다 먼저
 */

const Sentry = require('@sentry/node');
const logger = require('./logger');

let initialized = false;

/**
 * Sentry를 초기화한다.
 * SENTRY_DSN이 없으면 비활성화되며 null을 반환한다.
 * @returns {Sentry|Sentry|object|null}
 */
const initSentry = () => {
  if (initialized) return Sentry;
  if (process.env.NODE_ENV === 'test') return null;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
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
  logger.info('[Sentry] 초기화 완료');
  return Sentry;
};

/**
 * 예외를 Sentry로 전송한다.
 * @param {Error|*} err - 전송할 에러 객체
 * @param {object} [context={}] - 추가 컨텍스트 (extra 필드)
 */
const captureException = (err, context = {}) => {
  if (initialized) {
    Sentry.captureException(err, { extra: context });
  }
};

/**
 * 메시지를 Sentry로 전송한다.
 * @param {string} message - 전송할 메시지
 * @param {'info'|'warning'|'error'|'fatal'} [level='info'] - 메시지 레벨
 * @param {object} [context={}] - 추가 컨텍스트 (extra 필드)
 */
const captureMessage = (message, level = 'info', context = {}) => {
  if (initialized) {
    Sentry.captureMessage(message, level, { extra: context });
  }
};

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  Sentry,
};
