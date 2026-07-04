/**
 * notificationService 단위 테스트
 * 실제 구조: firebase-admin(푸시) + prisma(notifications 테이블) + Socket.io(실시간)
 */
jest.mock('../../../config/prisma', () => ({
  notifications: { create: jest.fn() },
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
});
