// StoreService 테스트 — 매장 검색, 사업자 정보(테마/결제수단) 조회·검증
jest.mock('../../../repositories/Store');
jest.mock('../../../config/prisma', () => ({
  store_accounts: { upsert: jest.fn() },
}));
jest.mock('../../../utils/cache', () => ({
  flushByStore: jest.fn(),
  getOrSet: jest.fn((_key, fn) => fn()),
}));

const StoreService = require('../../../services/StoreService');
const Store = require('../../../repositories/Store');
const prisma = require('../../../config/prisma');

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
    it('유효한 사업자번호·정산주기는 null 반환 (체크섬 검증 통과)', () => {
      expect(
        svc.validateBusinessInfo({ business_number: '123-45-67895', settlement_cycle: 'WEEKLY' })
      ).toBeNull();
    });

    it('체크섬이 올바른 10자리 숫자 사업자번호(하이픈 없음)도 유효', () => {
      expect(
        svc.validateBusinessInfo({ business_number: '1234567895', settlement_cycle: 'MONTHLY' })
      ).toBeNull();
    });

    it('잘못된 사업자번호 형식은 오류 메시지 반환', () => {
      expect(svc.validateBusinessInfo({ business_number: '1234567890' })).toContain('사업자번호');
    });

    it('자리수는 맞지만 체크섬이 틀린 사업자번호는 거부', () => {
      expect(svc.validateBusinessInfo({ business_number: '123-45-67890' })).toContain('사업자번호');
    });

    it('9자리 사업자번호는 거부', () => {
      expect(svc.validateBusinessInfo({ business_number: '123-45-6789' })).toContain('사업자번호');
    });

    it('11자리 사업자번호는 거부', () => {
      expect(svc.validateBusinessInfo({ business_number: '123-45-678901' })).toContain(
        '사업자번호'
      );
    });

    it('체크섬 계산: 가중치 1/3/7/1/3/7/1/3/5 적용 후 10의 보수', () => {
      // 123-45-67895: (1*1+2*3+3*7+4*1+5*3+6*7+7*1+8*3+9*5)=115 → 10-5=5 ✓
      expect(svc.validateBusinessInfo({ business_number: '123-45-67895' })).toBeNull();
      // 체크섬이 4면 실패
      expect(svc.validateBusinessInfo({ business_number: '123-45-67894' })).toContain('사업자번호');
    });

    it('사업자번호가 없으면 검증 건너뜀 (null 반환)', () => {
      expect(svc.validateBusinessInfo({ settlement_cycle: 'WEEKLY' })).toBeNull();
    });

    it('잘못된 정산주기는 오류 메시지 반환', () => {
      expect(svc.validateBusinessInfo({ settlement_cycle: 'YEARLY' })).toContain('정산 주기');
    });

    it('모두 비어있으면 null 반환 (검증 건너뜀)', () => {
      expect(svc.validateBusinessInfo({})).toBeNull();
    });
  });

  describe('upsertAccount', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('유효한 계좌번호로 저장하고 은행코드를 자동 매핑한다', async () => {
      prisma.store_accounts.upsert.mockResolvedValue({ id: 1, bank_name: '국민은행' });

      const result = await svc.upsertAccount(42, {
        bank_name: '국민은행',
        account_number: '123-456-7890',
        account_holder: '홍길동',
      });

      expect(result).toEqual({ id: 1, bank_name: '국민은행' });
      const call = prisma.store_accounts.upsert.mock.calls[0][0];
      expect(call.create.bank_code).toBe('004');
      expect(call.create.account_number).toBe('123-456-7890');
    });

    it('계좌번호가 8자리 미만이면 오류', async () => {
      await expect(
        svc.upsertAccount(42, {
          bank_name: '국민은행',
          account_number: '1234567',
          account_holder: '홍길동',
        })
      ).rejects.toThrow('계좌번호');
      expect(prisma.store_accounts.upsert).not.toHaveBeenCalled();
    });

    it('계좌번호에 숫자 이외의 문자만 있으면 오류', async () => {
      await expect(
        svc.upsertAccount(42, {
          bank_name: '국민은행',
          account_number: 'abcdefgh',
          account_holder: '홍길동',
        })
      ).rejects.toThrow('계좌번호');
    });

    it('계좌번호가 20자리를 초과하면 오류', async () => {
      await expect(
        svc.upsertAccount(42, {
          bank_name: '국민은행',
          account_number: '12345678901234567890123',
          account_holder: '홍길동',
        })
      ).rejects.toThrow('계좌번호');
    });

    it('계좌번호에 공백/하이픈이 있어도 숫자만 8~20자리면 통과', async () => {
      // 공백/하이픈이 제거되고 10자리가 되므로 통과해야 함
      prisma.store_accounts.upsert.mockResolvedValue({ id: 1, bank_name: '국민은행' });
      const result = await svc.upsertAccount(42, {
        bank_name: '국민은행',
        account_number: '123-456-7890',
        account_holder: '홍길동',
      });
      expect(result).toEqual({ id: 1, bank_name: '국민은행' });
    });

    it('계좌번호가 7자리(8자리 미만)면 오류', async () => {
      await expect(
        svc.upsertAccount(42, {
          bank_name: '국민은행',
          account_number: '1234567',
          account_holder: '홍길동',
        })
      ).rejects.toThrow('계좌번호');
      expect(prisma.store_accounts.upsert).not.toHaveBeenCalled();
    });

    it('계좌번호가 21자리(20자리 초과)면 오류', async () => {
      await expect(
        svc.upsertAccount(42, {
          bank_name: '국민은행',
          account_number: '123456789012345678901',
          account_holder: '홍길동',
        })
      ).rejects.toThrow('계좌번호');
      expect(prisma.store_accounts.upsert).not.toHaveBeenCalled();
    });

    it('은행코드 자동 매핑: BANK_CODE_MAP에 정의된 은행만 확인', async () => {
      const banks = [
        { name: '국민은행', code: '004' },
        { name: '신한은행', code: '088' },
        { name: '우리은행', code: '020' },
        { name: '하나은행', code: '081' },
        { name: '기업은행', code: '003' },
        { name: 'NH농협은행', code: '011' },
        { name: '우체국', code: '071' },
        { name: '케이뱅크', code: '089' },
        { name: '카카오뱅크', code: '090' },
        { name: '토스뱅크', code: '092' },
        { name: 'SC제일은행', code: '023' },
        { name: '씨티은행', code: '027' },
        { name: '제주은행', code: '035' },
        { name: '새마을금고', code: '045' },
        { name: '신협', code: '048' },
        { name: '저축은행', code: '050' },
        { name: '농협은행', code: '011' },
        { name: '수협은행', code: '007' },
        { name: '대구은행', code: '031' },
        { name: '부산은행', code: '032' },
        { name: '광주은행', code: '034' },
        { name: '전북은행', code: '037' },
        { name: '경남은행', code: '039' },
      ];

      for (const bank of banks) {
        jest.clearAllMocks();
        prisma.store_accounts.upsert.mockResolvedValue({ id: 1, bank_name: bank.name });

        await svc.upsertAccount(42, {
          bank_name: bank.name,
          account_number: '1234567890',
          account_holder: '홍길동',
        });

        const call = prisma.store_accounts.upsert.mock.calls[0][0];
        expect(call.create.bank_code).toBe(bank.code);
      }
    });

    it('BANK_CODE_MAP에 없는 은행은 빈 문자열 코드로 저장', async () => {
      prisma.store_accounts.upsert.mockResolvedValue({ id: 1, bank_name: '알수없는은행' });
      const result = await svc.upsertAccount(42, {
        bank_name: '알수없는은행',
        account_number: '1234567890',
        account_holder: '홍길동',
      });
      const call = prisma.store_accounts.upsert.mock.calls[0][0];
      expect(call.create.bank_code).toBe('');
    });

    it('필수 필드 누락 시 오류', async () => {
      await expect(
        svc.upsertAccount(42, { bank_name: '국민은행', account_number: '12345678' })
      ).rejects.toThrow('은행명, 계좌번호, 예금주명은 필수');
    });
  });
});
