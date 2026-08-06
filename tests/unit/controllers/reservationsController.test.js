// reservationsController 단위 테스트
jest.mock('../../../utils/catchAsync', () => (fn) => fn);

const mockService = {
  register: jest.fn(),
  getStoreReservations: jest.fn(),
  updateStatus: jest.fn(),
  getMyReservations: jest.fn(),
  cancelReservation: jest.fn(),
};
jest.mock('../../../services/ReservationsService', () => {
  return jest.fn().mockImplementation(() => mockService);
});

const reservationsController = require('../../../controllers/reservationsController');

describe('reservationsController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {}, query: {}, params: {}, user: { id: 10 }, app: { get: jest.fn() } };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis(), success: jest.fn() };
    next = jest.fn();
    req.app.get.mockReturnValue({ to: jest.fn().mockReturnValue({ emit: jest.fn() }) });
  });

  describe('register', () => {
    test('예약을 등록한다', async () => {
      req.body = { store_id: 1, phone: '01012345678', party_size: 4 };
      mockService.register.mockResolvedValue({ id: 1, status: 'pending' });
      await reservationsController.register(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: 1, status: 'pending' },
          capability: expect.any(String),
        })
      );
    });
  });

  describe('getStoreReservations', () => {
    test('매장별 예약 목록을 조회한다', async () => {
      req.params.storeId = '1';
      req.query = { status: 'confirmed' };
      mockService.getStoreReservations.mockResolvedValue([{ id: 1 }]);
      await reservationsController.getStoreReservations(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 1 }] });
    });
  });

  describe('updateStatus', () => {
    test('예약 상태를 변경한다', async () => {
      req.params.id = '1';
      req.body = { status: 'confirmed' };
      mockService.updateStatus.mockResolvedValue({ id: 1, status: 'confirmed' });
      await reservationsController.updateStatus(req, res);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getMyReservations', () => {
    test('내 예약을 조회한다', async () => {
      req.params.phone = '01012345678';
      req.capability = { customer_phone: '01012345678' };
      mockService.getMyReservations.mockResolvedValue([{ id: 1 }]);
      await reservationsController.getMyReservations(req, res);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('cancelReservation', () => {
    test('예약을 취소한다', async () => {
      req.params.id = '1';
      req.body = { phone: '01012345678' };
      req.capability = { customer_phone: '01012345678' };
      mockService.cancelReservation.mockResolvedValue({ id: 1, status: 'cancelled' });
      await reservationsController.cancelReservation(req, res);
      expect(res.json).toHaveBeenCalled();
    });
  });
});
