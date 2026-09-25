/**
 * Sentry 통합 모듈 (트레이스 고도화)
 *
 * - Express 요청 컨텍스트, 에러 핸들러, 성능 추적(성능 프로파일)을 제공한다.
 * - SENTRY_DSN 환경변수가 비어있으면 자동 비활성화 (경고 로그 후 개발/테스트 환경 무시).
 * - 기존 utils/logger.js의 Winston transport 기반 Sentry 전송과 연동:
 *   logger가 warn/error 레벨 로그를 남길 때 자동으로 Sentry로 전송된다.
 *
 * 고도화 포인트 (docs/ERROR_HANDLER_SENTRY_ANALYSIS.md):
 *  - 동적 샘플링: tracesSampler(env SENTRY_TRACES_SAMPLE_RATE, 기본 prod 0.1/그 외 0)
 *    + profilesSampleRate(env SENTRY_PROFILE_SAMPLE_RATE, 기본 prod 0.2/그 외 0)
 *  - PII 정화: beforeSend가 헤더·쿠키·body와 재귀적으로 민감 키를 제거한다.
 *  - 노이즈 트랜잭션 제외: health/metrics/realtime 폴링은 beforeSendTransaction에서 드롭.
 *  - DSN 부재 시 로그 레벨을 info→warn으로 상향 (P0-1).
 *
 * 사용법:
 *   const { initSentry, captureException, trace } = require('./utils/sentry');
 *   initSentry(); // app.mts 최상단에서 호출
 *
 *   // 백그라운드 잡(크론 등)을 트랜잭션으로 감싸기:
 *   await trace('newsCron.collect', () => collectNews());
 */

const Sentry = require('@sentry/node');
const logger = require('./logger');

let initialized = false;

// ── PII 정화 ─────────────────────────────────────────────────────────────────
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|refresh[_-]?token|access[_-]?token|id[_-]?token|token|api[_-]?key|password|passwd|pwd|secret|client[_-]?secret|session|card[_-]?(no|num|number)|cvv|cvc|csc/i;

const MAX_STRING_LENGTH = 2048;

const isSensitiveKey = (key) => SENSITIVE_KEY_PATTERN.test(String(key || ''));

/**
 * 값을 재귀적으로 정화한다.
 * - 민감 키(authorization/token/secret 등)의 값은 '[REDACTED]'
 * - 긴 문자열은 상한(2048자) 뒤로 절단
 * @param {*} value
 * @param {string} [key=''] 상위 키 이름 (민감 여부 판정용)
 */
function sanitizeValue(value, key = '') {
  if (value === null || value === undefined) return value;
  if (isSensitiveKey(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, key));
  if (typeof value === 'string') {
    if (value.length <= MAX_STRING_LENGTH) return value;
    return `${value.slice(0, MAX_STRING_LENGTH)}…(+${value.length - MAX_STRING_LENGTH} chars truncated)`;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: sanitizeValue(value.message) };
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeValue(v, k);
    return out;
  }
  return value;
}

/** 쿼리스트링에서 민감 파라미터 제거 */
const stripQueryString = (qs) => {
  if (typeof qs !== 'string' || qs === '') return qs;
  const hasPrefix = qs.startsWith('?');
  const pairs = (hasPrefix ? qs.slice(1) : qs).split('&').filter(Boolean);
  const kept = pairs.filter((pair) => {
    const [key] = pair.split('=');
    return !isSensitiveKey(key);
  });
  const joined = kept.join('&');
  if (!joined) return '';
  return hasPrefix ? `?${joined}` : joined;
};

/**
 * Sentry 이벤트(에러/트랜잭션)를 정화한다.
 * - request.headers / request.cookies / request.data는 통째로 제거 (Express 자동 첨부 헤더 포함)
 * - query_string의 민감 파라미터 제거, extra/contexts 재귀 정화
 */
function sanitizeEvent(event) {
  if (!event || typeof event !== 'object') return event;

  if (event.request && typeof event.request === 'object') {
    const request = { ...event.request };
    delete request.headers;
    delete request.cookies;
    delete request.data;
    request.query_string = stripQueryString(request.query_string);
    event.request = request;
  }
  if (event.extra) event.extra = sanitizeValue(event.extra);
  if (event.contexts) event.contexts = sanitizeValue(event.contexts);
  if (typeof event.message === 'string' && event.message.length > MAX_STRING_LENGTH) {
    event.message = sanitizeValue(event.message);
  }
  return event;
}

// ── 노이즈 트랜잭션 제외 ─────────────────────────────────────────────────────
// 헬스체크/메트릭 스크랩/실시간 폴링(관리자 대시보드)은 샘플링해도 정보 가치가 낮다.
// beforeSendTransaction에서 드롭한다 (tracesSampler 시점엔 라우트명이 아직 불확실).
const NOISE_ROUTE_PATTERN = /\/(health|metrics|favicon\.ico|realtime)(\/|$|\?)/i;

const shouldDropTransaction = (event) => {
  if (!event || typeof event.transaction !== 'string') return false;
  const route = event.transaction.split(' ').pop() || '';
  return NOISE_ROUTE_PATTERN.test(route);
};

// ── 샘플링 비율 (env 오버라이드 가능) ────────────────────────────────────────
const clampRate = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
};

const getTraceRate = () => {
  const envRate = clampRate(process.env.SENTRY_TRACES_SAMPLE_RATE);
  if (envRate !== null) return envRate;
  return process.env.NODE_ENV === 'production' ? 0.1 : 0;
};

/**
 * 트레이스 샘플러 팩토리 (순수 함수 — 테스트 가능)
 * @param {number} baseRate 명시적 베이스 레이트. 미지정 시 env/환경 별 기본값.
 */
const makeTracesSampler = (baseRate) => {
  const rate = baseRate === undefined ? getTraceRate() : (clampRate(baseRate) ?? 0);
  return () => rate;
};

const getProfileRate = () => {
  const envRate = clampRate(process.env.SENTRY_PROFILE_SAMPLE_RATE);
  if (envRate !== null) return envRate;
  return process.env.NODE_ENV === 'production' ? 0.2 : 0;
};

/**
 * Sentry를 초기화한다.
 * SENTRY_DSN이 없으면 비활성화되며 null을 반환한다.
 * @returns {object|null}
 */
const initSentry = () => {
  if (initialized) return Sentry;
  if (process.env.NODE_ENV === 'test') return null;

  if (!process.env.SENTRY_DSN) {
    logger.warn('[Sentry] SENTRY_DSN이 설정되지 않아 Sentry(에러·트레이스 수집)가 비활성화되었습니다.');
    return null;
  }

  try {
    const pkg = require('../package.json');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: `wemarket-api@${pkg.version}`,
      // 동적 샘플링 (과금 최적화): prod 기본 0.1, 나머지는 env로 제어
      tracesSampler: makeTracesSampler(),
      profilesSampleRate: getProfileRate(),
      // PII 정화: headers/cookies/body 제거 + 민감 키 재귀 redaction
      beforeSend: sanitizeEvent,
      beforeSendTransaction(event) {
        if (shouldDropTransaction(event)) return null;
        return sanitizeEvent(event);
      },
    });
  } catch (e) {
    logger.warn(`[Sentry] 초기화 실패 — Sentry 비활성화: ${e.message}`);
    return null;
  }

  initialized = true;
  logger.info(`[Sentry] 초기화 완료 (tracesSampler=${getTraceRate()}, profilesSampleRate=${getProfileRate()})`);
  return Sentry;
};

const CAPTURE_OPT_KEYS = ['context', 'tags', 'level', 'user', 'extra'];

/**
 * 예외를 Sentry로 전송한다.
 * @param {Error|*} err - 전송할 에러 객체
 * @param {object} [opts={}] - { context, extra, tags, level, user } 옵션
 *  레거시 호출 형태 captureException(err, contextObject)도 호환한다 (전체를 extra로 취급).
 */
const captureException = (err, opts = {}) => {
  if (!initialized) return;
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) opts = {};

  const isNewForm = Object.keys(opts).some((k) => CAPTURE_OPT_KEYS.includes(k));
  const captureOpts = {};
  const extra = { ...(opts.context || {}), ...(opts.extra || {}) };
  const finalExtra = isNewForm ? extra : opts;
  if (finalExtra && Object.keys(finalExtra).length > 0) captureOpts.extra = finalExtra;
  if (opts.tags && typeof opts.tags === 'object' && Object.keys(opts.tags).length > 0) {
    captureOpts.tags = opts.tags;
  }
  if (opts.level) captureOpts.level = opts.level;
  if (opts.user) captureOpts.user = opts.user;

  Sentry.captureException(err, captureOpts);
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

/**
 * 수동 스팬을 시작한다 (Express 미들웨어/서비스 내부 구간 측정용).
 * 비활성 상태면 null을 반환하므로 호출부는 옵셔널 체이닝으로 다룬다.
 * @param {string} name
 * @param {{ op?: string, attributes?: object }} [opts]
 * @returns {object|null}
 */
const startSpan = (name, opts = {}) => {
  if (!initialized) return null;
  return Sentry.startSpan({ name, op: opts.op || 'function', ...(opts.attributes || {}) });
};

/**
 * 백그라운드 작업(크론 등)을 Sentry 트랜잭션으로 감싸 실행한다.
 * 비활성 상태면 트레이스 오버헤드 없이 fn을 그대로 실행한다.
 * @param {string} name
 * @param {Function} fn
 * @param {{ op?: string, attributes?: object }} [opts]
 * @returns {*} fn의 반환값
 */
const trace = (name, fn, opts = {}) => {
  if (!initialized) return typeof fn === 'function' ? fn() : undefined;
  if (typeof fn !== 'function') return undefined;
  return Sentry.startSpan(
    { name, op: opts.op || 'function', forceTransaction: true, ...(opts.attributes || {}) },
    () => fn()
  );
};

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  startSpan,
  trace,
  // 테스트/재사용 가능한 순수 헬퍼
  sanitizeValue,
  sanitizeEvent,
  shouldDropTransaction,
  makeTracesSampler,
  // Instrumentation 접근 (레거시 호환)
  Sentry,
};