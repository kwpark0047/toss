/**
 * Sentry 지연 로딩 헬퍼
 * @sentry/react(+tracing)는 초기 번들에서 제외하고 필요 시에만 동적 import한다.
 * main chunk에서 ~478KB rendered 분량을 분리해 초기 로딩 비용을 줄인다.
 *
 * 주의: DEV 환경에서는 Sentry를 로드하지 않는다(초기화도, 전송도 하지 않음).
 */

let sentryPromise = null;

function loadSentry() {
  if (!sentryPromise) {
    sentryPromise = import('@sentry/react');
  }
  return sentryPromise;
}

/** 운영 환경에서만 Sentry 초기화 (첫 렌더 이후 호출 권장) */
export async function initSentry() {
  if (import.meta.env.DEV) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // DSN 미설정 시 초기화 생략 (소스 콘솔 placeholder 경고 방지)
  try {
    const Sentry = await loadSentry();
    const { BrowserTracing } = await import('@sentry/tracing');
    Sentry.init({
      dsn,
      integrations: [new BrowserTracing()],
      tracesSampleRate: 1.0,
      environment: import.meta.env.MODE,
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        return event;
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
