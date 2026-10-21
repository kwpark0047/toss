const { updateStoreSchema } = require('../../../src/validation/schemas/store');

describe('매장 설정 저장 필드 (StoreSettings 페이로드)', () => {
  test('영업시간·요일별 시간·테마가 검증 후에도 유지된다', () => {
    const payload = {
      open_time: '09:00',
      close_time: '24:00',
      business_hours: JSON.stringify({ mon: { open: '09:00', close: '21:00', closed: false } }),
      theme: JSON.stringify({ primaryColor: '#f97316' }),
    };
    expect(updateStoreSchema.parse(payload)).toEqual(payload);
  });

  test('요일별 영업시간 해제(null)도 허용', () => {
    expect(updateStoreSchema.parse({ business_hours: null }).business_hours).toBeNull();
  });

  test('객체 테마도 허용 (Store.update가 직렬화)', () => {
    expect(updateStoreSchema.parse({ theme: { primaryColor: '#000000' } }).theme).toEqual({ primaryColor: '#000000' });
  });

  test('잘못된 시간·JSON은 거부', () => {
    expect(() => updateStoreSchema.parse({ open_time: '9시' })).toThrow();
    expect(() => updateStoreSchema.parse({ close_time: '25:00' })).toThrow();
    expect(() => updateStoreSchema.parse({ business_hours: 'not json' })).toThrow();
    expect(() => updateStoreSchema.parse({ theme: '"string"' })).toThrow();
  });

  test('요금제·SMS 권한 등 관리 전용 필드는 여전히 제거된다', () => {
    expect(updateStoreSchema.parse({ plan: 'enterprise', can_send_sms: true, user_id: 9 })).toEqual({});
  });
});
