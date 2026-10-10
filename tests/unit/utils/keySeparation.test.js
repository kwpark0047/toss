const oldKey = 'fixture-original-encryption-secret';
const newKey = 'fixture-new-login-signature-secret-32';
describe('signing key rotation preserves explicit encryption keys', () => {
  const original = process.env;
  afterEach(() => {
    process.env = original;
    jest.resetModules();
  });
  test('phone, payment token and provider secret survive JWT rotation without rewriting', () => {
    process.env = { ...original, NODE_ENV: 'test', JWT_SECRET: oldKey };
    delete process.env.PHONE_ENC_KEY;
    delete process.env.TOKEN_ENC_KEY;
    delete process.env.PROVIDER_SECRET_KEY;
    jest.resetModules();
    const phone = require('../../../utils/phoneEncryption').encryptPhone('01012345678');
    const token = require('../../../utils/tokenEncryption').encryptToken('fixture-billing-token');
    const provider = require('../../../utils/providerSecret').seal(
      { api_key: 'fixture-provider-key' },
      'store:3:pos'
    );
    process.env = {
      ...process.env,
      JWT_SECRET: newKey,
      PHONE_ENC_KEY: oldKey,
      TOKEN_ENC_KEY: oldKey,
      PROVIDER_SECRET_KEY: oldKey,
    };
    jest.resetModules();
    const phones = require('../../../utils/phoneEncryption');
    expect(phones.decryptPhone(phone)).toBe('01012345678');
    expect(phones.phoneSearchCandidates('01012345678')).toContain(phone);
    expect(require('../../../utils/tokenEncryption').decryptToken(token)).toBe(
      'fixture-billing-token'
    );
    const secrets = require('../../../utils/providerSecret');
    expect(secrets.open(provider, 'store:3:pos')).toEqual({ api_key: 'fixture-provider-key' });
    expect(() => secrets.open(provider, 'store:4:pos')).toThrow();
  });
});
