const publicUser = require('../../../utils/publicUser');
test('profile and auth responses never include password hashes or 2FA recovery credentials', () => {
  expect(
    publicUser({
      id: 1,
      name: '관리자',
      role: 'super_admin',
      password: 'hash',
      two_factor_enabled: true,
      two_factor_secret: 'secret',
      two_factor_backup_codes: 'recovery',
    })
  ).toEqual({ id: 1, name: '관리자', role: 'super_admin', two_factor_enabled: true });
});
