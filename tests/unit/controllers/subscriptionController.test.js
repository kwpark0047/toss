// subscriptionController 단위 테스트
const mockPlanRepository = {
  findById: jest.fn(),
};
jest.mock('../../../repositories/Plan', () => mockPlanRepository);

const mockSubscriptionRepository = {
  upsertByStore: jest.fn(),
};
jest.mock('../../../repositories/StoreSubscription', () => mockSubscriptionRepository);

const mockTossAPI = {
  issueBillingKey: jest.fn(),
  createSubscription: jest.fn(),
};
jest.mock('../../../utils/toss', () => mockTossAPI);

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const subscriptionController = require('../../../controllers/subscriptionController');

describe('subscriptionController', () => {
  let req, res, next;

  const plan = { id: 'plan_1', name: '프로', price_monthly: 9900, is_active: true };

  beforeEach(() => {
    jest.clearAllMocks();
    req = { storeId: '1', body: { plan_id: 'plan_1' } };
    res = { created: jest.fn(), success: jest.fn() };
    next = jest.fn();
  });

  describe('registerPaymentMethod', () => {
    test('모의 빌링키면 등록만 처리하고 정기결제 생성을 생략한다', async () => {
      mockPlanRepository.findById.mockResolvedValue(plan);
      mockTossAPI.issueBillingKey.mockResolvedValue({ billingKey: 'mock_abcd1234' });
      req.body = {
        plan_id: 'plan_1',
        method: 'CARD',
        card: { company: 'SHINHAN', number: '12345678901234' },
      };

      await subscriptionController.registerPaymentMethod(req, res, next);

      expect(mockTossAPI.createSubscription).not.toHaveBeenCalled();
      expect(mockSubscriptionRepository.upsertByStore).toHaveBeenCalledWith('1', {
        plan: '프로',
        billing_cycle: 'MONTHLY',
        payment_method_id: 'mock_abcd1234',
      });
      expect(res.created).toHaveBeenCalledWith(
        {
          subscription: {
            store_id: '1',
            plan: '프로',
            billing_cycle: 'MONTHLY',
            subscription_id: null,
            payment_method_id: '****1234',
            is_mock: true,
          },
        },
        '결제수단이 등록되었습니다.'
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('실물 빌링키면 정기결제를 생성하고 구독 정보에 반영한다', async () => {
      mockPlanRepository.findById.mockResolvedValue(plan);
      mockTossAPI.issueBillingKey.mockResolvedValue({ billingKey: 'live_abcd1234' });
      mockTossAPI.createSubscription.mockResolvedValue({ subscriptionId: 'sub_0000' });

      await subscriptionController.registerPaymentMethod(req, res, next);

      expect(mockTossAPI.createSubscription).toHaveBeenCalledWith(
        'live_abcd1234',
        expect.stringMatching(/^sub-[0-9a-f]{64}$/),
        {
          interval: 'month',
          amount: 9900,
          orderName: '프로',
        }
      );
      expect(mockSubscriptionRepository.upsertByStore).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          plan: '프로',
          billing_cycle: 'MONTHLY',
          payment_method_id: 'live_abcd1234',
          subscription_id: 'sub_0000',
          auto_renew: true,
        })
      );
      expect(res.created).toHaveBeenCalled();
      const [payload] = res.created.mock.calls[0];
      expect(payload.subscription).toMatchObject({
        store_id: '1',
        plan: '프로',
        billing_cycle: 'MONTHLY',
        subscription_id: 'sub_0000',
        payment_method_id: '****1234',
        is_mock: false,
      });
    });

    test('플랜을 찾을 수 없으면 404', async () => {
      mockPlanRepository.findById.mockResolvedValue(null);

      await subscriptionController.registerPaymentMethod(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404, message: '플랜을 찾을 수 없습니다.' })
      );
      expect(mockTossAPI.issueBillingKey).not.toHaveBeenCalled();
    });

    test('비활성 플랜이면 404', async () => {
      mockPlanRepository.findById.mockResolvedValue({ ...plan, is_active: false });

      await subscriptionController.registerPaymentMethod(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404, message: '플랜을 찾을 수 없습니다.' })
      );
      expect(mockTossAPI.issueBillingKey).not.toHaveBeenCalled();
    });

    test('빌링키가 없으면 502', async () => {
      mockPlanRepository.findById.mockResolvedValue(plan);
      mockTossAPI.issueBillingKey.mockResolvedValue({});

      await subscriptionController.registerPaymentMethod(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 502, message: '결제수단 등록에 실패했습니다.' })
      );
    });
  });
});
