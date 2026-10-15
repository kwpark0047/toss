const { AuthMailService } = require('../../../services/AuthMailService');
const { TurnstileVerifier } = require('../../../services/TurnstileVerifier');
const { OAuthProvider } = require('../../../services/OAuthProvider');
const { LegacySocialVerifier } = require('../../../services/LegacySocialVerifier');
const store = require('../../../services/FreeAuthStore');
const env = {
  NODE_ENV: 'test',
  FRONTEND_URL: 'https://app.invalid',
  FREE_AUTH_API_ORIGIN: 'https://api.invalid',
  EMAIL_AUTH_PEPPER: 'fixture-pepper-'.repeat(4),
  GOOGLE_CLIENT_ID: 'configured-app',
  GOOGLE_CLIENT_SECRET: 'fixture',
  KAKAO_REST_API_KEY: 'fixture',
  KAKAO_CLIENT_SECRET: 'fixture',
  KAKAO_APP_ID: '99',
  TURNSTILE_SECRET_KEY: 'fixture',
  SMTP_HOST: 'smtp.invalid',
  SMTP_USER: 'fixture',
  SMTP_PASSWORD: 'fixture',
  SMTP_FROM: 'sender@example.com',
};
const response = (data) => ({
  ok: true,
  json: async () => data,
  text: async () => JSON.stringify(data),
});
describe('Free authentication trust boundaries', () => {
  test('mail accepts only the intended recipient and closes transport on rejection', async () => {
    const close = jest.fn(),
      sendMail = jest
        .fn()
        .mockResolvedValueOnce({ accepted: ['target@example.com'] })
        .mockResolvedValueOnce({ accepted: [] });
    const mail = new AuthMailService(env, (options) => {
      expect(options.tls.rejectUnauthorized).toBe(true);
      return { sendMail, close };
    });
    expect(mail.configured()).toBe(true);
    expect(new AuthMailService({}).configured()).toBe(false);
    expect(
      await mail.send({ email: 'target@example.com', code: '123456', id: 'fixture', token: 'link' })
    ).toEqual({ accepted: true, delivered: false });
    await expect(
      mail.send({ email: 'target@example.com', code: '123456', id: 'fixture', token: 'link' })
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(2);
    await expect(new AuthMailService({}).send({})).rejects.toMatchObject({ statusCode: 503 });
  });
  test('Turnstile verifies hostname and action, failing closed on outage', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(response({ success: true, hostname: 'app.invalid', action: 'signup' }));
    const verifier = new TurnstileVerifier(env, fetcher);
    await verifier.verify('proof', 'signup');
    await expect(verifier.verify('proof', 'login')).rejects.toMatchObject({ statusCode: 400 });
    fetcher.mockResolvedValue(
      response({ success: true, hostname: 'foreign.invalid', action: 'signup' })
    );
    await expect(verifier.verify('proof', 'signup')).rejects.toMatchObject({ statusCode: 400 });
    fetcher.mockRejectedValue(Error('network'));
    await expect(verifier.verify('proof', 'signup')).rejects.toMatchObject({ statusCode: 503 });
    await expect(verifier.verify('', 'signup')).rejects.toMatchObject({ statusCode: 400 });
    await expect(new TurnstileVerifier({}).verify('proof', 'signup')).rejects.toMatchObject({
      statusCode: 503,
    });
  });
  test('OAuth authorization binds state/nonce and Google PKCE, rejects insecure callback settings', async () => {
    const provider = new OAuthProvider(env, async () => ({ ok: false }));
    const google = new URL(
      provider.authorization('google', {
        state: 'state',
        nonce: 'nonce',
        verifier: 'verifier',
        reauth: true,
      })
    );
    expect(google.searchParams.get('code_challenge_method')).toBe('S256');
    expect(google.searchParams.get('nonce')).toBe('nonce');
    expect(google.searchParams.get('state')).toBe('state');
    const kakao = new URL(
      provider.authorization('kakao', { state: 'state', nonce: 'nonce', reauth: true })
    );
    expect(kakao.searchParams.get('prompt')).toBe('login');
    expect(() => new OAuthProvider({}).settings('google')).toThrow();
    expect(() =>
      new OAuthProvider({
        ...env,
        NODE_ENV: 'production',
        FREE_AUTH_API_ORIGIN: 'http://api.invalid',
      }).redirect('google')
    ).toThrow();
    await expect(
      provider.exchange('google', { code: 'code', nonce: 'nonce', verifier: 'verifier' })
    ).rejects.toMatchObject({ statusCode: 401 });
  });
  test.each(['google', 'kakao', 'naver'])(
    'legacy %s verifies provider subject without merging unverified email',
    async (provider) => {
      const profiles =
        provider === 'google'
          ? [
              { aud: 'configured-app' },
              { sub: 'customer', email: 'target@example.com', email_verified: false },
            ]
          : provider === 'kakao'
            ? [
                { app_id: 99, id: 1 },
                {
                  id: 1,
                  kakao_account: { email: 'target@example.com', is_email_verified: false },
                  properties: { nickname: 'fixture' },
                },
              ]
            : [{ resultcode: '00', response: { id: 'customer', name: 'fixture' } }];
      const verifier = new LegacySocialVerifier(env, async () => response(profiles.shift()));
      expect((await verifier.verify(provider, 'token')).email).toBe(null);
    }
  );
  test('legacy verification rejects audience mismatch, malformed response and unsupported provider', async () => {
    await expect(
      new LegacySocialVerifier(env, async () => response({ aud: 'foreign' })).verify(
        'google',
        'token'
      )
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(
      new LegacySocialVerifier(env, async () => ({
        ok: true,
        text: async () => '{invalid',
      })).verify('naver', 'token')
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(new LegacySocialVerifier(env).verify('other', 'token')).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(new LegacySocialVerifier(env).verify('google', '')).rejects.toMatchObject({
      statusCode: 401,
    });
  });
  test('recent proof storage is hashed and consumption is bound to user and active session', async () => {
    const tx = {
      $executeRawUnsafe: jest.fn(),
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ user_id: 7 }]),
    };
    const proof = await store.recentProof(tx, { id: 7 }, 'session-fixture', env);
    expect(proof.expiresIn).toBe(300);
    expect(tx.$executeRawUnsafe.mock.calls[0][1]).not.toBe(proof.reauthProof);
    await store.consumeProof(tx, 7, 'session-fixture', proof.reauthProof, env);
    expect(tx.$queryRawUnsafe.mock.calls[0].slice(2)).toEqual([7, 'session-fixture']);
    tx.$queryRawUnsafe.mockResolvedValue([]);
    await expect(
      store.consumeProof(tx, 7, 'session-fixture', proof.reauthProof, env)
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(store.consumeProof(tx, 7, 'session-fixture', null, env)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(() => store.browserHash('short', env)).toThrow();
    expect(store.browserHash('a'.repeat(43), env)).toHaveLength(64);
  });
  test('locks use stable ordering and deleted accounts cannot authenticate', async () => {
    const tx = { $executeRawUnsafe: jest.fn(), $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
    await store.lock(tx, 'z', 'a', 'z');
    expect(tx.$queryRawUnsafe.mock.calls.map((c) => c[1])).toEqual(['a', 'z']);
    await expect(store.activeUser(tx, 7)).rejects.toMatchObject({ statusCode: 401 });
    tx.$queryRawUnsafe.mockResolvedValue([{ id: 7, auth_status: 'deletion_pending' }]);
    await expect(store.activeUser(tx, 7)).rejects.toMatchObject({ statusCode: 401 });
    tx.$queryRawUnsafe.mockResolvedValue([{ id: 7, auth_status: 'active' }]);
    expect((await store.activeUser(tx, 7)).id).toBe(7);
    tx.$queryRawUnsafe.mockResolvedValue([{ hits: 6 }]);
    expect(await store.bucket(tx, 'fixture', 5)).toBe(false);
    tx.$queryRawUnsafe.mockResolvedValue([{ hits: 1 }]);
    expect(await store.bucket(tx, 'fixture', 5, 60)).toBe(true);
  });
});
