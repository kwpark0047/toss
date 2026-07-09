jest.mock('https', () => ({ get: jest.fn() }));

const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: jest.fn(() => ({ generateContent: mockGenerateContent })),
  })),
}));

const https = require('https');

// 모듈 로드 전에 env 설정
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.UNSPLASH_ACCESS_KEY = 'test-unsplash-key';

// aiService는 module.exports = new AIService() 형태로 singleton export
const aiService = require('../../../services/aiService');

describe('aiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aiService.cache = new Map();
  });

  describe('generateMenuImage', () => {
    test('AI 키워드 생성 + Unsplash URL 반환', async () => {
      // Gemini text()는 동기 string 반환 (with Fallback 내부에서 .trim() 호출)
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => '{ "keyword": "test menu food plated" }' },
      });

      const unsplashResponse = JSON.stringify({
        results: [
          { urls: { regular: 'https://images.unsplash.com/photo-test', small: 'https://images.unsplash.com/photo-test-sm' } },
        ],
      });

      let onDataCb, onEndCb;
      https.get.mockImplementation((url, opts, cb) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') onDataCb = handler;
            if (event === 'end') onEndCb = handler;
          },
          setTimeout: jest.fn(),
        };
        cb(res);
        if (onDataCb) onDataCb(unsplashResponse);
        if (onEndCb) onEndCb();
        return { on: jest.fn(), setTimeout: jest.fn(), destroy: jest.fn() };
      });

      const result = await aiService.generateMenuImage({
        name: '김치찌개',
        category: '한식',
        description: '돼지고기 김치찌개',
      });

      expect(result).not.toBeNull();
      expect(result.keyword).toBe('test menu food plated');
      expect(result.imageUrl).toBe('https://images.unsplash.com/photo-test');
    });

    test('Gemini 실패 시 fallback keyword로 Unsplash 호출', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('API Error'));

      const unsplashResponse = JSON.stringify({
        results: [
          { urls: { regular: 'https://images.unsplash.com/photo-fallback' } },
        ],
      });

      let onDataCb, onEndCb;
      https.get.mockImplementation((url, opts, cb) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') onDataCb = handler;
            if (event === 'end') onEndCb = handler;
          },
          setTimeout: jest.fn(),
        };
        cb(res);
        if (onDataCb) onDataCb(unsplashResponse);
        if (onEndCb) onEndCb();
        return { on: jest.fn(), setTimeout: jest.fn(), destroy: jest.fn() };
      });

      const result = await aiService.generateMenuImage({
        name: '비빔밥',
        category: '한식',
      });

      expect(result).not.toBeNull();
      expect(result.keyword).toBe('비빔밥 food');
      expect(result.imageUrl).toBe('https://images.unsplash.com/photo-fallback');
    });

    test('캐시된 결과가 있으면 AI 호출 없이 반환', async () => {
      const cached = { imageUrl: 'https://example.com/cached.jpg', keyword: 'cached keyword' };
      aiService.cache.set('img_비빔밥_한식', cached);

      const result = await aiService.generateMenuImage({
        name: '비빔밥',
        category: '한식',
      });

      expect(result).toEqual(cached);
      expect(mockGenerateContent).not.toHaveBeenCalled();
      expect(https.get).not.toHaveBeenCalled();
    });
  });

  describe('recommendMenus', () => {
    test('trendingItems와 timePeriod가 프롬프트에 포함된다', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify([
            { id: 1, reason: '인기 메뉴입니다.' },
            { id: 2, reason: '날씨에 잘 어울립니다.' },
          ]),
        },
      });

      const menuList = [
        { id: 1, name: '된장찌개', price: 8000, categories: { name: '찌개' } },
        { id: 2, name: '김치찌개', price: 9000, categories: { name: '찌개' } },
        { id: 3, name: '비빔밥', price: 10000, categories: { name: '밥' } },
      ];

      const result = await aiService.recommendMenus(
        {
          preferences: '매운 음식',
          time: '12:00:00',
          weather: '맑음',
          mood: '보통',
          pastOrders: ['된장찌개'],
          trendingItems: ['김치찌개'],
          timePeriod: '점심 (중식)',
        },
        menuList,
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].reason).toBe('인기 메뉴입니다.');

      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('점심 (중식)');
      expect(prompt).toContain('김치찌개');
      expect(prompt).toContain('매운 음식');
    });
  });
});
