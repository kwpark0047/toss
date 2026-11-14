const {
  createStoreSchema,
  updateStoreSchema,
  businessInfoSchema,
} = require('../../../src/validation/schemas/store');

describe('optional store phone fields', () => {
  test('allows a blank optional phone during first-store setup', () => {
    const result = createStoreSchema.parse({ name: '테스트 매장', phone: '' });
    expect(result.phone).toBeUndefined();
  });

  test('normalizes a formatted phone number before validation', () => {
    const result = createStoreSchema.parse({ name: '테스트 매장', phone: '010-1234-5678' });
    expect(result.phone).toBe('01012345678');
  });

  test('still rejects malformed non-empty phone numbers', () => {
    expect(() => createStoreSchema.parse({ name: '테스트 매장', phone: '123' })).toThrow();
  });

  test('allows blank optional phone in business information', () => {
    const result = businessInfoSchema.parse({
      ceoName: '홍길동',
      businessNumber: '123-45-67890',
      phone: '',
    });
    expect(result.phone).toBeUndefined();
  });

  test('allows an explicit blank or null to clear a store phone', () => {
    expect(updateStoreSchema.parse({ phone: '' }).phone).toBeUndefined();
    expect(updateStoreSchema.parse({ phone: null }).phone).toBeNull();
  });
});
