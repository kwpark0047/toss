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

  test.each(['BYPASS_OTP', 'EXPOSE_OTP', 'ALLOW_MOCK_PAYMENTS'])(
    'rejects %s in production',
    flag => {
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

  test('warns when only one NCP geocoding credential is configured', () => {
    process.env.NCP_GEOCODE_KEY_ID = 'test-id';
    delete process.env.NCP_GEOCODE_KEY;
    const { checkEnv } = require('../../../utils/envValidator');

    const result = checkEnv();

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('NCP_GEOCODE_KEY_ID와 NCP_GEOCODE_KEY를 함께 설정'),
    ]));
  });
});
