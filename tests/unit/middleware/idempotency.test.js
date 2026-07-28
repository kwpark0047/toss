/**
 * 멱등성 미들웨어 테스트 (M-10)
 *
 * 모바일 네트워크 타임아웃 후 재시도로 인한 중복 주문/중복 결제를 막는다.
 */
jest.mock('../../../utils/redisCache', () => ({
  isConnected: false,
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const idempotency = require('../../../middleware/idempotency');
const redisCache = require('../../../utils/redisCache');

/** 최소한의 res 스텁 (json 후킹, 헤더 기록, 이벤트) */
function makeRes() {
  const listeners = {};
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    set(k, v) {
      this.headers[k] = v;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    on(evt, fn) {
      (listeners[evt] ||= []).push(fn);
      return this;
    },
    emit(evt) {
      (listeners[evt] || []).forEach((fn) => fn());
    },
  };
  return res;
}

function makeReq(overrides = {}) {
  return {
    method: 'POST',
    originalUrl: '/api/orders',
    path: '/api/orders',
    headers: {},
    body: { store_id: 1, total_amount: 10000 },
    ip: '1.2.3.4',
    user: { id: 7 },
    ...overrides,
  };
}

/** 미들웨어를 실행하고 "핸들러가 응답을 내보내는" 흐름까지 재현 */
async function runWithHandler(mw, req, res, handler) {
  const next = jest.fn(() => handler && handler(req, res));
  await mw(req, res, next);
  return next;
}

describe('idempotency 미들웨어', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisCache.isConnected = false;
    idempotency._clearMemoryStore();
  });

  describe('헤더가 없을 때', () => {
    test('기본 설정에서는 그대로 통과한다 (하위 호환)', async () => {
      const mw = idempotency({ namespace: 'test' });
      const req = makeReq();
      const res = makeRes();
      const next = await runWithHandler(mw, req, res);
      expect(next).toHaveBeenCalled();
    });

    test('required: true 면 400 을 반환한다', async () => {
      const mw = idempotency({ namespace: 'test', required: true });
      const req = makeReq();
      const res = makeRes();
      const next = jest.fn();
      await mw(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('중복 요청 차단', () => {
    test('[핵심] 완료된 요청은 저장된 응답을 재생한다', async () => {
      const mw = idempotency({ namespace: 'orders:create' });
      const key = 'uuid-1111';

      // 1회차 — 실제 처리
      const req1 = makeReq({ headers: { 'idempotency-key': key } });
      const res1 = makeRes();
      await runWithHandler(mw, req1, res1, (_r, r) => {
        r.statusCode = 201;
        r.json({ success: true, order_id: 42 });
      });
      expect(res1.body).toEqual({ success: true, order_id: 42 });

      // 2회차 — 동일 키 재시도
      const req2 = makeReq({ headers: { 'idempotency-key': key } });
      const res2 = makeRes();
      const handler2 = jest.fn();
      await runWithHandler(mw, req2, res2, handler2);

      expect(handler2).not.toHaveBeenCalled(); // 핸들러가 다시 실행되면 중복 주문
      expect(res2.statusCode).toBe(201);
      expect(res2.body).toEqual({ success: true, order_id: 42 });
      expect(res2.headers['Idempotency-Replayed']).toBe('true');
    });

    test('처리 중인 동일 키 요청은 409 로 거절한다', async () => {
      const mw = idempotency({ namespace: 'orders:create' });
      const key = 'uuid-2222';

      // 1회차 — next 만 호출되고 아직 응답하지 않은 상태
      const req1 = makeReq({ headers: { 'idempotency-key': key } });
      const res1 = makeRes();
      await mw(req1, res1, jest.fn());

      // 동시 도착한 2회차
      const req2 = makeReq({ headers: { 'idempotency-key': key } });
      const res2 = makeRes();
      const next2 = jest.fn();
      await mw(req2, res2, next2);

      expect(res2.statusCode).toBe(409);
      expect(next2).not.toHaveBeenCalled();
      expect(res2.headers['Retry-After']).toBe('2');
    });

    test('같은 키로 다른 본문을 보내면 422', async () => {
      const mw = idempotency({ namespace: 'orders:create' });
      const key = 'uuid-3333';

      const req1 = makeReq({ headers: { 'idempotency-key': key } });
      const res1 = makeRes();
      await runWithHandler(mw, req1, res1, (_r, r) => {
        r.statusCode = 201;
        r.json({ ok: 1 });
      });

      const req2 = makeReq({
        headers: { 'idempotency-key': key },
        body: { store_id: 1, total_amount: 999999 }, // 금액이 다름
      });
      const res2 = makeRes();
      const next2 = jest.fn();
      await mw(req2, res2, next2);

      expect(res2.statusCode).toBe(422);
      expect(next2).not.toHaveBeenCalled();
    });
  });

  describe('실패 응답은 캐시하지 않는다', () => {
    test('4xx 이후 동일 키 재시도는 다시 처리된다', async () => {
      const mw = idempotency({ namespace: 'orders:create' });
      const key = 'uuid-4444';

      const req1 = makeReq({ headers: { 'idempotency-key': key } });
      const res1 = makeRes();
      await runWithHandler(mw, req1, res1, (_r, r) => {
        r.statusCode = 400;
        r.json({ error: '재고 부족' });
      });

      const req2 = makeReq({ headers: { 'idempotency-key': key } });
      const res2 = makeRes();
      const handler2 = jest.fn((_r, r) => {
        r.statusCode = 201;
        r.json({ ok: true });
      });
      await runWithHandler(mw, req2, res2, handler2);

      expect(handler2).toHaveBeenCalled();
      expect(res2.statusCode).toBe(201);
    });
  });

  describe('키 스코프 분리', () => {
    test('다른 사용자가 같은 키를 써도 서로 간섭하지 않는다', async () => {
      const mw = idempotency({ namespace: 'orders:create' });
      const key = 'shared-key';

      const resA = makeRes();
      await runWithHandler(
        mw,
        makeReq({ headers: { 'idempotency-key': key }, user: { id: 1 } }),
        resA,
        (_r, r) => {
          r.statusCode = 201;
          r.json({ owner: 'A' });
        }
      );

      const resB = makeRes();
      const handlerB = jest.fn((_r, r) => {
        r.statusCode = 201;
        r.json({ owner: 'B' });
      });
      await runWithHandler(
        mw,
        makeReq({ headers: { 'idempotency-key': key }, user: { id: 2 } }),
        resB,
        handlerB
      );

      expect(handlerB).toHaveBeenCalled();
      expect(resB.body).toEqual({ owner: 'B' });
    });

    test('네임스페이스가 다르면 서로 간섭하지 않는다', async () => {
      const key = 'ns-key';
      const mwOrders = idempotency({ namespace: 'orders:create' });
      const mwPayments = idempotency({ namespace: 'payments:confirm' });

      await runWithHandler(
        mwOrders,
        makeReq({ headers: { 'idempotency-key': key } }),
        makeRes(),
        (_r, r) => {
          r.statusCode = 201;
          r.json({ from: 'orders' });
        }
      );

      const res2 = makeRes();
      const handler2 = jest.fn((_r, r) => {
        r.statusCode = 200;
        r.json({ from: 'payments' });
      });
      await runWithHandler(
        mwPayments,
        makeReq({ headers: { 'idempotency-key': key } }),
        res2,
        handler2
      );

      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('입력 검증', () => {
    test('지나치게 긴 키는 400', async () => {
      const mw = idempotency({ namespace: 'test' });
      const req = makeReq({ headers: { 'idempotency-key': 'x'.repeat(300) } });
      const res = makeRes();
      const next = jest.fn();
      await mw(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('x-idempotency-key 헤더도 인식한다', async () => {
      const mw = idempotency({ namespace: 'test' });
      const key = 'alt-header-key';

      await runWithHandler(
        mw,
        makeReq({ headers: { 'x-idempotency-key': key } }),
        makeRes(),
        (_r, r) => {
          r.statusCode = 200;
          r.json({ v: 1 });
        }
      );

      const res2 = makeRes();
      const handler2 = jest.fn();
      await runWithHandler(mw, makeReq({ headers: { 'x-idempotency-key': key } }), res2, handler2);

      expect(handler2).not.toHaveBeenCalled();
      expect(res2.body).toEqual({ v: 1 });
    });
  });

  describe('저장소 장애 내성', () => {
    test('Redis 조회가 실패해도 요청을 막지 않는다 (가용성 우선)', async () => {
      redisCache.isConnected = true;
      redisCache.get.mockRejectedValue(new Error('redis down'));
      redisCache.set.mockRejectedValue(new Error('redis down'));

      const mw = idempotency({ namespace: 'test' });
      const req = makeReq({ headers: { 'idempotency-key': 'k' } });
      const res = makeRes();
      const next = jest.fn();

      await mw(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('잠금 해제', () => {
    test('응답 없이 연결이 끊기면 in-flight 표시를 해제한다', async () => {
      const mw = idempotency({ namespace: 'test' });
      const key = 'aborted-key';

      const req1 = makeReq({ headers: { 'idempotency-key': key } });
      const res1 = makeRes();
      await mw(req1, res1, jest.fn());
      res1.emit('close'); // 클라이언트 중단

      // 재시도는 409 가 아니라 정상 처리되어야 한다
      const res2 = makeRes();
      const handler2 = jest.fn((_r, r) => {
        r.statusCode = 201;
        r.json({ ok: true });
      });
      await runWithHandler(mw, makeReq({ headers: { 'idempotency-key': key } }), res2, handler2);

      expect(handler2).toHaveBeenCalled();
      expect(res2.statusCode).toBe(201);
    });
  });
});
