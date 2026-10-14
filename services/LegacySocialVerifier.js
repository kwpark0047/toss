const { AppError } = require('../utils/errorHandler');
const { assertProviderProfile } = require('../utils/freeAuthPolicy');
class LegacySocialVerifier {
  constructor(env = process.env, transport = fetch) {
    this.env = env;
    this.fetch = transport;
  }
  async json(url, token) {
    const r = await this.fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new AppError('소셜 인증에 실패했습니다.', 401);
    const text = await r.text();
    if (text.length > 65536) throw new AppError('소셜 응답을 확인할 수 없습니다.', 401);
    return JSON.parse(text);
  }
  async verify(provider, token) {
    if (typeof token !== 'string' || !token || token.length > 8192)
      throw new AppError('소셜 인증에 실패했습니다.', 401);
    try {
      if (provider === 'google') {
        if (!this.env.GOOGLE_CLIENT_ID) throw new AppError('Google 서버 설정이 필요합니다.', 503);
        const info = await this.json(
          `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
        );
        if (info.aud !== this.env.GOOGLE_CLIENT_ID)
          throw new AppError('인증 앱이 일치하지 않습니다.', 401);
        return assertProviderProfile(
          await this.json('https://www.googleapis.com/oauth2/v3/userinfo', token)
        );
      }
      if (provider === 'kakao') {
        if (!this.env.KAKAO_APP_ID) throw new AppError('Kakao 서버 설정이 필요합니다.', 503);
        const info = await this.json('https://kapi.kakao.com/v1/user/access_token_info', token);
        if (String(info.app_id) !== this.env.KAKAO_APP_ID || !info.id)
          throw new AppError('인증 앱이 일치하지 않습니다.', 401);
        const profile = await this.json('https://kapi.kakao.com/v2/user/me', token);
        if (!profile.id || String(profile.id) !== String(info.id))
          throw new AppError('인증 계정을 확인할 수 없습니다.', 401);
        return assertProviderProfile({
          sub: String(profile.id),
          name: profile.properties?.nickname,
          email: profile.kakao_account?.email,
          email_verified:
            profile.kakao_account?.is_email_verified === true &&
            profile.kakao_account?.is_email_valid === true,
        });
      }
      if (provider === 'naver') {
        const data = await this.json('https://openapi.naver.com/v1/nid/me', token);
        if (data.resultcode !== '00') throw new AppError('Naver 인증에 실패했습니다.', 401);
        return assertProviderProfile({ sub: data.response?.id, name: data.response?.name });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('소셜 인증 응답을 확인하지 못했습니다.', 401);
    }
    throw new AppError('지원하지 않는 인증 수단입니다.', 400);
  }
}
module.exports = { LegacySocialVerifier };
