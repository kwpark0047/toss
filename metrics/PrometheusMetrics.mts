/**
 * Prometheus 표준 메트릭 모듈 (P1 Grafana/Prometheus 모니터링)
 *
 * prom-client 기반으로 HTTP 요청 수/지속시간/동시 처리 수를 수집하고,
 * 프로세스 기본 메트릭(event loop, 메모리, GC)과 앱 정보를 함께 노출한다.
 *
 * /api/metrics 엔드포인트(아래 metricsRouter 또는 app.ts)에서
 * `register.metrics()` 출력을 Prometheus 텍스트 포맷으로 반환한다.
 *
 * Cardinality 제어: HTTP 요청 카운터/히스토그램의 `route` 라벨은
 * 동적 숫자 세그먼트를 `:param`으로 정규화해 무한 증가를 막는다.
 * (예: /api/stores/42/menu -> /api/stores/:param/menu)
 */
import type { Request, Response, NextFunction } from 'express';
import {
  Counter,
  Histogram,
  Gauge,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

// ── 레지스트리(단일 인스턴스) ──────────────────────────────────────────────
export const registry = new Registry();

// 앱 정보 게이지 (버전/환경/시작 시각)
export const appInfoGauge = new Gauge({
  name: 'wemarket_app_info',
  help: 'WeMarket API 버전 및 실행 환경 정보',
  labelNames: ['version', 'environment'] as const,
  registers: [registry],
});

const APP_VERSION =
  (process.env.npm_package_version as string) || 'unknown';
const NODE_ENV = process.env.NODE_ENV || 'development';
appInfoGauge.set({ version: APP_VERSION, environment: NODE_ENV }, 1);

// HTTP 요청 수 카운터 (method × route × status)
export const httpRequestsTotal = new Counter({
  name: 'wemarket_http_requests_total',
  help: 'HTTP 요청 총 수',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

// HTTP 요청 지속시간 히스토그램 (버킷 10ms ~ 30s)
export const httpRequestDurationSeconds = new Histogram({
  name: 'wemarket_http_request_duration_seconds',
  help: 'HTTP 요청 처리 지속시간 (초)',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [registry],
});

// 동시 처리 중인 HTTP 요청 수 게이지
export const httpRequestsInFlight = new Gauge({
  name: 'wemarket_http_requests_in_flight',
  help: '동시에 처리 중인 HTTP 요청 수',
  registers: [registry],
});

// DB(Prisma) 쿼리 지속시간 히스토그램 — 트랜잭션 경험 측정용
export const dbQueryDurationSeconds = new Histogram({
  name: 'wemarket_db_query_duration_seconds',
  help: 'Prisma 쿼리 지속시간 (초)',
  labelNames: ['model', 'operation'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2.5],
  registers: [registry],
});

let defaultMetricsStarted = false;

/**
 * 프로세스 기본 메트릭(event loop lag, RSS/힙 메모리, GC, CPU)을
 * 한 번만 등록한다. 등록은 레지스트리 단위로 중복 방지된다.
 */
export function initDefaultMetrics(): void {
  if (defaultMetricsStarted) return;
  defaultMetricsStarted = true;
  try {
    collectDefaultMetrics({
      register: registry,
      prefix: 'wemarket_',
      eventLoopMonitoringPrecision: 10,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Prometheus] default metrics 등록 실패:', err);
  }
}

/**
 * 동적 path를 Prometheus route 템플릿으로 정규화한다.
 * 숫자 세그먼트(주문/매장/상품 id 등)와 uuid 형식을 `:param`으로 치환해
 * 라벨 카디널리티를 제한한다.
 */
export function normalizeRoute(path: string): string {
  if (!path) return path;
  return path
    .split('/')
    .map((seg) => {
      if (seg === '') return seg;
      // 숫자만, 또는 숫자-숫자 범위 → :param
      if (/^\d+$/.test(seg)) return ':param';
      // 8-4-4-4-12 uuid → :param
      if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(seg)) {
        return ':param';
      }
      return seg;
    })
    .join('/');
}

/**
 * Express 미들웨어 — 모든 HTTP 요청에 대해 지속시간/카운터/동시실행을 기록한다.
 * 경로는 normalizeRoute 로 템플릿화해 카디널리티를 제어한다.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 자기 자신(/api/metrics)과 모니터링/헬스체크는 집계에서 제외해 스크랩 노이즈를 막는다.
  const path = req.originalUrl || req.url || '';
  if (
    path === '/api/metrics' ||
    path.startsWith('/api/health') ||
    path.includes('/monitoring/metrics')
  ) {
    return next();
  }

  const route = normalizeRoute(path.split('?')[0]);
  const end = httpRequestDurationSeconds.startTimer({ method: req.method, route });
  httpRequestsInFlight.inc();

  let finished = false;
  const settle = () => {
    if (finished) return;
    finished = true;
    httpRequestsInFlight.dec();
    const status = String(res.statusCode);
    httpRequestsTotal.inc({ method: req.method, route, status });
    end({ status });
  };

  // 응답 헤더/본문 전송 완료(정상 종료) 시 1회 기록
  res.on('finish', settle);
  // 연결이 비정상 종료(close)되어도 미기록 상태라면 한 번만 기록(누수 방지)
  res.on('close', settle);

  next();
}
