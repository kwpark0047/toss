// waitingController 단위 테스트
jest.mock('../../../utils/catchAsync', () => (fn) => fn);

const mockService = {
  getStoreStatus: jest.fn(),
  getStoreWaitingList: jest.fn(),
  register: jest.fn(),
  updateStatus: jest.fn(),
  getMyWaiting: jest.fn(),
};
jest.mock('../../../services/WaitingService', () => {
  return jest.fn().mockImplementation(() => mockService);
});

const waitingController = require('../../../controllers/waitingController');

describe('waitingController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {}, query: {}, params: {}, user: { id: 10 } };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis(), success: jest.fn() };
    next = jest.fn();
  });

  describe('getStoreStatus', () => {
    test('매장 대기 현황을 조회한다', async () => {
      req.params.storeId = '1';
      mockService.getStoreStatus.mockResolvedValue(5);
      await waitingController.getStoreStatus(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, waiting_teams: 5 });
    });
  });

  describe('getStoreWaitingList', () => {
    test('매장 대기 리스트를 조회한다', async () => {
      req.params.storeId = '1';
      mockService.getStoreWaitingList.mockResolvedValue([{ id: 1 }]);
      await waitingController.getStoreWaitingList(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 1 }] });
    });
  });

  describe('register', () => {
    test('대기를 등록한다', async () => {
      req.body = { store_id: 1, name: '김철수', phone: '01012345678', party_size: 2 };
      mockService.register.mockResolvedValue({ id: 1, position: 3 });
      await waitingController.register(req, res);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    test('대기 상태를 변경한다', async () => {
      req.params.id = '1';
      req.body = { status: 'called' };
      mockService.updateStatus.mockResolvedValue({ id: 1, status: 'called' });
      await waitingController.updateStatus(req, res);
      expect(res.json).toHaveBeenCalled();
    });

    test('상태 변경 시 스태프/고객 소켓 룸에 실시간 방송한다', async () => {
      req.params.id = '1';
      req.body = { status: 'called' };
      const io = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      req.app = { get: jest.fn((key) => (key === 'io' ? io : undefined)) };
      mockService.updateStatus.mockResolvedValue({
        id: 1,
        status: 'called',
        store_id: 42,
        customer_phone: '01012345678',
      });
      await waitingController.updateStatus(req, res);
      // 매장 룸으로 목록 갱신 + 앞서기 갱신 방송
      expect(io.to).toHaveBeenCalledWith('store - waiting - 42');
      expect(io.emit).toHaveBeenCalledWith('waiting-list-changed', { storeId: 42 });
      expect(io.emit).toHaveBeenCalledWith('refresh-ahead-count');
      // 고객 룸으로 상태 변경 방송
      expect(io.to).toHaveBeenCalledWith('customer - waiting - 01012345678');
      expect(io.emit).toHaveBeenCalledWith(
        'waiting-status-changed',
        expect.objectContaining({
          status: 'called',
        })
      );
    });

    test('io 주입이 없으면 방송 없이 정상 처리한다', async () => {
      req.params.id = '1';
      req.body = { status: 'cancelled' };
      mockService.updateStatus.mockResolvedValue({ id: 1, status: 'cancelled' });
      req.app = undefined;
      await expect(waitingController.updateStatus(req, res)).resolves.not.toThrow();
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getMyWaiting', () => {
    test('내 대기 상태를 조회한다', async () => {
      req.params.phone = '01012345678';
      mockService.getMyWaiting.mockResolvedValue({ position: 2, ahead_count: 1 });
      await waitingController.getMyWaiting(req, res);
      expect(res.json).toHaveBeenCalled();
    });
  });
});
