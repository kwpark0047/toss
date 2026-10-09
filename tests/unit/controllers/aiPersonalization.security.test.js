jest.mock('../../../utils/catchAsync', () => (fn) => fn);
jest.mock('../../../services/aiService', () => ({ recommendMenus: jest.fn() }));
jest.mock('../../../repositories/Product', () => ({
  findActiveAndInStock: jest.fn(),
  findByIds: jest.fn(),
}));
jest.mock('../../../repositories/Order', () => ({
  findByCustomer: jest.fn(),
  findByCustomerInStore: jest.fn(),
  findTrendingProducts: jest.fn(),
}));
jest.mock('../../../repositories/Store', () => ({ findById: jest.fn() }));
jest.mock('../../../services/weatherService', () => ({ getEnhancedWeatherContext: jest.fn() }));
jest.mock('../../../services/RecommendationContextService', () => ({
  buildContext: jest.fn(),
  formatContext: jest.fn(),
}));
const controller = require('../../../controllers/aiController');
const Order = require('../../../repositories/Order');
const Product = require('../../../repositories/Product');
const AI = require('../../../services/aiService');
const Context = require('../../../services/RecommendationContextService');
const mockPrivateRecommendations = jest.fn();
jest.mock('../../../services/CustomerPreferenceService', () => ({
  getPersonalizedRecommendations: (...args) => mockPrivateRecommendations(...args),
}));
jest.mock('../../../services/WaitingService', () => jest.fn().mockImplementation(() => ({})));

describe('P0 anonymous AI privacy boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Product.findActiveAndInStock.mockResolvedValue([{ id: 7, name: 'public menu' }]);
    Order.findTrendingProducts.mockResolvedValue([]);
    Order.findByCustomer.mockResolvedValue([{ items: [{ product_name: 'private purchase' }] }]);
    Context.buildContext.mockResolvedValue({ segment: { segment_label: 'VIP' } });
    Context.formatContext.mockReturnValue('private segment');
    AI.recommendMenus.mockResolvedValue([{ id: 7, reason: 'public facts' }]);
  });
  test.each(['recommendMenus', 'tinkerbellRecommend'])(
    '%s does not use a claimed phone or external ID as authentication',
    async (method) => {
      const req = {
        body: { store_id: 3, phone: '01011112222', toss_user_key: 'victim' },
        get: () => undefined,
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await controller[method](req, res);
      expect(Order.findByCustomer).not.toHaveBeenCalled();
      expect(Context.buildContext).not.toHaveBeenCalled();
      expect(AI.recommendMenus.mock.calls[0][0]).toMatchObject({
        pastOrders: [],
        segmentContext: '',
      });
      expect(JSON.stringify(res.json.mock.calls)).not.toContain('VIP');
    }
  );

  test('waiting suggestions cannot use query identifiers to read private preferences', async () => {
    mockPrivateRecommendations.mockResolvedValue([]);
    const waiting = require('../../../controllers/waitingController');
    await waiting.getAISuggestions(
      { params: { storeId: '3' }, query: { phone: '01011112222', toss_user_key: 'victim' } },
      { json: jest.fn(), status: jest.fn().mockReturnThis() }
    );
    expect(mockPrivateRecommendations).not.toHaveBeenCalled();
    expect(Order.findByCustomer).not.toHaveBeenCalled();
  });

  test('authenticated identity is queried only inside the requested store, never by claimed external ID', async () => {
    Order.findByCustomerInStore.mockResolvedValue([{ items: [{ product_name: 'own purchase' }] }]);
    await controller.recommendMenus(
      {
        body: { store_id: 3, phone: 'victim', toss_user_key: 'victim' },
        customerIdentity: { storeId: 3, phone: '01099998888' },
      },
      { json: jest.fn(), status: jest.fn().mockReturnThis() }
    );
    expect(Order.findByCustomerInStore).toHaveBeenCalledWith(3, '01099998888');
    expect(Context.buildContext).toHaveBeenCalledWith(3, '01099998888');
  });
});
