jest.mock('../../../config/prisma', () => ({
  store_customers: { findFirst: jest.fn() },
}));

jest.mock('../../../repositories/CustomerPreference', () => ({
  findOrCreate: jest.fn(),
}));

jest.mock('../../../utils/phoneEncryption', () => ({
  phoneSearchCandidates: jest.fn((phone) => [phone, `enc:${phone}`]),
}));

const prisma = require('../../../config/prisma');
const CustomerPreference = require('../../../repositories/CustomerPreference');
const service = require('../../../services/RecommendationContextService');

describe('RecommendationContextService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('classifySegment', () => {
    test('null이면 NEW_VISITOR', () => {
      const result = service.classifySegment(null);
      expect(result.segment_type).toBe('NEW_VISITOR');
      expect(result.segment_label).toBe('첫 방문');
    });

    test('방문 10회 이상 + 15만원 이상이면 VIP', () => {
      const result = service.classifySegment({ visit_count: 10, total_spent: 150000 });
      expect(result.segment_type).toBe('VIP');
      expect(result.description).toContain('150,000');
    });

    test('방문 5회 이상 + 5만원 이상이면 단골', () => {
      const result = service.classifySegment({ visit_count: 5, total_spent: 50000 });
      expect(result.segment_type).toBe('FREQUENT');
    });

    test('방문 2회 이하이면 신규 고객', () => {
      const result = service.classifySegment({ visit_count: 2, total_spent: 30000 });
      expect(result.segment_type).toBe('NEW_CUSTOMER');
    });

    test('그 외는 재방문 고객', () => {
      const result = service.classifySegment({ visit_count: 3, total_spent: 10000 });
      expect(result.segment_type).toBe('REGULAR');
    });
  });

  describe('buildContext', () => {
    test('phone 없으면 빈 결과', async () => {
      const result = await service.buildContext(1, null);
      expect(result).toEqual({ segment: null, preferences: null, tier: null });
    });

    test('storeCustomer 있으면 세그먼트/티어 구성', async () => {
      prisma.store_customers.findFirst.mockResolvedValue({
        tier: 'SILVER',
        visit_count: 7,
        total_spent: 80000,
      });
      CustomerPreference.findOrCreate.mockResolvedValue({
        preferred_categories: ['한식'],
        preferred_tastes: ['매운맛'],
        spicy_tolerance: 3,
        price_sensitivity: 'MEDIUM',
        dietary_restrictions: [],
        favorite_items: [1, 2],
        order_patterns: {},
      });

      const result = await service.buildContext(1, '01012345678');

      expect(result.segment.segment_type).toBe('FREQUENT');
      expect(result.tier).toEqual({
        tier_name: 'SILVER',
        visit_count: 7,
        total_spent: 80000,
      });
      expect(result.preferences.preferred_categories).toEqual(['한식']);
      expect(prisma.store_customers.findFirst).toHaveBeenCalledWith({
        where: {
          store_id: 1,
          customer_phone: { in: ['01012345678', 'enc:01012345678'] },
        },
      });
    });

    test('storeCustomer 없으면 NEW_VISITOR 세그먼트', async () => {
      prisma.store_customers.findFirst.mockResolvedValue(null);
      CustomerPreference.findOrCreate.mockResolvedValue(null);

      const result = await service.buildContext(1, '01012345678');
      expect(result.segment.segment_type).toBe('NEW_VISITOR');
      expect(result.tier).toBeNull();
      expect(result.preferences).toBeNull();
    });

    test('profile 조회 실패는 무시', async () => {
      prisma.store_customers.findFirst.mockResolvedValue(null);
      CustomerPreference.findOrCreate.mockRejectedValue(new Error('db down'));

      const result = await service.buildContext(1, '01012345678');
      expect(result.segment.segment_type).toBe('NEW_VISITOR');
      expect(result.preferences).toBeNull();
    });

    test('전체 조회 실패는 조용한 폴백', async () => {
      prisma.store_customers.findFirst.mockRejectedValue(new Error('db down'));
      CustomerPreference.findOrCreate.mockResolvedValue(null);

      const result = await service.buildContext(1, '01012345678');
      expect(result.segment).toBeNull();
      expect(result.tier).toBeNull();
      expect(result.preferences).toBeNull();
    });
  });

  describe('formatContext', () => {
    test('빈 컨텍스트는 빈 문자열', () => {
      expect(service.formatContext({})).toBe('');
    });

    test('세그먼트/선호도/티어 문자열 조합', () => {
      const ctx = {
        segment: { segment_label: 'VIP 고객', description: '최고 단골' },
        preferences: {
          preferred_categories: ['한식', '중식'],
          preferred_tastes: ['매운맛'],
          favorite_items: [3, 4],
          price_sensitivity: 'HIGH',
          dietary_restrictions: ['땅콩'],
          order_patterns: { preferred_hours: [12, 18], avg_order_value: 25000 },
        },
        tier: { tier_name: 'GOLD', visit_count: 12, total_spent: 200000 },
      };

      const text = service.formatContext(ctx);
      expect(text).toContain('VIP 고객');
      expect(text).toContain('선호 카테고리: 한식, 중식');
      expect(text).toContain('즐겨찾기 메뉴 ID: 3, 4');
      expect(text).toContain('가격보다 품질 중시');
      expect(text).toContain('알레르기/식이제한: 땅콩');
      expect(text).toContain('주로 방문하는 시간대: 12, 18시');
      expect(text).toContain('평균 주문 금액: 25,000원');
      expect(text).toContain('고객 등급: GOLD');
    });

    test('가격민감도 미정의 라벨은 원본 값 사용', () => {
      const text = service.formatContext({
        preferences: { price_sensitivity: 'UNKNOWN', order_patterns: {} },
      });
      expect(text).toContain('UNKNOWN');
    });
  });
});
