jest.mock('../../../utils/catchAsync', () => (fn) => fn);
jest.mock('../../../config/prisma', () => ({
  store_tinkerbell_settings: { findUnique: jest.fn(), upsert: jest.fn() },
}));
jest.mock('../../../services/aiService', () => ({ recommendMenus: jest.fn() }));
jest.mock('../../../repositories/Product', () => ({ findActiveAndInStock: jest.fn() }));

const prisma = require('../../../config/prisma');
const TinkerbellSettings = require('../../../repositories/TinkerbellSettings');
const settingsController = require('../../../controllers/storeSettingsController');
const aiController = require('../../../controllers/aiController');
const AI = require('../../../services/aiService');
const Product = require('../../../repositories/Product');

const mockRes = () => ({
  json: jest.fn(),
  status: jest.fn().mockReturnThis(),
  success: jest.fn(),
});

describe('매장별 팅커벨 설정', () => {
  beforeEach(() => jest.clearAllMocks());

  test('저장된 설정이 없으면 기본값을 돌려주고 AI 추천은 꺼져 있다', async () => {
    prisma.store_tinkerbell_settings.findUnique.mockResolvedValue(null);
    const res = mockRes();
    await settingsController.getTinkerbellSettings({ params: { id: '5' } }, res);
    expect(prisma.store_tinkerbell_settings.findUnique).toHaveBeenCalledWith({
      where: { store_id: 5 },
    });
    expect(res.success).toHaveBeenCalledWith({
      enabled: true,
      lang: 'ko',
      voice_enabled: true,
      large_font: false,
      custom_msg: '',
      ai_recommendation: false,
    });
  });

  test('허용된 필드만 저장하고 인삿말 공백은 null로 저장한다', async () => {
    prisma.store_tinkerbell_settings.upsert.mockImplementation(async ({ create }) => create);
    const res = mockRes();
    await settingsController.updateTinkerbellSettings(
      {
        params: { storeId: '5' },
        body: { ai_recommendation: true, lang: 'en', custom_msg: '  ', store_id: 99 },
      },
      res
    );
    const { update } = prisma.store_tinkerbell_settings.upsert.mock.calls[0][0];
    expect(update).toMatchObject({ ai_recommendation: true, lang: 'en', custom_msg: null });
    expect(update).not.toHaveProperty('store_id');
    expect(res.success.mock.calls[0][0]).toMatchObject({
      ai_recommendation: true,
      lang: 'en',
      custom_msg: '',
    });
  });

  test.each([[{ ai_recommendation: 'true' }], [{ lang: 'fr' }], [{ custom_msg: 'a'.repeat(81) }]])(
    '잘못된 값 %j 은 400으로 거부한다',
    async (body) => {
      const res = mockRes();
      await settingsController.updateTinkerbellSettings({ params: { storeId: '5' }, body }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.store_tinkerbell_settings.upsert).not.toHaveBeenCalled();
    }
  );

  test('AI 추천이 꺼진 매장은 AI를 호출하지 않는다', async () => {
    prisma.store_tinkerbell_settings.findUnique.mockResolvedValue({
      enabled: true,
      ai_recommendation: false,
    });
    const res = mockRes();
    await aiController.tinkerbellRecommend({ body: { store_id: 5 } }, res);
    expect(res.json).toHaveBeenCalledWith({ recommendations: [], source: 'disabled' });
    expect(Product.findActiveAndInStock).not.toHaveBeenCalled();
    expect(AI.recommendMenus).not.toHaveBeenCalled();
  });

  test('팅커벨 자체가 꺼진 매장도 AI를 호출하지 않는다', async () => {
    prisma.store_tinkerbell_settings.findUnique.mockResolvedValue({
      enabled: false,
      ai_recommendation: true,
    });
    const res = mockRes();
    await aiController.tinkerbellRecommend({ body: { store_id: 5 } }, res);
    expect(res.json).toHaveBeenCalledWith({ recommendations: [], source: 'disabled' });
    expect(AI.recommendMenus).not.toHaveBeenCalled();
  });

  test('sanitize는 알 수 없는 필드를 버린다', () => {
    expect(TinkerbellSettings.sanitize({ enabled: false, hacked: 1 })).toEqual({
      data: { enabled: false },
    });
  });
});
