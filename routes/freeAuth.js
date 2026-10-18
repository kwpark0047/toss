const router = require('express').Router();
const prisma = require('../config/prisma'),
  auth = require('../middleware/auth');
const { AppError } = require('../utils/errorHandler');
const {
  publicConfig,
  frontendOrigin,
  assertSignupConsent,
  SIGNUP_CONSENT_VERSION,
} = require('../utils/freeAuthPolicy');
const { TurnstileVerifier } = require('../services/TurnstileVerifier');
const { EmailAuthService } = require('../services/EmailAuthService');
const { AuthIdentityService } = require('../services/AuthIdentityService');
const { OAuthLoginService } = require('../services/OAuthLoginService');
const { AccountLifecycleService } = require('../services/AccountLifecycleService');
const { DirectEmailSignupService } = require('../services/DirectEmailSignupService');
const { validateBody } = require('../middleware/validate');
const { simpleSignupSchema } = require('../src/validation/schemas/auth');
const { consumeProof } = require('../services/FreeAuthStore');
const { setTokenCookies, clearTokenCookies } = require('../utils/tokenCookies');
const email = new EmailAuthService(),
  identity = new AuthIdentityService(),
  oauth = new OAuthLoginService(),
  life = new AccountLifecycleService(),
  turnstile = new TurnstileVerifier();
const directSignup = new DirectEmailSignupService();
const wrap = (fn) => (req, res, next) =>
  Promise.resolve()
    .then(() => fn(req, res))
    .catch((error) => {
      if (error instanceof AppError) return next(error);
      require('../utils/logger').warn('[FreeAuth] 인증 처리 실패', {
        code: typeof error.code === 'string' ? error.code : 'INTERNAL',
      });
      next(new AppError('인증 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.', 503));
    });
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});
router.get(
  '/config',
  wrap(async (_req, res) => {
    const config = publicConfig();
    if (config.enabled || config.simpleSignup) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT
          to_regclass('public.users') IS NOT NULL AS users_ready,
          to_regclass('public.auth_oauth_flows') IS NOT NULL AS oauth_ready,
          to_regclass('public.auth_abuse_buckets') IS NOT NULL AS abuse_ready,
          to_regclass('public.auth_account_events') IS NOT NULL AS account_events_ready,
          to_regclass('public.auth_sessions') IS NOT NULL AS sessions_ready`
      );
      const row = rows[0] || {};
      const baseReady = row.users_ready && row.abuse_ready && row.account_events_ready && row.sessions_ready;
      const ready = baseReady && (!config.google && !config.kakao || row.oauth_ready);
      if (!ready)
        return res.success({
          ...config,
          enabled: false,
          simpleSignup: false,
          google: false,
          kakao: false,
          email: false,
          turnstileSiteKey: null,
          setupRequired: true,
        });
    }
    res.success(config);
  })
);
router.post(
  '/signup/simple',
  validateBody(simpleSignupSchema),
  wrap(async (req, res) => {
    const config = publicConfig();
    if (!config.simpleSignup)
      throw new AppError('간편 가입을 위한 약관·보안 설정이 완료되지 않았습니다.', 503);
    if (!assertSignupConsent({ ...req.body, purpose: 'signup' }, config))
      throw new AppError('가입 약관·연령 확인을 완료해 주세요.', 400);
    await turnstile.verify(req.body.turnstileToken, 'signup');
    result(res, await directSignup.register(req.body, req.ip));
  })
);
// Existing linked social accounts still need MFA when new enrollment is off.
router.post(
  '/mfa',
  wrap(async (req, res) =>
    result(
      res,
      await identity.completeMfa(req.body.tempToken, req.body.code, req.body.browserProof)
    )
  )
);
router.use((_req, _res, next) =>
  process.env.FREE_AUTH_ENABLED === 'true'
    ? next()
    : next(new AppError('새 인증 기능은 아직 활성화되지 않았습니다.', 503))
);
const actor = auth.authMiddleware,
  optional = auth.optionalAuth;
function authenticatedPurpose(req) {
  if (['link', 'reauth'].includes(req.body.purpose || req.body.intent) && !req.user?.sid)
    throw new AppError('기존 계정으로 먼저 로그인해 주세요.', 401);
}
async function recent(req) {
  if ((req.body.purpose || req.body.intent) === 'link')
    await prisma.$transaction((tx) =>
      consumeProof(tx, req.user.id, req.user.sid, req.body.reauthProof, process.env)
    );
}
function result(res, data) {
  if (data.token) setTokenCookies(res, data.token, data.refreshToken);
  return res.success(data);
}
router.post(
  '/email/request',
  optional,
  wrap(async (req, res) => {
    if (!publicConfig().email) throw new AppError('이메일 인증 설정이 필요합니다.', 503);
    const signingUp = assertSignupConsent(req.body);
    authenticatedPurpose(req);
    await turnstile.verify(
      req.body.turnstileToken,
      req.body.purpose === 'signup'
        ? 'signup'
        : ['link', 'reauth'].includes(req.body.purpose)
          ? req.body.purpose
          : 'login'
    );
    await recent(req);
    res.success(
      await email.request({
        ...req.body,
        consentVersion: signingUp ? SIGNUP_CONSENT_VERSION : null,
        userId: ['link', 'reauth'].includes(req.body.purpose) ? req.user.id : null,
        sessionId: req.user?.sid || null,
        ip: req.ip,
      })
    );
  })
);
router.post(
  '/email/verify',
  optional,
  wrap(async (req, res) =>
    result(
      res,
      await email.verify(req.body, async (tx, row) => {
        if (
          row.user_id &&
          (!req.user || req.user.id !== row.user_id || req.user.sid !== row.session_id)
        )
          throw new AppError('인증을 시작한 계정으로 다시 로그인해 주세요.', 401);
        return identity.emailResult(tx, row, req.body.browserProof, req.user?.sid);
      })
    )
  )
);
router.post(
  '/oauth/:provider/start',
  optional,
  wrap(async (req, res) => {
    if (!publicConfig()[req.params.provider] || !['google', 'kakao'].includes(req.params.provider))
      throw new AppError('소셜 로그인 설정이 필요합니다.', 503);
    const signingUp = assertSignupConsent(req.body);
    authenticatedPurpose(req);
    await turnstile.verify(
      req.body.turnstileToken,
      req.body.intent === 'signup'
        ? 'signup'
        : ['link', 'reauth'].includes(req.body.intent)
          ? req.body.intent
          : 'login'
    );
    await recent(req);
    res.success(
      await oauth.start({
        ...req.body,
        consentVersion: signingUp ? SIGNUP_CONSENT_VERSION : null,
        provider: req.params.provider,
        userId: ['link', 'reauth'].includes(req.body.intent) ? req.user.id : null,
        sessionId: req.user?.sid || null,
        ip: req.ip,
      })
    );
  })
);
router.get(
  '/oauth/:provider/callback',
  wrap(async (req, res) => {
    const query = req.freeAuthCallback || req.query,
      origin = frontendOrigin();
    try {
      if (query.error) throw new AppError('소셜 로그인이 취소되었습니다.', 400);
      const id = await oauth.callback(req.params.provider, query.state, query.code);
      res.redirect(`${origin}/auth/free/callback#flow=${encodeURIComponent(id)}`);
    } catch {
      res.redirect(`${origin}/auth/free/callback#error=oauth_failed`);
    }
  })
);
router.post(
  '/oauth/exchange',
  optional,
  wrap(async (req, res) =>
    result(res, await oauth.exchange(req.body.flowId, req.body.browserProof, req.user))
  )
);
router.get(
  '/accounts',
  actor,
  wrap(async (req, res) => res.success(await life.accounts(req.user)))
);
router.post(
  '/reauth/password',
  actor,
  wrap(async (req, res) =>
    res.success(await identity.reauthPassword(req.user.id, req.user.sid, req.body.password))
  )
);
router.post(
  '/reauth/totp',
  actor,
  wrap(async (req, res) => res.success(await life.reauthTotp(req.user, req.body.code)))
);
router.post(
  '/accounts/unlink',
  actor,
  wrap(async (req, res) =>
    res.success(await life.unlink(req.user, req.body.provider, req.body.reauthProof))
  )
);
router.post(
  '/withdraw',
  actor,
  wrap(async (req, res) => {
    const { sessionIds = [], ...data } = await life.withdraw(
      req.user,
      req.body.reauthProof,
      req.body.operationId
    );
    clearTokenCookies(res);
    const io = require('../services/DashboardBroadcastService').io;
    if (io) for (const sid of sessionIds) io.in(`auth-session:${sid}`).disconnectSockets(true);
    res.success(data);
  })
);
module.exports = router;

