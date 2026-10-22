jest.mock('../../../config/prisma', () => {
  const mock = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    waiting_list: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    stores: {
      findUnique: jest.fn(),
    },
  };
  mock.$transaction = jest.fn((fn) => fn(mock));
  return mock;
});
jest.mock('../../../utils/phoneEncryption', () => ({
  encryptPhone: jest.fn((phone) => `enc_${phone}`),
  decryptPhoneFields: jest.fn((entry) => ({ ...entry, customer_phone: '01012345678' })),
  phoneSearchCandidates: jest.fn((phone) => [`enc_${phone}`]),
}));
jest.mock('../../../services/AlimtalkService', () => ({
  sendWaitingRegistered: jest.fn().mockResolvedValue({ success: true }),
  sendWaitingCall: jest.fn().mockResolvedValue({ success: true }),
  sendWaitingCancel: jest.fn().mockResolvedValue({ success: true }),
}));

const WaitingService = require('../../../services/WaitingService');
const prisma = require('../../../config/prisma');
const alimtalkService = require('../../../services/AlimtalkService');

describe('WaitingService', () => {
  let svc;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new WaitingService();
  });

  describe('getStoreStatus', () => {
    test('대기 중인 팀 수를 반환한다', async () => {
      prisma.waiting_list.count.mockResolvedValue(5);
      const result = await svc.getStoreStatus(1);
      expect(result).toBe(5);
      expect(prisma.waiting_list.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { store_id: 1, status: 'waiting' },
        })
      );
    });
  });

  describe('getStoreWaitingList', () => {
    test('매장 대기 리스트를 조회한다', async () => {
      prisma.waiting_list.findMany.mockResolvedValue([{ id: 1, queue_number: 1 }]);
      const result = await svc.getStoreWaitingList(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('register', () => {
    beforeEach(() => {
      prisma.stores.findUnique.mockResolvedValue({ name: '테스트매장' });
    });

    test.each([
      [{ party_size: '0' }, '인원'],
      [{ party_size: 'abc' }, '인원'],
      [{ party_size: '51' }, '인원'],
      [{ customer_phone: '123' }, '휴대폰'],
      [{ store_id: 'x' }, '매장'],
    ])('잘못된 입력 %o 은 400으로 거절한다', async (patch, word) => {
      await expect(
        svc.register({ store_id: '1', customer_phone: '01012345678', party_size: '2', ...patch })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining(word) });
      expect(prisma.waiting_list.create).not.toHaveBeenCalled();
    });

    test('매장 단위 잠금 안에서 번호를 정하고, 한국 자정 기준으로 오늘 번호를 찾는다', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-22T00:30:00Z')); // KST 09:30
      prisma.waiting_list.findFirst.mockResolvedValueOnce(null);
      prisma.waiting_list.findFirst.mockResolvedValueOnce({ queue_number: 8 });
      prisma.waiting_list.create.mockResolvedValue({ id: 2, queue_number: 9, status: 'waiting' });
      await svc.register({ store_id: '1', customer_phone: '010-1234-5678', party_size: 2 });
      jest.useRealTimers();
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.waiting_list.findFirst.mock.calls[1][0].where.created_at.gte).toEqual(
        new Date('2026-10-21T15:00:00.000Z')
      );
      expect(prisma.waiting_list.create.mock.calls[0][0].data.queue_number).toBe(9);
    });

    test('대기 등록에 성공한다', async () => {
      prisma.waiting_list.findFirst.mockResolvedValueOnce(null); // 이미 대기 없음
      prisma.waiting_list.findFirst.mockResolvedValueOnce({ queue_number: 3 }); // 마지막 번호
      prisma.waiting_list.create.mockResolvedValue({ id: 1, queue_number: 4, status: 'waiting' });

      const result = await svc.register({
        store_id: '1',
        customer_name: '홍길동',
        customer_phone: '01012345678',
        party_size: '4',
      });
      expect(result.queue_number).toBe(4);
    });

    test('등록 성공 시 알림톡을 발송한다', async () => {
      prisma.waiting_list.findFirst.mockResolvedValueOnce(null);
      prisma.waiting_list.findFirst.mockResolvedValueOnce({ queue_number: 2 });
      prisma.waiting_list.create.mockResolvedValue({ id: 1, queue_number: 3, status: 'waiting' });
      prisma.waiting_list.count.mockResolvedValue(2);

      await svc.register({
        store_id: '1',
        customer_name: '홍길동',
        customer_phone: '01012345678',
        party_size: '4',
      });

      expect(alimtalkService.sendWaitingRegistered).toHaveBeenCalledWith(
        '01012345678',
        '테스트매장',
        3,
        2
      );
    });

    test('이미 대기 중이면 400 에러', async () => {
      prisma.waiting_list.findFirst.mockResolvedValueOnce({ id: 1 }); // 이미 대기 중
      await expect(
        svc.register({
          store_id: '1',
          customer_name: '홍길동',
          customer_phone: '01012345678',
          party_size: '2',
        })
      ).rejects.toThrow('이미 대기 등록이 되어 있습니다.');
    });
  });

  describe('updateStatus', () => {
    beforeEach(() => {
      prisma.stores.findUnique.mockResolvedValue({ name: '테스트매장' });
      prisma.waiting_list.findUnique.mockResolvedValue({ store_id: 1 });
    });

    test('호출된 손님은 노쇼로 처리할 수 있고, 대기 중 손님은 바로 노쇼 처리할 수 없다', async () => {
      prisma.waiting_list.findUnique.mockResolvedValueOnce({ store_id: 1, status: 'called' });
      prisma.waiting_list.update.mockResolvedValue({ id: 1, status: 'no_show', store_id: 1 });
      expect((await svc.updateStatus(1, 'no_show')).status).toBe('no_show');

      prisma.waiting_list.findUnique.mockResolvedValueOnce({ store_id: 1, status: 'waiting' });
      await expect(svc.updateStatus(2, 'no_show')).rejects.toMatchObject({ statusCode: 400 });
    });

    test('대기 상태를 변경한다', async () => {
      prisma.waiting_list.update.mockResolvedValue({ id: 1, status: 'called', store_id: 1 });
      const result = await svc.updateStatus(1, 'called');
      expect(result.status).toBe('called');
    });

    test('호출 시 called_at을 설정한다', async () => {
      prisma.waiting_list.update.mockResolvedValue({ id: 1, status: 'called', store_id: 1 });
      await svc.updateStatus(1, 'called');
      expect(prisma.waiting_list.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'called', called_at: expect.any(Date) }),
        })
      );
    });

    test('호출 시 알림톡을 발송한다', async () => {
      prisma.waiting_list.update.mockResolvedValue({
        id: 1,
        status: 'called',
        store_id: 1,
        queue_number: 5,
      });
      await svc.updateStatus(1, 'called');
      expect(alimtalkService.sendWaitingCall).toHaveBeenCalledWith('01012345678', '테스트매장', 5);
    });

    test('취소 시 알림톡을 발송한다', async () => {
      prisma.waiting_list.update.mockResolvedValue({ id: 1, status: 'cancelled', store_id: 1 });
      await svc.updateStatus(1, 'cancelled');
      expect(alimtalkService.sendWaitingCancel).toHaveBeenCalledWith('01012345678', '테스트매장');
    });
  });

  describe('getMyWaiting', () => {
    test('내 대기 상태와 앞 대기 수를 반환한다', async () => {
      prisma.waiting_list.findMany.mockResolvedValue([
        { id: 1, store_id: 1, queue_number: 3, status: 'waiting' },
      ]);
      prisma.waiting_list.count.mockResolvedValue(2); // 앞에 2팀

      const result = await svc.getMyWaiting('01012345678');
      expect(result[0].ahead_count).toBe(2);
    });
  });
});
