const {
  createStoreSchema,
  updateStoreSchema,
  locationSearchQuerySchema,
} = require('../../../src/validation/schemas/store');

describe('매장 좌표 검증', () => {
  test('대한민국 범위 좌표 쌍은 통과', () => {
    expect(updateStoreSchema.parse({ latitude: 37.5663, longitude: 126.9778 })).toMatchObject({
      latitude: 37.5663,
      longitude: 126.9778,
    });
  });

  test('좌표 없이 다른 필드만 수정하는 기존 요청은 그대로 통과', () => {
    expect(updateStoreSchema.parse({ name: '매장' })).toEqual({ name: '매장' });
  });

  test('위도·경도를 둘 다 null로 지우는 것은 허용', () => {
    expect(updateStoreSchema.parse({ latitude: null, longitude: null })).toEqual({
      latitude: null,
      longitude: null,
    });
  });

  test('한쪽만 보내면 거부', () => {
    expect(() => updateStoreSchema.parse({ latitude: 37.5 })).toThrow('위도와 경도는 함께');
    expect(() => updateStoreSchema.parse({ latitude: 37.5, longitude: null })).toThrow(
      '위도와 경도는 함께'
    );
  });

  test('국외·(0,0) 좌표 거부', () => {
    expect(() => updateStoreSchema.parse({ latitude: 0, longitude: 0 })).toThrow('대한민국 범위');
    expect(() =>
      createStoreSchema.parse({ name: 'a', latitude: 35.68, longitude: 139.76 })
    ).toThrow('대한민국 범위');
  });

  test('주소 검색어는 2~100자', () => {
    expect(locationSearchQuerySchema.parse({ q: ' 세종대로 ' }).q).toBe('세종대로');
    expect(() => locationSearchQuerySchema.parse({ q: 'a' })).toThrow();
    expect(() => locationSearchQuerySchema.parse({ q: 'a'.repeat(101) })).toThrow();
  });
});
