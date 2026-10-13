const { updateProfileSchema } = require('../../../src/validation/schemas/auth');
test('editable email and address, including clearing, are accepted', () => {
  expect(
    updateProfileSchema.safeParse({ email: 'owner@example.com', address: '서울 강남' }).success
  ).toBe(true);
  expect(updateProfileSchema.safeParse({ email: null, address: null }).success).toBe(true);
});
test('profile cannot assign administrative permissions or an invalid email', () => {
  expect(updateProfileSchema.safeParse({ role: 'super_admin' }).success).toBe(false);
  expect(updateProfileSchema.safeParse({ email: 'invalid' }).success).toBe(false);
});
