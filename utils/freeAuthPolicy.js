const { AppError } = require('./errorHandler');
function normalizeEmail(value) {
  if (
    typeof value !== 'string' ||
    Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    throw new AppError('이메일 주소를 확인해 주세요.', 400);
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AppError('이메일 주소를 확인해 주세요.', 400);
  return email;
}
function publicConfig(env = process.env) {
  const enabled = env.FREE_AUTH_ENABLED === 'true';
  const protectedForms = !!(
    env.TURNSTILE_SITE_KEY &&
    env.TURNSTILE_SECRET_KEY &&
    env.EMAIL_AUTH_PEPPER?.length >= 32
  );
  return {
    enabled,
    google: enabled && protectedForms && !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    googleReauth: false,
    kakao: enabled && protectedForms && !!(env.KAKAO_REST_API_KEY && env.KAKAO_CLIENT_SECRET),
    email:
      enabled &&
      protectedForms &&
      !!(
        env.SMTP_HOST &&
        env.SMTP_USER &&
        env.SMTP_PASSWORD &&
        (env.MAIL_FROM || env.SMTP_FROM) &&
        env.EMAIL_AUTH_PEPPER
      ),
    turnstileSiteKey: enabled ? env.TURNSTILE_SITE_KEY || null : null,
    termsUrl: policyUrl(env.FREE_AUTH_TERMS_URL, env),
    privacyUrl: policyUrl(env.FREE_AUTH_PRIVACY_URL, env),
  };
}
function policyUrl(value, env) {
  try {
    const url = new URL(value);
    return url.origin === frontendOrigin(env) && url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
function assertProviderProfile(claims) {
  if (
    !claims ||
    typeof claims.sub !== 'string' ||
    !claims.sub.trim() ||
    claims.sub.length > 255 ||
    ['undefined', 'null'].includes(claims.sub)
  )
    throw new AppError('소셜 인증 응답을 확인할 수 없습니다.', 401);
  return {
    subject: claims.sub,
    email: claims.email && claims.email_verified === true ? normalizeEmail(claims.email) : null,
    name: typeof claims.name === 'string' ? claims.name.slice(0, 80) : '위마켓 회원',
  };
}
function frontendOrigin(env = process.env) {
  try {
    const url = new URL(env.FRONTEND_URL);
    if (
      url.protocol !== 'https:' &&
      !(env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname))
    )
      throw Error();
    return url.origin;
  } catch {
    throw new AppError('인증 주소 설정을 확인해 주세요.', 503);
  }
}
module.exports = { normalizeEmail, publicConfig, assertProviderProfile, frontendOrigin };
