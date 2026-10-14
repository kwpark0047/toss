const { AppError } = require('../utils/errorHandler');
const { assertProviderProfile } = require('../utils/freeAuthPolicy');
const providers = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    issuer: 'https://accounts.google.com',
    jwks: 'https://www.googleapis.com/oauth2/v3/certs',
    scope: 'openid email profile',
    client: 'GOOGLE_CLIENT_ID',
    secret: 'GOOGLE_CLIENT_SECRET',
  },
  kakao: {
    authorize: 'https://kauth.kakao.com/oauth/authorize',
    token: 'https://kauth.kakao.com/oauth/token',
    issuer: 'https://kauth.kakao.com',
    jwks: 'https://kauth.kakao.com/.well-known/jwks.json',
    scope: 'openid account_email profile_nickname',
    client: 'KAKAO_REST_API_KEY',
    secret: 'KAKAO_CLIENT_SECRET',
  },
};
async function verifyOidcToken(token, { keys, issuer, audience, nonce, reauth = false }) {
  const { jwtVerify } = await import('jose');
  const { payload } = await jwtVerify(token, keys, {
    issuer,
    audience,
    algorithms: ['RS256'],
    requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
    maxTokenAge: '10m',
    clockTolerance: 15,
  });
  if (typeof nonce !== 'string' || payload.nonce !== nonce)
    throw new AppError('소셜 인증 요청이 일치하지 않습니다.', 401);
  if (
    reauth &&
    (!Number.isFinite(payload.auth_time) ||
      Date.now() / 1000 - payload.auth_time > 300 ||
      payload.auth_time > Date.now() / 1000 + 15)
  )
    throw new AppError(
      '소셜 계정에서 최근 인증을 확인하지 못했습니다. 다른 인증 수단을 사용해 주세요.',
      403
    );
  return assertProviderProfile(payload);
}
class OAuthProvider {
  constructor(env = process.env, transport = fetch) {
    this.env = env;
    this.fetch = transport;
    this.keys = {};
  }
  settings(provider) {
    const item = providers[provider];
    if (!item || !this.env[item.client] || !this.env[item.secret])
      throw new AppError('소셜 로그인 설정이 필요합니다.', 503);
    return item;
  }
  redirect(provider) {
    try {
      const url = new URL(this.env.FREE_AUTH_API_ORIGIN);
      if (
        url.protocol !== 'https:' &&
        !(this.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname))
      )
        throw Error();
      return `${url.origin}/api/auth/free/oauth/${provider}/callback`;
    } catch {
      throw new AppError('소셜 인증 주소 설정이 필요합니다.', 503);
    }
  }
  authorization(provider, { state, nonce, verifier, reauth = false }) {
    const crypto = require('node:crypto'),
      item = this.settings(provider),
      url = new URL(item.authorize);
    const params = {
      client_id: this.env[item.client],
      redirect_uri: this.redirect(provider),
      response_type: 'code',
      scope: item.scope,
      state,
      nonce,
    };
    if (provider === 'google') {
      params.code_challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      params.code_challenge_method = 'S256';
      params.prompt = 'select_account';
      if (reauth) params.max_age = '0';
    } else if (reauth) params.prompt = 'login';
    url.search = new URLSearchParams(params).toString();
    return url.href;
  }
  async exchange(provider, { code, nonce, verifier, reauth = false }) {
    const item = this.settings(provider),
      params = {
        grant_type: 'authorization_code',
        client_id: this.env[item.client],
        client_secret: this.env[item.secret],
        redirect_uri: this.redirect(provider),
        code,
      };
    if (provider === 'google') params.code_verifier = verifier;
    let body;
    try {
      const response = await this.fetch(item.token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw Error();
      const text = await response.text();
      if (text.length > 65536) throw Error();
      body = JSON.parse(text);
      if (typeof body.id_token !== 'string' || body.id_token.length > 16000) throw Error();
      const { createRemoteJWKSet } = await import('jose');
      this.keys[provider] ||= createRemoteJWKSet(new URL(item.jwks), { timeoutDuration: 5000 });
      return await verifyOidcToken(body.id_token, {
        keys: this.keys[provider],
        issuer: item.issuer,
        audience: this.env[item.client],
        nonce,
        reauth,
      });
    } catch {
      throw new AppError('소셜 인증 제공자 응답을 확인하지 못했습니다. 다시 로그인해 주세요.', 401);
    }
  }
}
module.exports = { OAuthProvider, verifyOidcToken };
