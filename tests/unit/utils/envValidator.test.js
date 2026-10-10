describe('environment safety validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost/test',
      JWT_SECRET: 'a-secure-test-secret-that-is-long-enough',
    };
    delete process.env.BYPASS_OTP;
    delete process.env.EXPOSE_OTP;
    delete process.env.ALLOW_MOCK_PAYMENTS;
    jest.doMock('../../../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('explicit separation mode rejects missing or JWT-shared encryption keys', () => {
    process.env.REQUIRE_SEPARATE_ENCRYPTION_KEYS = 'true';
    delete process.env.PHONE_ENC_KEY;
    delete process.env.TOKEN_ENC_KEY;
    delete process.env.PROVIDER_SECRET_KEY;
    const { checkEnv } = require('../../../utils/envValidator');
    expect(checkEnv().ok).toBe(false);
    for (const key of ['PHONE_ENC_KEY', 'TOKEN_ENC_KEY', 'PROVIDER_SECRET_KEY'])
      process.env[key] = process.env.JWT_SECRET;
    expect(checkEnv().ok).toBe(false);
    for (const key of ['PHONE_ENC_KEY', 'TOKEN_ENC_KEY', 'PROVIDER_SECRET_KEY'])
      process.env[key] = 'fixture-legacy-encryption-key';
    expect(checkEnv().ok).toBe(true);
  });

  test.each(['BYPASS_OTP', 'EXPOSE_OTP', 'ALLOW_MOCK_PAYMENTS'])(
    'rejects %s in production',
    (flag) => {
      process.env[flag] = 'true';
      const { checkEnv } = require('../../../utils/envValidator');

      const result = checkEnv();

      expect(result.ok).toBe(false);
      expect(result.warnings[0]).toContain(flag);
    }
  );

  test('allows disabled development flags in production', () => {
    process.env.BYPASS_OTP = 'false';
    process.env.EXPOSE_OTP = 'false';
    process.env.ALLOW_MOCK_PAYMENTS = 'false';
    const { checkEnv } = require('../../../utils/envValidator');

    expect(checkEnv().ok).toBe(true);
  });

  test.each(['변경필요', 'short-secret', '   '])('rejects unusable production JWT: %s', (value) => {
    process.env.JWT_SECRET = value;
    const { checkEnv } = require('../../../utils/envValidator');
    const result = checkEnv();
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(value === '   ' ? 'never-log-this' : value);
  });

  test.each(['PHONE_ENC_KEY', 'TOKEN_ENC_KEY', 'PROVIDER_SECRET_KEY', 'JWT_REFRESH_SECRET'])(
    'rejects configured invalid %s without exposing its value',
    (key) => {
      process.env[key] = 'invalid-key';
      const { checkEnv } = require('../../../utils/envValidator');
      const result = checkEnv();
      expect(result.ok).toBe(false);
      expect(result.warnings.join(' ')).toContain(key);
      expect(JSON.stringify(result)).not.toContain('invalid-key');
    }
  );

  test('warns when only one NCP geocoding credential is configured', () => {
    process.env.NCP_GEOCODE_KEY_ID = 'test-id';
    delete process.env.NCP_GEOCODE_KEY;
    const { checkEnv } = require('../../../utils/envValidator');

    const result = checkEnv();

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('NCP_GEOCODE_KEY_ID와 NCP_GEOCODE_KEY를 함께 설정'),
      ])
    );
  });
});
