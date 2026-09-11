/**
 * PrometheusMetrics (P1 모니터링) 단위 테스트
 * tests/unit/metrics/prometheusMetrics.test.ts
 *
 * 검증 대상:
 *  - normalizeRoute: 동적 경로를 Prometheus route 템플릿으로 정규화 (카디널리티 제어)
 *  - metricsMiddleware: HTTP 요청에 대해 카운터/히스토그램/inFlight 기록
 *  - initDefaultMetrics: 프로세스 기본 메트릭을 한 번만 등록
 *  - registry 로부터 표준 메트릭명 노출 확인
 */
import { NextFunction, Request, Response } from 'express';
const {
  registry,
  normalizeRoute,
  metricsMiddleware,
  initDefaultMetrics,
  httpRequestsInFlight,
  httpRequestDurationSeconds,
} = require('../../../metrics/PrometheusMetrics');

/**
 * Express res 객체를 흉내 낸다. `on`/`once`로 등록된 finish/close
 * 이벤트를 트리거할 수 있게 해준다.
 */
function mockRes() {
  const listeners: Record<string, Array<() => void>> = {};
  const res: any = {
    statusCode: 200,
    on: (evt: string, cb: () => void) => {
      (listeners[evt] = listeners[evt] || []).push(cb);
    },
    once: (evt: string, cb: () => void) => {
      (listeners[evt] = listeners[evt] || []).push(cb);
    },
  };
  const fire = (evt: string) => (listeners[evt] || []).forEach((cb) => cb());
  return { res, fire };
}

function makeReq(path: string, method = 'GET'): Request {
  return {
    method,
    url: path,
    originalUrl: path,
  } as unknown as Request;
}

/**
 * prom-client v15: Gauge.get() 는 Promise<Collector> 를 반환하므로
 * values[0].value 로 값을 꺼낸다. 아직 기록이 없으면 0.
 */
async function inFlightValue(): Promise<number> {
  const c = await httpRequestsInFlight.get();
  return c.values[0]?.value ?? 0;
}

/**
 * 히스토그램 count 시리즈에서 특정 라벨 조합의 관측 수를 반환한다.
 * v15 에서 labels() 는 observe 만 노출하므로 get() 으로 역추적한다.
 */
async function durationCountFor(
  method: string,
  route: string,
  status: string
): Promise<number | undefined> {
  const c = await httpRequestDurationSeconds.get();
  const hit = c.values.find(
    (entry) =>
      entry.metricName === 'wemarket_http_request_duration_seconds_count' &&
      entry.labels.method === method &&
      entry.labels.route === route &&
      entry.labels.status === status
  );
  return hit?.value;
}

describe('normalizeRoute', () => {
  it('숫자 세그먼트를 :param으로 치환', () => {
    expect(normalizeRoute('/api/stores/42/menu')).toBe('/api/stores/:param/menu');
  });

  it('uuid 세그먼트를 :param으로 치환', () => {
    const uuid = 'a1b2c3d4-1234-5678-9abc-def012345678';
    expect(normalizeRoute(`/api/orders/${uuid}`)).toBe('/api/orders/:param');
  });

  it('정적 경로는 그대로 유지', () => {
    expect(normalizeRoute('/api/auth/login')).toBe('/api/auth/login');
  });

  it('여러 숫자/혼합 경로 정규화', () => {
    expect(normalizeRoute('/api/stores/1/orders/2/items')).toBe(
      '/api/stores/:param/orders/:param/items'
    );
  });

  it('빈 경로 처리', () => {
    expect(normalizeRoute('')).toBe('');
  });
});

describe('metricsMiddleware', () => {
  it('정상 응답 시 히스토그램 라벨에 정규화 경로 기록', async () => {
    const { res, fire } = mockRes();
    metricsMiddleware(
      makeReq('/api/stores/42/menu'),
      res as Response,
      (() => {}) as NextFunction
    );

    // 요청 시작 시 inFlight 증가 (prom-client v15: get() 는 async)
    expect(await inFlightValue()).toBe(1);

    // 응답 완료 시 settle 실행
    fire('finish');

    const labels = `/api/stores/:param/menu`;
    // 정규화된 경로 라벨로 시리즈가 기록됐는지 count 로 확인 (v15: labels() 는 observe 만 노출)
    expect(await durationCountFor('GET', labels, '200')).toBe(1);

    // settle 은 finish 에서만 실행되어 inFlight 는 0 이 되어야 함 (close 는 이중 감소 안 함)
    fire('close');
    expect(await inFlightValue()).toBe(0);
  });

  it('inFlight 는 close 가 먼저 와도 정확히 1회만 감소', async () => {
    const { res, fire } = mockRes();
    metricsMiddleware(makeReq('/api/auth/login'), res as Response, (() => {}) as NextFunction);
    expect(await inFlightValue()).toBe(1);

    // close 가 finish 보다 먼저 (클라이언트 연결 종료)
    fire('close');
    expect(await inFlightValue()).toBe(0);

    // 이후 finish 가 와도 이중 감소하지 않는다
    fire('finish');
    expect(await inFlightValue()).toBe(0);
  });

  it('/api/metrics, /api/health 경로는 집계에서 제외 (inFlight 미증가)', async () => {
    const excluded = ['/api/metrics', '/api/health', '/api/health/live'];
    for (const p of excluded) {
      const { res } = mockRes();
      const next = jest.fn();
      metricsMiddleware(makeReq(p), res as Response, next as NextFunction);
      expect(next).toHaveBeenCalled();
      expect(await inFlightValue()).toBe(0);
    }
  });
});

describe('initDefaultMetrics', () => {
  it('프로세스 기본 메트릭을 한 번만 등록 — 중복 호출 안전', () => {
    initDefaultMetrics();
    // 중복 호출해도 예외 없이 통과 (내부 가드)
    expect(() => initDefaultMetrics()).not.toThrow();
    initDefaultMetrics();
  });
});

describe('registry 메트릭 노출', () => {
  it('표준 메트릭명이 Prometheus 텍스트 포맷으로 노출', async () => {
    const text = await registry.metrics();
    expect(text).toContain('wemarket_app_info');
    expect(text).toContain('wemarket_http_requests_total');
    expect(text).toContain('wemarket_http_request_duration_seconds');
    expect(text).toContain('wemarket_http_requests_in_flight');
  });
});
