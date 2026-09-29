/**
 * Sentry 통합 모듈 (트레이스 고도화)
 *
 * - 동적 초기화: SENTRY_DSN이 있으면 initSentry() 호출 시점에 Sentry.init()을 수행합니다.
 * - 버퍼링: initSentry() 호출 전 captureException/captureMessage는 버퍼에 쌓았다가
 *   initSentry()가 성공하면 flush됩니다.
 * - SENTRY_DSN이 없으면 비활성화되며 null을 반환합니다.
 * - 기존 utils/logger.js의 Winston transport 기반 Sentry 전송과 연동:
 *   logger가 warn/error 레벨 로그를 남길 때 자동으로 Sentry로 전송됩니다.
 *
 * 고도화 포인트 (docs/ERROR_HANDLER_SENTRY_ANALYSIS.md):
 *  - 동적 샘플링: tracesSampler(env SENTRY_TRACES_SAMPLE_RATE, 기본 prod 0.1/그 외 0)
 *    + profilesSampleRate(env SENTRY_PROFILE_SAMPLE_RATE, 기본 prod 0.2/그 외 0)
 *  - PII 정화: beforeSend가 headers·쿠키·body와 재귀적으로 민감 키를 제거한다.
 *  - 노이즈 트랜잭션 제외: health/metrics/realtime 폴링은 beforeSendTransaction에서 드롭.
 *  - DSN 부재 시 로그 레벨을 info→warn으로 상향 (P0-1).
 *  - 버퍼링: 초기화 전송은 initSentry() 성공 시 flush된다.
 */

let initialized = false;
let buffer = [];
let Sentry;
const logger = require('./logger');

// ── PII 정화 ─────────────────────────────────────────────────────────────────
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|refresh[_-]?token|access[_-]?token|id[_-]?token|token|api[_-]?key|password|passwd|pwd|secret|client[_-]?secret|session|card[_-]?(no|num|number)|cvv|cvc|csc/i;

const MAX_STRING_LENGTH = 2048;

function isSensitiveKey(key) {
  return SENSITIVE_KEY_PATTERN.test(String(key || ''));
}

function decodeQueryKey(key) {
  try {
    return decodeURIComponent(String(key || '').replace(/\+/g, ' '));
  } catch (_err) {
    return String(key || '');
  }
}

function sanitizeValue(value, key) {
  if (value === null || value === undefined) return value;
  if (isSensitiveKey(key)) return '[REDACTED]';
  if (Array.isArray(value))
    return value.map(function (item) {
      return sanitizeValue(item, key);
    });
  if (typeof value === 'string') {
    if (value.length <= MAX_STRING_LENGTH) return value;
    return (
      value.slice(0, MAX_STRING_LENGTH) +
      '…(+' +
      (value.length - MAX_STRING_LENGTH) +
      ' chars truncated)'
    );
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: sanitizeValue(value.message) };
  if (typeof value === 'object') {
    const out = {};
    for (const k in value) out[k] = sanitizeValue(value[k], k);
    return out;
  }
  return value;
}

/** 쿼리스트링에서 민감 파라미터 제거 */
function stripQueryString(qs) {
  if (typeof qs !== 'string' || qs === '') return qs;
  const hasPrefix = qs.startsWith('?');
  const pairs = (hasPrefix ? qs.slice(1) : qs).split('&').filter(function (pair) {
    return pair;
  });
  const kept = pairs.filter(function (pair) {
    const pairKey = pair.split('=')[0];
    return !isSensitiveKey(decodeQueryKey(pairKey));
  });
  const joined = kept.join('&');
  if (!joined) return '';
  return hasPrefix ? '?' + joined : joined;
}

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
const NOISE_ROUTE_PATTERN = /\/(health|metrics|favicon\.ico|realtime)(\/|$|\?)/i;

function shouldDropTransaction(event) {
  if (!event || typeof event.transaction !== 'string') return false;
  const route = event.transaction.split(' ').pop() || '';
  return NOISE_ROUTE_PATTERN.test(route);
}

// ── 샘플링 비율 (env 오버라이드 가능) ────────────────────────────────────────
function clampRate(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

function getTraceRate() {
  const envRate = clampRate(process.env.SENTRY_TRACES_SAMPLE_RATE);
  if (envRate !== null) return envRate;
  return process.env.NODE_ENV === 'production' ? 0.1 : 0;
}

function getProfileRate() {
  const envRate = clampRate(process.env.SENTRY_PROFILE_SAMPLE_RATE);
  if (envRate !== null) return envRate;
  return process.env.NODE_ENV === 'production' ? 0.2 : 0;
}

/**
 * Sentry를 초기화한다.
 * SENTRY_DSN이 없으면 비활성화되며 null을 반환한다.
 * @returns {object|null}
 */
function initSentry() {
  if (initialized) return Sentry;
  if (process.env.NODE_ENV === 'test') {
    buffer = [];
    return null;
  }

  if (!process.env.SENTRY_DSN) {
    buffer = [];
    logger.warn(
      '[Sentry] SENTRY_DSN이 설정되지 않아 Sentry(에러·트레이스 수집)가 비활성화되었습니다.'
    );
    return null;
  }

  try {
    const pkg = require('../package.json');
    Sentry = require('@sentry/node');

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: 'wemarket-api@' + pkg.version,
      // 동적 샘플링 (과금 최적화): prod 기본 0.1, 나머지는 env로 제어
      tracesSampler: makeTracesSampler(),
      profilesSampleRate: getProfileRate(),
      // PII 정화: headers/cookies/body 제거 + 민감 키 재귀 redaction
      beforeSend: sanitizeEvent,
      beforeSendTransaction: function (event) {
        if (shouldDropTransaction(event)) return null;
        return sanitizeEvent(event);
      },
    });
  } catch (e) {
    buffer = [];
    logger.warn('[Sentry] 초기화 실패 — Sentry 비활성화: ' + e.message);
    return null;
  }

  initialized = true;

  // 버퍼된 예외/메시지 flush
  buffer.forEach(function (item) {
    if (item.type === 'exception') {
      sendException(item.args[0], item.args[1]);
    }
    if (item.type === 'message') {
      sendMessage(item.args[0], item.args[1], item.args[2]);
    }
  });
  buffer = [];
  module.exports.Sentry = Sentry;

  logger.info(
    '[Sentry] 초기화 완료 (tracesSampler=' +
      getTraceRate() +
      ', profilesSampleRate=' +
      getProfileRate() +
      ')'
  );
  return Sentry;
}

// ── PII 정화 / 이벤트 정화 / 트랜잭션 드롭 노출 (테스트/재사용) ─────────────────
const CAPTURE_OPT_KEYS = ['context', 'tags', 'level', 'user', 'extra'];

function makeTracesSampler(baseRate) {
  const rate = baseRate === undefined ? getTraceRate() : (clampRate(baseRate) ?? 0);
  return function () {
    return rate;
  };
}

// ── 예외를 Sentry로 전송한다. ──────────────────────────────────────────────
function buildCaptureOptions(opts) {
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) opts = {};

  const isNewForm = Object.keys(opts).some(function (k) {
    return CAPTURE_OPT_KEYS.includes(k);
  });
  const captureOpts = {};
  const extra = { ...(opts.context || {}), ...(opts.extra || {}) };
  const finalExtra = isNewForm ? extra : opts;
  if (finalExtra && Object.keys(finalExtra).length > 0) captureOpts.extra = finalExtra;
  if (opts.tags && typeof opts.tags === 'object' && Object.keys(opts.tags).length > 0) {
    captureOpts.tags = opts.tags;
  }
  if (opts.level) captureOpts.level = opts.level;
  if (opts.user) captureOpts.user = opts.user;
  return captureOpts;
}

function sendException(err, opts) {
  if (!Sentry || typeof Sentry.captureException !== 'function') return;
  Sentry.captureException(err, buildCaptureOptions(opts));
}

function captureException(err, opts) {
  if (!initialized) {
    buffer.push({ type: 'exception', args: [err, opts] });
    return;
  }
  sendException(err, opts);
}

// ── 메시지를 Sentry로 전송한다. ──────────────────────────────────────────────
function sendMessage(message, level, context) {
  if (!Sentry || typeof Sentry.captureMessage !== 'function') return;
  Sentry.captureMessage(message, { level: level || 'info', extra: context || {} });
}

function captureMessage(message, level, context) {
  if (!initialized) {
    buffer.push({ type: 'message', args: [message, level, context] });
    return;
  }
  sendMessage(message, level, context);
}

// ── 수동 스팬을 시작한다 (Express 미들웨어/서비스 내부 구간 측정용). ────────────
function startSpan(name, opts) {
  if (!initialized) return null;
  return Sentry.startSpan({
    name: name,
    op: opts ? opts.op || 'function' : 'function',
    ...(opts ? opts.attributes || {} : {}),
  });
}

// ── 백그라운드 작업(크론 등)을 Sentry 트랜잭션으로 감싸 실행한다. ────────────
function trace(name, fn, opts) {
  if (!initialized) return typeof fn === 'function' ? fn() : undefined;
  if (typeof fn !== 'function') return undefined;
  return Sentry.startSpan(
    {
      name: name,
      op: opts ? opts.op || 'function' : 'function',
      forceTransaction: true,
      ...(opts ? opts.attributes || {} : {}),
    },
    function () {
      return fn();
    }
  );
}

module.exports = {
  initSentry: initSentry,
  captureException: captureException,
  captureMessage: captureMessage,
  startSpan: startSpan,
  trace: trace,
  // 테스트/재사용 가능한 순수 헬퍼
  sanitizeValue: sanitizeValue,
  sanitizeEvent: sanitizeEvent,
  shouldDropTransaction: shouldDropTransaction,
  makeTracesSampler: makeTracesSampler,
  // Instrumentation 접근 (레거시 호환)
  Sentry: Sentry,
};
