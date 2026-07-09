/**
 * notificationService 단위 테스트
 * 실제 구조: firebase-admin(푸시) + prisma(notifications 테이블) + Socket.io(실시간)
 */
jest.mock('../../../config/prisma', () => ({
  notifications: { create: jest.fn() },
  stores: { findUnique: jest.fn().mockResolvedValue(null) },
  users: { findUnique: jest.fn().mockResolvedValue(null) },
}));

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  messaging: jest.fn(() => ({ send: jest.fn() })),
}));

const prisma = require('../../../config/prisma');
const notificationService = require('../../../services/notificationService');

const makeRecord = (over = {}) => ({
  id: 1,
  store_id: 3,
  type: 'NEW_ORDER',
  title: '제목',
  message: '내용',
  data: null,
  priority: 'normal',
  link: null,
  created_at: new Date('2026-07-05T00:00:00Z'),
  ...over,
});

describe('notificationService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createNotification', () => {
    test('notifications 테이블에 레코드를 생성한다', async () => {
      prisma.notifications.create.mockResolvedValue(makeRecord());

      const result = await notificationService.createNotification({
        store_id: 3, type: 'NEW_ORDER', title: '제목', message: '내용',
      });

      expect(result).not.toBeNull();
      const args = prisma.notifications.create.mock.calls[0][0];
      expect(args.data.store_id).toBe(3);
      expect(args.data.type).toBe('NEW_ORDER');
    });

    test('data 객체는 JSON 문자열로 직렬화된다', async () => {
      prisma.notifications.create.mockResolvedValue(makeRecord());

      await notificationService.createNotification({
        store_id: 3, type: 'X', title: 't', message: 'm', data: { orderId: 7 },
      });

      const args = prisma.notifications.create.mock.calls[0][0];
      expect(args.data.data).toBe(JSON.stringify({ orderId: 7 }));
    });

    test('DB 실패 시 예외를 전파하지 않고 null을 반환한다 (주문 흐름 보호)', async () => {
      prisma.notifications.create.mockRejectedValue(new Error('DB down'));

      const result = await notificationService.createNotification({
        store_id: 3, type: 'X', title: 't', message: 'm',
      });

      expect(result).toBeNull();
    });

    test('store_id 문자열도 숫자로 변환된다', async () => {
      prisma.notifications.create.mockResolvedValue(makeRecord());

      await notificationService.createNotification({
        store_id: '3', type: 'X', title: 't', message: 'm',
      });

      expect(prisma.notifications.create.mock.calls[0][0].data.store_id).toBe(3);
    });
  });

  describe('notifyNewOrderDB', () => {
    test('NEW_ORDER 타입·high 우선순위로 생성한다', async () => {
      prisma.notifications.create.mockResolvedValue(makeRecord());

      await notificationService.notifyNewOrderDB({
        id: 9, store_id: 3, order_number: 'A001', table_name: '5번',
      });

      const args = prisma.notifications.create.mock.calls[0][0].data;
      expect(args.type).toBe('NEW_ORDER');
      expect(args.priority).toBe('high');
      expect(args.message).toContain('A001');
      expect(args.link).toBe('/admin/stores/3/orders');
    });
  });

  describe('notifyOrderStatusDB', () => {
    test.each([
      ['ready', 'high'],
      ['cancelled', 'high'],
      ['completed', 'low'],
      ['preparing', 'normal'],
    ])('%s 상태는 %s 우선순위', async (status, priority) => {
      prisma.notifications.create.mockResolvedValue(makeRecord());

      await notificationService.notifyOrderStatusDB({ id: 9, store_id: 3, order_number: 'A001' }, status);

      expect(prisma.notifications.create.mock.calls[0][0].data.priority).toBe(priority);
    });
  });

  describe('notifyLowStockDB', () => {
    test('LOW_STOCK 타입·urgent 우선순위로 생성한다', async () => {
      prisma.notifications.create.mockResolvedValue(makeRecord());

      await notificationService.notifyLowStockDB({
        id: 5, store_id: 3, name: '떡볶이', stock_quantity: 2, low_stock_threshold: 5,
      });

      const args = prisma.notifications.create.mock.calls[0][0].data;
      expect(args.type).toBe('LOW_STOCK');
      expect(args.priority).toBe('urgent');
      expect(args.message).toContain('떡볶이');
    });
  });

  describe('sendSocket', () => {
    test('io 미초기화 상태에서 호출해도 예외가 발생하지 않는다', () => {
      expect(() => notificationService.sendSocket('store - 3', 'ev', {})).not.toThrow();
    });
  });

  describe('sendPush', () => {
    beforeEach(() => {
      delete notificationService.messaging;
    });

    test('messaging 미초기화 시 false 반환', async () => {
      const result = await notificationService.sendPush('tok', { title: 't', body: 'b' });
      expect(result).toBe(false);
    });

    test('token 없이 호출 시 false 반환', async () => {
      notificationService.messaging = { send: jest.fn() };
      const result = await notificationService.sendPush(null, { title: 't', body: 'b' });
      expect(result).toBe(false);
      expect(notificationService.messaging.send).not.toHaveBeenCalled();
    });

    test('token과 messaging이 모두 있으면 messaging.send를 호출하고 true 반환', async () => {
      notificationService.messaging = { send: jest.fn().mockResolvedValue('ok') };
      const result = await notificationService.sendPush('fcm-token-xyz', {
        title: 'test title', body: 'test body', data: { orderId: 42 },
      });
      expect(result).toBe(true);
      expect(notificationService.messaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: { title: 'test title', body: 'test body' },
          token: 'fcm-token-xyz',
        })
      );
    });

    test('messaging.send 실패 시 false 반환 (예외 swallow)', async () => {
      notificationService.messaging = { send: jest.fn().mockRejectedValue(new Error('invalid token')) };
      const result = await notificationService.sendPush('bad-token', { title: 't', body: 'b' });
      expect(result).toBe(false);
    });
  });

  describe('notifyOrderStatus (통합 알림)', () => {
    beforeEach(() => {
      notificationService.sendSocket = jest.fn();
      notificationService.sendPush = jest.fn();
    });

    test('customerToken이 있으면 소켓 + 푸시 모두 발송', async () => {
      const order = { id: 9, store_id: 3, order_number: 'A001' };
      await notificationService.notifyOrderStatus(order, 'ready', 'customer-token');

      expect(notificationService.sendSocket).toHaveBeenCalledWith(
        'order - 9', 'notification', expect.objectContaining({ target: 'customer' })
      );
      expect(notificationService.sendSocket).toHaveBeenCalledWith(
        'store - 3', 'notification', expect.objectContaining({ target: 'manager' })
      );
      expect(notificationService.sendPush).toHaveBeenCalledWith(
        'customer-token', expect.objectContaining({ title: expect.stringContaining('주문') })
      );
    });

    test.each(['confirmed', 'ready', 'cancelled'])('중요 상태(%s)에서 customerToken이 있으면 푸시 발송', async (status) => {
      await notificationService.notifyOrderStatus({ id: 1, store_id: 1 }, status, 'tok');
      expect(notificationService.sendPush).toHaveBeenCalled();
    });

    test.each(['pending', 'preparing', 'completed'])('비중요 상태(%s)에서는 customerToken이 있어도 푸시 미발송', async (status) => {
      await notificationService.notifyOrderStatus({ id: 1, store_id: 1 }, status, 'tok');
      expect(notificationService.sendPush).not.toHaveBeenCalled();
    });

    test('customerToken 없으면 푸시 미발송 (소켓만)', async () => {
      await notificationService.notifyOrderStatus({ id: 1, store_id: 1 }, 'ready');
      expect(notificationService.sendPush).not.toHaveBeenCalled();
      expect(notificationService.sendSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('notifyNewOrder', () => {
    beforeEach(() => {
      notificationService.sendSocket = jest.fn();
      notificationService.sendPush = jest.fn();
    });

    test('매장/주방 소켓 발송 + 관리자 푸시 발송', async () => {
      const order = { id: 7, store_id: 3, table_name: '5번' };
      const tokens = ['mgr-tok-1', 'mgr-tok-2'];
      await notificationService.notifyNewOrder(order, tokens);

      expect(notificationService.sendSocket).toHaveBeenCalledWith(
        'store - 3', 'notification', expect.objectContaining({ target: 'store' })
      );
      expect(notificationService.sendSocket).toHaveBeenCalledWith(
        'kitchen - 3', 'notification', expect.objectContaining({ target: 'kitchen' })
      );
      expect(notificationService.sendPush).toHaveBeenCalledTimes(2);
      expect(notificationService.sendPush).toHaveBeenCalledWith('mgr-tok-1', expect.any(Object));
      expect(notificationService.sendPush).toHaveBeenCalledWith('mgr-tok-2', expect.any(Object));
    });

    test('tokens가 빈 배열이면 푸시 미발송 (소켓만)', async () => {
      await notificationService.notifyNewOrder({ id: 1, store_id: 1 }, []);
      expect(notificationService.sendPush).not.toHaveBeenCalled();
      expect(notificationService.sendSocket).toHaveBeenCalledTimes(2);
    });
  });
});
