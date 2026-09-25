/**
 * Sentry 지연 로딩 헬퍼
 * @sentry/react는 초기 번들에서 제외하고 필요 시에만 동적 import한다.
 * main chunk에서 ~478KB rendered 분량을 분리해 초기 로딩 비용을 줄인다.
 *
 * 주의: DEV 환경에서는 Sentry를 로드하지 않는다(초기화도, 전송도 하지 않음).
 *
 * 고도화 (트레이스 정비):
 * - 레거시 @sentry/tracing(v7 BrowserTracing) import 제거 → @sentry/react v10의
 *   browserTracingIntegration() 사용 (레거시 패키지와의 비호환 제거)
 * - 전역 tracesSampleRate 대신 tracesSampler(env VITE_SENTRY_TRACES_SAMPLE_RATE, 기본 1.0)
 * - 노이즈(health/metrics/realtime 폴링) 트랜잭션 제외 + request PII 정화
 */

let sentryPromise = null;

function loadSentry() {
  if (!sentryPromise) {
    sentryPromise = import('@sentry/react');
  }
  return sentryPromise;
}

/** 트레이스 샘플링 비율 — VITE_SENTRY_TRACES_SAMPLE_RATE(0~1)로 오버라이드, 기본 1.0 */
function resolveTraceRate() {
  const raw = import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE;
  if (raw === undefined || raw === '') return 1.0;
  const rate = Number(raw);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 1.0;
}

/** 폴링/헬스 등 정보 가치가 낮은 트랜잭션 제외 */
function shouldDropTransaction(event) {
  const transaction = event?.transaction;
  if (!transaction) return false;
  const route = String(transaction).split(' ').pop() || '';
  return /\/?(health|metrics|favicon\.ico|realtime)(\/|$|\?)/i.test(route);
}

/** request의 민감 필드(헤더·쿠키·body) 제거 및 query 파라미터 정화 */
function sanitizeEvent(event) {
  if (!event || typeof event !== 'object') return event;
  if (event.request && typeof event.request === 'object') {
    const request = { ...event.request };
    delete request.headers;
    delete request.cookies;
    delete request.data;
    if (typeof request.query_string === 'string' && request.query_string) {
      const hasPrefix = request.query_string.startsWith('?');
      const pairs = (hasPrefix ? request.query_string.slice(1) : request.query_string)
        .split('&')
        .filter(Boolean);
      const kept = pairs.filter(
        (pair) =>
          !/(authorization|cookie|token|secret|password|session|api[_-]?key)/i.test(
            (pair.split('=')[0] || ''),
          ),
      );
      const joined = kept.join('&');
      request.query_string = joined ? (hasPrefix ? `?${joined}` : joined) : '';
    }
    event.request = request;
  }
  return event;
}

/** 운영 환경에서만 Sentry 초기화 (첫 렌더 이후 호출 권장) */
export async function initSentry() {
  if (import.meta.env.DEV) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // DSN 미설정 시 초기화 생략
  try {
    const Sentry = await loadSentry();
    Sentry.init({
      dsn,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampler: () => resolveTraceRate(),
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      beforeSend: sanitizeEvent,
      beforeSendTransaction(event) {
        if (shouldDropTransaction(event)) return null;
        return sanitizeEvent(event);
      },
    });
  } catch (error) {
    console.error('[sentry] init failed:', error);
  }
}

/** 예외 전송 (실패해도 앱 동작에 영향 없음) */
export async function captureException(error, context) {
  if (import.meta.env.DEV) return;
  try {
    const Sentry = await loadSentry();
    return Sentry.captureException(error, context);
  } catch {
    // 오류 추적이 실패해도 앱은 계속 동작해야 한다.
  }
  return undefined;
}

/** 사용자 컨텍스트 동기화 (로그인/로그아웃 시 호출) */
export async function syncSentryUser(user) {
  if (import.meta.env.DEV) return;
  try {
    const Sentry = await loadSentry();
    if (!user) {
      Sentry.setUser(null);
      return;
    }
    Sentry.setUser({
      id: String(user.id ?? ''),
      username: user.name ?? undefined,
      role: user.role ?? undefined,
    });
    Sentry.setTag('user_role', user.role ?? 'anonymous');
  } catch {
    // 무시 — 전송 실패는 치명적이지 않다.
  }
}