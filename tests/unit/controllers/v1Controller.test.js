// catchAsync 미들웨어를 모크하여 테스트 환경에서는 래핑 없이 일반 비동기 함수로 실행되도록 함 (동기식 expect 평가를 위함)
jest.mock('../../../utils/catchAsync', () => (fn) => fn);

jest.mock('../../../config/prisma', () => {
  const mockPrisma = {
    stores: {
      findUnique: jest.fn(),
    },
    products: {
      findMany: jest.fn(),
    },
    orders: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  };
  return mockPrisma;
});
const v1Controller = require('../../../controllers/v1Controller');
const prisma = require('../../../config/prisma');
const OrderRepository = require('../../../repositories/Order');
const { emitEvent } = require('../../../services/webhookDispatcher');

// ── Order 레포지토리 및 웹훅 연동 모의 ─────────────────────────────────────────────
jest.mock('../../../repositories/Order', () => {
  return {
    create: jest.fn(),
  };
});

jest.mock('../../../services/webhookDispatcher', () => {
  return {
    emitEvent: jest.fn(),
  };
});

// ── 복호화 모의 ────────────────────────────────────────────────────────────────
jest.mock('../../../utils/phoneEncryption', () => {
  return {
    decryptPhone: jest.fn((enc) => (enc ? '01012345678' : null)),
  };
});

describe('v1Controller Unit Tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      apiClient: { storeId: 1 },
      params: {},
      query: {},
      body: {},
      app: {
        get: jest.fn(() => null),
      },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      created: jest.fn(),
    };
  });

  describe('getStore', () => {
    it('should retrieve store details successfully', async () => {
      prisma.stores.findUnique.mockResolvedValue({
        id: 1,
        name: '테스트 가판대',
        business_type: 'FOOD_TRUCK',
      });

      await v1Controller.getStore(mockReq, mockRes);

      expect(prisma.stores.findUnique).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: '테스트 가판대' }),
      });
    });

    it('should return 404 if store is not found', async () => {
      prisma.stores.findUnique.mockResolvedValue(null);

      await v1Controller.getStore(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'not_found',
        message: expect.any(String),
      });
    });
  });

  describe('getMenus', () => {
    it('should retrieve menu products successfully', async () => {
      prisma.products.findMany.mockResolvedValue([{ id: 10, name: '닭꼬치', price: 4000 }]);

      await v1Controller.getMenus(mockReq, mockRes);

      expect(prisma.products.findMany).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        data: expect.any(Array),
        meta: { count: 1 },
      });
    });
  });

  describe('getOrders', () => {
    it('should list and format store orders successfully', async () => {
      prisma.orders.findMany.mockResolvedValue([
        {
          id: 50,
          order_number: '20260711-1234',
          status: 'pending',
          customer_phone: 'encrypted_phone_here',
          order_items: [{ product_name: '닭꼬치', quantity: 2, price: 4000 }],
        },
      ]);

      await v1Controller.getOrders(mockReq, mockRes);

      expect(prisma.orders.findMany).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            order_number: '20260711-1234',
            customer_phone: '010-****-5678', // 복호화 & 마스킹 통과 검증
          }),
        ]),
        meta: { count: 1 },
      });
    });
  });

  describe('createOrder', () => {
    it('should create order and trigger webhook successfully', async () => {
      mockReq.body = {
        items: [{ product_id: 10, quantity: 2 }],
      };

      prisma.products.findMany.mockResolvedValue([{ id: 10, price: 4000 }]);

      OrderRepository.create.mockResolvedValue({
        id: 50,
        order_number: '20260711-1234',
        total_amount: 8000,
        status: 'pending',
      });

      await v1Controller.createOrder(mockReq, mockRes);

      expect(prisma.products.findMany).toHaveBeenCalled();
      expect(OrderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          total_amount: 8000,
          items: [{ product_id: 10, quantity: 2, options: null }],
        })
      );
      expect(emitEvent).toHaveBeenCalledWith(1, 'order.created', expect.any(Object));
      expect(mockRes.status).not.toHaveBeenCalledWith(400); // 400 에러를 뱉지 않아야 함
    });
  });

  describe('claimPrintJobs', () => {
    it('should raw update and claim oldest pending print jobs', async () => {
      mockReq.body = { max: 5 };
      prisma.$queryRawUnsafe.mockResolvedValue([
        { id: 1, order_id: 50, kind: 'kitchen', payload_b64: 'YmFzZTY0' },
      ]);

      await v1Controller.claimPrintJobs(mockReq, mockRes);

      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        data: expect.any(Array),
        meta: { count: 1 },
      });
    });
  });

  describe('ackPrintJob', () => {
    it('should mark print job status as done on success feedback', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { success: true };

      await v1Controller.ackPrintJob(mockReq, mockRes);

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('done'), 1, 1);
    });

    it('should transition print job status based on retry attempts on failure feedback', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { success: false, error: 'connection timeout' };

      prisma.$queryRawUnsafe.mockResolvedValue([{ attempts: 1 }]); // 3회 미만 -> pending 복귀

      await v1Controller.ackPrintJob(mockReq, mockRes);

      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE print_jobs'),
        'pending',
        'connection timeout',
        1,
        1
      );
    });
  });
});
