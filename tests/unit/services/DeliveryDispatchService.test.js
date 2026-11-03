// 배달대행 공통 틀: 배차 요청·취소, 대행사 웹훅(서명·중복·순서), 주문 반영
const crypto = require('crypto');

jest.mock('../../../config/prisma', () => ({
  orders: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  stores: { findUnique: jest.fn() },
  delivery_dispatches: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  delivery_webhook_events: { create: jest.fn() },
  store_order_channels: { findUnique: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock('../../../services/ProviderCredentialService', () => ({ resolve: jest.fn() }));
jest.mock('../../../services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));

const prisma = require('../../../config/prisma');
const credentials = require('../../../services/ProviderCredentialService');
const notificationService = require('../../../services/notificationService');
const { getAdapter, listProviders, verifyHmac } = require('../../../services/delivery/adapters');
const DeliveryDispatchService = require('../../../services/delivery/DeliveryDispatchService');

const SECRET = 'mock-secret-0123456789';
const order = {
  id: 11,
  store_id: 3,
  order_number: 'N-11',
  order_type: 'delivery',
  status: 'confirmed',
  delivery_status: null,
};
const agencyChannels = {
  delivery_enabled: true,
  delivery_fulfillment: 'agency',
  agency_provider: 'mock',
};
const sign = (body) => crypto.createHmac('sha256', SECRET).update(body).digest('hex');

describe('배달대행 어댑터', () => {
  test('바로고·부릉·생각대로는 연동 준비 중, 테스트 대행사는 테스트 환경에서만', () => {
    const keys = listProviders().map((p) => `${p.key}:${p.ready}`);
    expect(keys).toEqual(['barogo:false', 'vroong:false', 'saenggakdaero:false', 'mock:true']);
    expect(() => getAdapter('barogo').requestDispatch({})).toThrow('준비 중');
    expect(getAdapter('unknown')).toBeNull();
  });

  test('HMAC 서명은 원본 바디와 매장 비밀값으로 검증한다', () => {
    const raw = Buffer.from('{"a":1}');
    const creds = { values: { api_secret: SECRET } };
    expect(
      verifyHmac({
        credentials: creds,
        rawBody: raw,
        headers: { 'x-delivery-signature': sign(raw) },
      })
    ).toBe(true);
    expect(
      verifyHmac({
        credentials: creds,
        rawBody: Buffer.from('{"a":2}'),
        headers: { 'x-delivery-signature': sign(raw) },
      })
    ).toBe(false);
    expect(verifyHmac({ credentials: creds, rawBody: raw, headers: {} })).toBe(false);
  });
});

describe('DeliveryDispatchService.request', () => {
  let svc;
  beforeEach(() => {
    jest.clearAllMocks();
    svc = new DeliveryDispatchService(null);
    prisma.orders.findUnique.mockResolvedValue(order);
    prisma.store_order_channels.findUnique.mockResolvedValue(agencyChannels);
    prisma.stores.findUnique.mockResolvedValue({ id: 3, name: '매장' });
    prisma.delivery_dispatches.findFirst.mockResolvedValue(null);
    prisma.delivery_dispatches.create.mockImplementation(async ({ data }) => ({ id: 1, ...data }));
    credentials.resolve.mockResolvedValue({ values: { api_key: 'k', api_secret: SECRET } });
  });

  test('테스트 대행사로 배차를 요청하고 기록한다', async () => {
    const out = await svc.request(11);
    expect(out).toMatchObject({ provider: 'mock', status: 'requested', fee: 3500 });
    expect(prisma.delivery_dispatches.create.mock.calls[0][0].data.external_id).toMatch(
      /^mock-11-/
    );
  });

  test('직접 배달 매장·계정 미연결·진행 중 배차·배달 아닌 주문은 거절', async () => {
    prisma.store_order_channels.findUnique.mockResolvedValueOnce({ delivery_fulfillment: 'self' });
    await expect(svc.request(11)).rejects.toThrow('배달대행을 쓰도록');
    credentials.resolve.mockResolvedValueOnce(null);
    await expect(svc.request(11)).rejects.toThrow('계정을 먼저 연결');
    prisma.delivery_dispatches.findFirst.mockResolvedValueOnce({ id: 9, status: 'assigned' });
    await expect(svc.request(11)).rejects.toThrow('이미 배차를 요청');
    prisma.orders.findUnique.mockResolvedValueOnce({ ...order, order_type: 'takeout' });
    await expect(svc.request(11)).rejects.toThrow('배달 주문이 아닙니다');
  });

  test('연동 준비 중인 대행사는 501', async () => {
    prisma.store_order_channels.findUnique.mockResolvedValue({
      ...agencyChannels,
      agency_provider: 'barogo',
    });
    await expect(svc.request(11)).rejects.toMatchObject({ statusCode: 501 });
  });
});

describe('DeliveryDispatchService.handleWebhook', () => {
  let svc;
  const orderService = { updateStatus: jest.fn().mockResolvedValue({}) };
  const dispatch = {
    id: 1,
    order_id: 11,
    store_id: 3,
    provider: 'mock',
    external_id: 'mock-11-a',
    status: 'requested',
  };
  const call = (payload, signature) => {
    const rawBody = Buffer.from(JSON.stringify(payload));
    return svc.handleWebhook({
      provider: 'mock',
      storeId: 3,
      rawBody,
      headers: { 'x-delivery-signature': signature ?? sign(rawBody) },
      body: payload,
      orderService,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new DeliveryDispatchService(null);
    credentials.resolve.mockResolvedValue({ values: { api_key: 'k', api_secret: SECRET } });
    prisma.delivery_dispatches.findFirst.mockResolvedValue(dispatch);
    prisma.delivery_dispatches.update.mockImplementation(async ({ data }) => ({
      ...dispatch,
      ...data,
    }));
    prisma.delivery_webhook_events.create.mockResolvedValue({});
    prisma.orders.findUnique.mockResolvedValue({ ...order });
    prisma.orders.updateMany.mockResolvedValue({ count: 1 });
    prisma.orders.update.mockResolvedValue({});
  });

  test('서명이 틀리면 401', async () => {
    await expect(
      call({ event_id: 'e1', dispatch_id: 'mock-11-a', status: 'assigned' }, 'f'.repeat(64))
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  test('같은 이벤트는 한 번만 처리', async () => {
    prisma.delivery_webhook_events.create.mockRejectedValueOnce(
      Object.assign(new Error('dup'), { code: 'P2002' })
    );
    await expect(
      call({ event_id: 'e1', dispatch_id: 'mock-11-a', status: 'assigned' })
    ).resolves.toEqual({ handled: false, duplicate: true });
    expect(prisma.delivery_dispatches.update).not.toHaveBeenCalled();
  });

  test('픽업 → 주문 준비 완료 + 배달 중', async () => {
    await call({
      event_id: 'e2',
      dispatch_id: 'mock-11-a',
      status: 'picked_up',
      rider: { name: '김기사' },
    });
    expect(prisma.delivery_dispatches.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'picked_up', rider_name: '김기사' }),
      })
    );
    expect(orderService.updateStatus).toHaveBeenCalledWith(11, 'ready', null, { role: 'system' });
    expect(prisma.orders.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delivery_status: 'delivering' }),
      })
    );
  });

  test('배달 완료 → 주문 완료', async () => {
    prisma.delivery_dispatches.findFirst.mockResolvedValue({ ...dispatch, status: 'picked_up' });
    prisma.orders.findUnique.mockResolvedValue({
      ...order,
      status: 'ready',
      delivery_status: 'delivering',
    });
    await call({ event_id: 'e3', dispatch_id: 'mock-11-a', status: 'delivered' });
    expect(prisma.orders.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delivery_status: 'delivered' }),
      })
    );
    expect(orderService.updateStatus).toHaveBeenCalledWith(11, 'completed', null, {
      role: 'system',
    });
  });

  test('늦게 온 이전 단계 이벤트는 상태를 되돌리지 않는다', async () => {
    prisma.delivery_dispatches.findFirst.mockResolvedValue({ ...dispatch, status: 'picked_up' });
    await call({ event_id: 'e4', dispatch_id: 'mock-11-a', status: 'assigned' });
    expect(prisma.delivery_dispatches.update).not.toHaveBeenCalled();
    expect(orderService.updateStatus).not.toHaveBeenCalled();
  });

  test('배차 실패 → 배달 진행을 되돌리고 사장님께 알림', async () => {
    await call({ event_id: 'e5', dispatch_id: 'mock-11-a', status: 'failed', reason: '기사 없음' });
    expect(prisma.orders.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delivery_status: null }),
      })
    );
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: 3,
        priority: 'high',
        message: expect.stringContaining('기사 없음'),
      })
    );
  });

  test('준비 중인 대행사 웹훅은 받지 않는다', async () => {
    await expect(
      svc.handleWebhook({
        provider: 'barogo',
        storeId: 3,
        rawBody: Buffer.from('{}'),
        headers: {},
        body: {},
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('DeliveryDispatchService.cancel', () => {
  test('픽업 전 배차만 취소', async () => {
    const svc = new DeliveryDispatchService(null);
    credentials.resolve.mockResolvedValue({ values: { api_key: 'k', api_secret: SECRET } });
    prisma.delivery_dispatches.findFirst.mockResolvedValueOnce({
      id: 1,
      order_id: 11,
      store_id: 3,
      provider: 'mock',
      status: 'picked_up',
    });
    await expect(svc.cancel(11)).rejects.toMatchObject({ statusCode: 409 });
    prisma.delivery_dispatches.findFirst.mockResolvedValueOnce({
      id: 1,
      order_id: 11,
      store_id: 3,
      provider: 'mock',
      status: 'assigned',
    });
    prisma.delivery_dispatches.update.mockResolvedValue({ id: 1, status: 'canceled' });
    prisma.orders.findUnique.mockResolvedValue(order);
    await expect(svc.cancel(11)).resolves.toMatchObject({ status: 'canceled' });
  });
});
