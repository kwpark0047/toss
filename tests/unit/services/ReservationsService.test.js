jest.mock('../../../config/prisma', () => ({
  reservations: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('../../../utils/phoneEncryption', () => ({
  encryptPhone: jest.fn((phone) => `enc_${phone}`),
  decryptPhoneFields: jest.fn((entry) => ({ ...entry, customer_phone: '01012345678' })),
  phoneSearchCandidates: jest.fn((phone) => [`enc_${phone}`]),
}));
jest.mock('../../../utils/notifications', () => ({
  sendReservationNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const ReservationsService = require('../../../services/ReservationsService');
const prisma = require('../../../config/prisma');
const { encryptPhone } = require('../../../utils/phoneEncryption');

describe('ReservationsService', () => {
  let svc;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new ReservationsService();
  });

  describe('register', () => {
    test('예약을 등록하고 복호화된 결과를 반환한다', async () => {
      prisma.reservations.create.mockResolvedValue({ id: 1, store_id: 1, status: 'PENDING' });
      const result = await svc.register({
        store_id: '1',
        customer_name: '홍길동',
        customer_phone: '01012345678',
        party_size: '4',
        reservation_time: new Date(Date.now() + 86400000).toISOString(),
        notes: '',
      });
      expect(encryptPhone).toHaveBeenCalledWith('01012345678');
      expect(result.customer_phone).toBe('01012345678');
    });

    test('io가 있으면 소켓 이벤트를 전송한다', async () => {
      const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      prisma.reservations.create.mockResolvedValue({ id: 1, store_id: 1 });
      await svc.register(
        {
          store_id: '1',
          customer_name: '홍',
          customer_phone: '01012345678',
          party_size: '2',
          reservation_time: new Date(Date.now() + 86400000).toISOString(),
        },
        io
      );
      expect(io.to).toHaveBeenCalledWith('store - 1');
      expect(io.emit).toHaveBeenCalledWith('new-reservation', expect.anything());
    });
  });

  describe('register — 입력 검증', () => {
    test.each([
      [{ reservation_time: new Date(Date.now() - 86400000).toISOString() }, '지난 시간'],
      [{ party_size: '0' }, '인원'],
      [{ customer_phone: '123' }, '휴대폰'],
      [{ reservation_time: 'not-a-date' }, '예약 시간'],
    ])('%o 는 400으로 거절한다', async (patch, word) => {
      await expect(
        svc.register({
          store_id: '1',
          customer_name: '홍',
          customer_phone: '01012345678',
          party_size: '2',
          reservation_time: new Date(Date.now() + 86400000).toISOString(),
          ...patch,
        })
      ).rejects.toThrow(word);
      expect(prisma.reservations.create).not.toHaveBeenCalled();
    });
  });

  describe('getStoreReservations', () => {
    test('상태와 날짜 필터를 적용하여 조회한다', async () => {
      prisma.reservations.findMany.mockResolvedValue([{ id: 1 }]);
      await svc.getStoreReservations(1, { status: 'PENDING', date: '2026-07-15' });
      expect(prisma.reservations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ store_id: 1, status: 'PENDING' }),
        })
      );
    });

    test('필터 없이 조회한다', async () => {
      prisma.reservations.findMany.mockResolvedValue([]);
      const result = await svc.getStoreReservations(1, {});
      expect(result).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    test('예약 상태를 변경하고 알림을 보낸다', async () => {
      prisma.reservations.findUnique.mockResolvedValue({ id: 1, status: 'PENDING' });
      prisma.reservations.update.mockResolvedValue({ id: 1, status: 'CONFIRMED' });
      await svc.updateStatus(1, 'CONFIRMED');
      expect(prisma.reservations.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'CONFIRMED' },
        })
      );
    });
  });

  describe('cancelReservation', () => {
    test('본인 예약을 취소한다', async () => {
      prisma.reservations.findUnique.mockResolvedValue({
        id: 1,
        customer_phone: 'enc_01012345678',
        status: 'PENDING',
        store_id: 1,
      });
      prisma.reservations.update.mockResolvedValue({ id: 1, status: 'CANCELED' });
      const result = await svc.cancelReservation(1, 'enc_01012345678');
      expect(result.status).toBe('CANCELED');
    });

    test('예약이 없으면 404 에러', async () => {
      prisma.reservations.findUnique.mockResolvedValue(null);
      await expect(svc.cancelReservation(999, 'phone')).rejects.toThrow('예약을 찾을 수 없습니다.');
    });

    test('본인 예약이 아니면 403 에러', async () => {
      prisma.reservations.findUnique.mockResolvedValue({
        id: 1,
        customer_phone: 'other',
        status: 'PENDING',
      });
      await expect(svc.cancelReservation(1, 'my_phone')).rejects.toThrow(
        '본인의 예약만 취소할 수 있습니다.'
      );
    });

    test('CONFIRMED/PENDING이 아니면 400 에러', async () => {
      prisma.reservations.findUnique.mockResolvedValue({
        id: 1,
        customer_phone: 'phone',
        status: 'COMPLETED',
      });
      await expect(svc.cancelReservation(1, 'phone')).rejects.toThrow(
        '현재 상태에서는 취소할 수 없습니다.'
      );
    });
  });
});
