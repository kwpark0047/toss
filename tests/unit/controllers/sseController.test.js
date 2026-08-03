const logger = require('../../../utils/logger');

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../config/prisma', () => ({}));

const sseController = require('../../../controllers/sseController');

const makeRes = () => {
  const res = { setHeader: jest.fn(), flushHeaders: jest.fn() };
  res.destroyed = false;
  res.writableEnded = false;
  res.write = jest.fn();
  return res;
};

const makeReq = (orderId) => {
  const req = { params: { orderId } };
  req.on = jest.fn((evt, cb) => {
    if (evt === 'close') req._closeCb = cb;
  });
  return req;
};

const fireClose = (req) => {
  if (req._closeCb) req._closeCb();
};

describe('sseController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('subscribeToOrder', () => {
    test('SSE 헤더를 설정하고 클라이언트를 등록한다', () => {
      const req = makeReq('123');
      const res = makeRes();
      sseController.subscribeToOrder(req, res);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.flushHeaders).toHaveBeenCalled();
    });

    test('연결 종료 시 클라이언트를 제거한다', () => {
      const req = makeReq('123');
      const res = makeRes();
      sseController.subscribeToOrder(req, res);
      fireClose(req);
      // 제거 후 notify는 아무것도 쓰지 않아야 한다
      sseController.notifyOrderStatusChange('123', 'ready');
      expect(res.write).not.toHaveBeenCalled();
    });
  });

  describe('notifyOrderStatusChange', () => {
    test('등록된 모든 클라이언트에 상태 변경을 전송한다', () => {
      const req1 = makeReq('123');
      const res1 = makeRes();
      const req2 = makeReq('123');
      const res2 = makeRes();
      sseController.subscribeToOrder(req1, res1);
      sseController.subscribeToOrder(req2, res2);

      sseController.notifyOrderStatusChange('123', 'completed');

      expect(res1.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ status: 'completed' })}\n\n`
      );
      expect(res2.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ status: 'completed' })}\n\n`
      );
    });

    test('구독자가 없는 주문은 아무 동작도 하지 않는다', () => {
      sseController.notifyOrderStatusChange('999', 'ready');
      expect(logger.warn).not.toHaveBeenCalled();
    });

    test('한 클라이언트 write 실패가 다른 클라이언트의 알림을 막지 않는다', () => {
      const req1 = makeReq('123');
      const res1 = makeRes();
      res1.write = jest.fn(() => {
        throw new Error('destroyed response');
      });
      const req2 = makeReq('123');
      const res2 = makeRes();
      sseController.subscribeToOrder(req1, res1);
      sseController.subscribeToOrder(req2, res2);

      sseController.notifyOrderStatusChange('123', 'completed');

      expect(res2.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ status: 'completed' })}\n\n`
      );
      expect(logger.warn).toHaveBeenCalled();
    });

    test('이미 닫힌 응답에는 쓰지 않는다', () => {
      const req = makeReq('123');
      const res = makeRes();
      res.writableEnded = true;
      sseController.subscribeToOrder(req, res);

      sseController.notifyOrderStatusChange('123', 'ready');

      expect(res.write).not.toHaveBeenCalled();
    });
  });
});
