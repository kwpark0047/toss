const { AppError } = require('../utils/errorHandler');
const { frontendOrigin } = require('../utils/freeAuthPolicy');
class TurnstileVerifier {
  constructor(env = process.env, transport = fetch) {
    this.env = env;
    this.fetch = transport;
  }
  async verify(token, action) {
    if (!this.env.TURNSTILE_SECRET_KEY)
      throw new AppError('자동 가입 방지 설정이 필요합니다.', 503);
    if (typeof token !== 'string' || !token || token.length > 2048)
      throw new AppError('보안 확인을 다시 진행해 주세요.', 400);
    let result;
    try {
      const response = await this.fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: this.env.TURNSTILE_SECRET_KEY, response: token }),
          signal: AbortSignal.timeout(5000),
        }
      );
      if (!response.ok) throw Error();
      result = await response.json();
    } catch {
      throw new AppError(
        '보안 확인 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        503
      );
    }
    const allowed = new URL(frontendOrigin(this.env)).hostname;
    if (result.success !== true || result.hostname !== allowed || result.action !== action)
      throw new AppError('보안 확인이 만료됐거나 일치하지 않습니다. 다시 진행해 주세요.', 400);
  }
}
module.exports = { TurnstileVerifier };
