/**
 * webhookDispatcher 단위 테스트
 * Prisma CRUD 변환 후 동작 보존 검증: emitEvent → delivery 생성 → 발송 시도 → 상태 업데이트
 */
const crypto = require('crypto');

/* jest-jasmine2 환경에서 AbortController 폴리필 */
if (typeof global.AbortController === 'undefined') {
  global.AbortController = class {
    constructor() { this.signal = { aborted: false }; }
    abort() { this.signal.aborted = true; }
  };
}

// Prisma mock — findMany, create, update, findUnique chain
const mockPrisma = {
  webhook_endpoints: { findMany: jest.fn(), findUnique: jest.fn() },
  webhook_deliveries: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
};
jest.mock('../../config/prisma', () => mockPrisma);

jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

// SSRF 가드 모킹 — 발송 로직 자체를 테스트하므로 URL 검증은 통과시킴
// (실제 SSRF 차단 동작은 ssrfGuard 전용 테스트에서 검증)
jest.mock('../../utils/ssrfGuard', () => ({ validateWebhookUrl: jest.fn().mockResolvedValue({ ok: true }) }));

const { emitEvent, attemptDelivery, sign, startRetryScheduler, MAX_ATTEMPTS } = require('../../services/webhookDispatcher');

const EP_ID = 99;
const MOCK_ENDPOINT = {
  id: EP_ID, store_id: 1, url: 'https://hooks.example.com/we',
  secret: 'sekret', events: 'order.created,payment.completed', active: true,
};

beforeEach(() => { jest.clearAllMocks(); jest.useRealTimers(); });
afterEach(() => { delete global.fetch; });

/* ------------------------------------------------------------------ */
/*  sign()                                                             */
/* ------------------------------------------------------------------ */
describe('sign()', () => {
  it('HMAC-SHA256 hex 서명 생성', () => {
    const expected = crypto.createHmac('sha256', 'sekret')
      .update('1712345678.{"hello":"world"}').digest('hex');
    expect(sign('sekret', '1712345678', '{"hello":"world"}')).toBe(expected);
  });
  it('서로 다른 secret은 다른 서명', () => {
    expect(sign('secret-a', '100', 'body')).not.toBe(sign('secret-b', '100', 'body'));
  });
});

/* ------------------------------------------------------------------ */
/*  attemptDelivery — 직접 테스트 (fire-and-forget 우회)                 */
/* ------------------------------------------------------------------ */
describe('attemptDelivery() — success path', () => {
  it('200 응답 시 delivery 상태를 success로 갱신', async () => {
    const delivery = { id: 3000, endpoint_id: EP_ID, event_type: 'payment.completed', payload: { amount: 1000 }, attempts: 0, status: 'pending' };
    mockPrisma.webhook_deliveries.update.mockResolvedValue({});
    global.fetch = jest.fn(() => Promise.resolve({ status: 200 }));

    const result = await attemptDelivery(delivery, MOCK_ENDPOINT);

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe(MOCK_ENDPOINT.url);
    expect(mockPrisma.webhook_deliveries.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3000 },
        data: expect.objectContaining({ status: 'success', attempts: 1 }),
      })
    );
  });
});

describe('attemptDelivery() — failure / retry', () => {
  it('HTTP 500 시 status=pending, next_retry_at 설정', async () => {
    const delivery = { id: 4000, endpoint_id: EP_ID, event_type: 'payment.completed', payload: { amount: 1000 }, attempts: 0, status: 'pending' };
    mockPrisma.webhook_deliveries.update.mockResolvedValue({});
    global.fetch = jest.fn(() => Promise.resolve({ status: 500 }));

    const result = await attemptDelivery(delivery, MOCK_ENDPOINT);

    expect(result).toBe(false);
    expect(mockPrisma.webhook_deliveries.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 4000 },
        data: expect.objectContaining({ status: 'pending', attempts: 1, response_status: 500, next_retry_at: expect.any(Date) }),
      })
    );
  });

  it('최대 시도 소진 시 status=failed, next_retry_at=null', async () => {
    const delivery = { id: 5000, endpoint_id: EP_ID, event_type: 'order.created', payload: {}, attempts: MAX_ATTEMPTS, status: 'pending' };
    mockPrisma.webhook_deliveries.update.mockResolvedValue({});
    global.fetch = jest.fn(() => Promise.resolve({ status: 500 }));

    const result = await attemptDelivery(delivery, MOCK_ENDPOINT);

    expect(result).toBe(false);
    const updateCall = mockPrisma.webhook_deliveries.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('failed');
    expect(updateCall.data.attempts).toBe(MAX_ATTEMPTS + 1);
    // exhausted 시 next_retry_at은 DB 필드를 변경하지 않음 (updateData에 포함되지 않음)
    expect(updateCall.data).not.toHaveProperty('next_retry_at');
  });

  it('fetch 예외 시 last_error에 메시지 기록', async () => {
    const delivery = { id: 6000, endpoint_id: EP_ID, event_type: 'order.created', payload: {}, attempts: 0, status: 'pending' };
    mockPrisma.webhook_deliveries.update.mockResolvedValue({});
    global.fetch = jest.fn(() => Promise.reject(new Error('ECONNREFUSED')));

    const result = await attemptDelivery(delivery, MOCK_ENDPOINT);

    expect(result).toBe(false);
    const updateCall = mockPrisma.webhook_deliveries.update.mock.calls[0][0];
    expect(updateCall.data.last_error).toContain('ECONNREFUSED');
  });
});

/* ------------------------------------------------------------------ */
/*  emitEvent() — delivery 생성 + attemptDelivery 연결만 확인            */
/* ------------------------------------------------------------------ */
describe('emitEvent()', () => {
  it('활성 엔드포인트가 없으면 아무것도 하지 않음', async () => {
    mockPrisma.webhook_endpoints.findMany.mockResolvedValue([]);
    await emitEvent(1, 'order.created', { order_id: 1 });
    expect(mockPrisma.webhook_deliveries.create).not.toHaveBeenCalled();
  });

  it('매칭되는 엔드포인트로 delivery 생성 및 페이로드 구성', async () => {
    mockPrisma.webhook_endpoints.findMany.mockResolvedValue([MOCK_ENDPOINT]);
    mockPrisma.webhook_deliveries.create.mockImplementation(async (args) => ({
      id: 1000, endpoint_id: EP_ID, event_type: 'order.created',
      payload: args.data.payload, attempts: 0, status: 'pending',
    }));

    await emitEvent(1, 'order.created', { foo: 'bar' });

    expect(mockPrisma.webhook_deliveries.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        endpoint_id: EP_ID,
        event_type: 'order.created',
        payload: expect.objectContaining({ type: 'order.created', data: { foo: 'bar' } }),
      }),
    });
  });

  it('event_type이 "*"인 엔드포인트는 모든 이벤트 수신', async () => {
    mockPrisma.webhook_endpoints.findMany.mockResolvedValue([{ ...MOCK_ENDPOINT, events: '*' }]);
    mockPrisma.webhook_deliveries.create.mockResolvedValue({ id: 2000, endpoint_id: EP_ID, event_type: 'any.event', payload: {}, attempts: 0, status: 'pending' });

    await emitEvent(1, 'any.event', {});
    expect(mockPrisma.webhook_deliveries.create).toHaveBeenCalledTimes(1);
  });

  it('이벤트 미매칭 엔드포인트는 건너뜀', async () => {
    mockPrisma.webhook_endpoints.findMany.mockResolvedValue([{ ...MOCK_ENDPOINT, events: 'order.refunded' }]);
    await emitEvent(1, 'order.created', {});
    expect(mockPrisma.webhook_deliveries.create).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  startRetryScheduler()                                              */
/* ------------------------------------------------------------------ */
describe('startRetryScheduler()', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  /** setInterval(async) 내부 await 체인을 완료시키기 위해 이벤트 루프 펌프 */
  async function pump() {
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  it('지연된 pending delivery를 재발송', async () => {
    mockPrisma.webhook_deliveries.findMany.mockResolvedValue([{
      id: 8000, endpoint_id: EP_ID, event_type: 'order.created',
      payload: { retry: true }, attempts: 1, status: 'pending',
    }]);
    mockPrisma.webhook_endpoints.findUnique.mockResolvedValue(MOCK_ENDPOINT);
    mockPrisma.webhook_deliveries.update.mockResolvedValue({});
    global.fetch = jest.fn(() => Promise.resolve({ status: 200 }));

    startRetryScheduler(1000);
    jest.advanceTimersByTime(1000);
    await pump();

    expect(mockPrisma.webhook_deliveries.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'pending' }) })
    );
    expect(mockPrisma.webhook_endpoints.findUnique).toHaveBeenCalledWith({ where: { id: EP_ID } });
  });

  it('비활성화된 엔드포인트는 재시도하지 않음', async () => {
    mockPrisma.webhook_deliveries.findMany.mockResolvedValue([{
      id: 9000, endpoint_id: EP_ID, event_type: 'order.created',
      payload: {}, attempts: 1, status: 'pending',
    }]);
    mockPrisma.webhook_endpoints.findUnique.mockResolvedValue({ ...MOCK_ENDPOINT, active: false });
    global.fetch = jest.fn();

    startRetryScheduler(1000);
    jest.advanceTimersByTime(1000);
    await pump();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
