// Compatibility endpoints: existing subject identities only; new signup uses code flow.
const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const { setTokenCookies } = require('../utils/tokenCookies');
const { LegacySocialVerifier } = require('../services/LegacySocialVerifier');
const { AuthIdentityService } = require('../services/AuthIdentityService');
const { AccountLifecycleService } = require('../services/AccountLifecycleService');
const { consumeProof } = require('../services/FreeAuthStore');
const verifier = new LegacySocialVerifier(),
  identity = new AuthIdentityService(),
  life = new AccountLifecycleService();
const safe = (fn) => (req, res, next) =>
  Promise.resolve()
    .then(() => fn(req, res))
    .catch((e) =>
      next(e instanceof AppError ? e : new AppError('소셜 인증 처리에 실패했습니다.', 503))
    );
function login(provider) {
  return safe(async (req, res) => {
    const profile = await verifier.verify(provider, req.body.accessToken);
    const result = await prisma.$transaction(async (tx) => {
      const user = await identity.resolve(tx, { ...profile, provider }, 'login');
      return identity.loginResult(tx, user, req.body.browserProof);
    });
    if (result.token) setTokenCookies(res, result.token, result.refreshToken);
    res.success({ ...result, isNew: false }, '로그인 성공');
  });
}
module.exports = {
  google: login('google'),
  kakao: login('kakao'),
  naver: login('naver'),
  getAccounts: safe(async (req, res) =>
    res.success((await life.accounts(req.user)).identities, '소셜 계정 목록')
  ),
  link: safe(async (req, res) => {
    const profile = await verifier.verify(req.body.provider, req.body.accessToken);
    await prisma.$transaction(async (tx) => {
      await consumeProof(tx, req.user.id, req.user.sid, req.body.reauthProof, process.env);
      await identity.resolve(tx, { ...profile, provider: req.body.provider }, 'link', req.user.id);
    });
    res.success({ linked: true }, '인증 수단이 연결되었습니다.');
  }),
  unlink: safe(async (req, res) =>
    res.success(
      await life.unlink(req.user, req.params.provider, req.body?.reauthProof),
      '인증 수단 연결을 해제했습니다.'
    )
  ),
};
