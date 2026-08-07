// StoreService 테스트 — 매장 검색, 사업자 정보(테마/결제수단) 조회·검증
jest.mock('../../../repositories/Store');
jest.mock('../../../utils/cache', () => ({
  flushByStore: jest.fn(),
  getOrSet: jest.fn((_key, fn) => fn()),
}));

const StoreService = require('../../../services/StoreService');
const Store = require('../../../repositories/Store');

describe('StoreService', () => {
  let svc;
  const mockIo = {
    to: jest.fn(() => ({ emit: jest.fn() })),
    emit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new StoreService(mockIo);
  });

  describe('getBusinessInfo', () => {
    it('매장이 없으면 null 반환', async () => {
      Store.findBusinessInfo.mockResolvedValue(null);
      const result = await svc.getBusinessInfo('999');
      expect(result).toBeNull();
      expect(Store.findBusinessInfo).toHaveBeenCalledWith(999);
    });

    it('theme/enabled_payment_methods JSON 문자열을 객체로 변환', async () => {
      Store.findBusinessInfo.mockResolvedValue({
        id: 1,
        name: '테스트매장',
        theme: JSON.stringify({
          theme_preset: 'forest-green',
          ui_size: 'large',
          menu_layout: 'grid',
        }),
        enabled_payment_methods: JSON.stringify(['cash', 'card']),
      });

      const result = await svc.getBusinessInfo('1');
      expect(result.theme_settings).toEqual({
        theme_preset: 'forest-green',
        ui_size: 'large',
        menu_layout: 'grid',
      });
      expect(result.enabled_payment_methods).toEqual(['cash', 'card']);
    });

    it('theme가 없으면 theme_settings는 null', async () => {
      Store.findBusinessInfo.mockResolvedValue({ id: 1, name: '매장', theme: null });
      const result = await svc.getBusinessInfo('1');
      expect(result.theme_settings).toBeNull();
    });

    it('손상된 theme JSON은 null로 안전 처리', async () => {
      Store.findBusinessInfo.mockResolvedValue({ id: 1, theme: '{broken json' });
      const result = await svc.getBusinessInfo('1');
      expect(result.theme_settings).toBeNull();
    });

    it('손상된 enabled_payment_methods는 기본값 사용', async () => {
      Store.findBusinessInfo.mockResolvedValue({ id: 1, enabled_payment_methods: '[[[' });
      const result = await svc.getBusinessInfo('1');
      expect(result.enabled_payment_methods).toEqual(['cash', 'store_card', 'transfer']);
    });
  });

  describe('validateBusinessInfo', () => {
    it('유효한 사업자번호·정산주기는 null 반환', () => {
      expect(
        svc.validateBusinessInfo({ business_number: '123-45-67890', settlement_cycle: 'WEEKLY' })
      ).toBeNull();
    });

    it('잘못된 사업자번호 형식은 오류 메시지 반환', () => {
      expect(svc.validateBusinessInfo({ business_number: '1234567890' })).toContain('사업자번호');
    });

    it('잘못된 정산주기는 오류 메시지 반환', () => {
      expect(svc.validateBusinessInfo({ settlement_cycle: 'YEARLY' })).toContain('정산 주기');
    });

    it('모두 비어있으면 null 반환 (검증 건너뜀)', () => {
      expect(svc.validateBusinessInfo({})).toBeNull();
    });
  });
});
