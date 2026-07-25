const https = require('https');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');
const userRepository = require('../app/lib/repositories/user.repository');
const socialAccountRepository = require('../app/lib/repositories/socialAccount.repository');
const { setTokenCookies } = require('../utils/tokenCookies');

const JWT_SECRET = process.env.JWT_SECRET;
const IS_DEV = process.env.NODE_ENV !== 'production';

const signTokens = (user) => {
  const jwt = require('jsonwebtoken');
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
  const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '2h';
  const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role || 'user', type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRY }
  );
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY }
  );
  return { token, refreshToken };
};

const safeUser = (user) => {
  const { password: _, ...rest } = user;
  return rest;
};

/**
 * HTTPS 요청 헬퍼 — Promise 기반 (Bearer Token + Custom Headers 지원)
 */
const httpsGet = (url, accessToken) => {
  const options = { headers: { 'User-Agent': 'WeMarket/1.0' } };
  if (accessToken) options.headers['Authorization'] = `Bearer ${accessToken}`;
  return new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON response from provider'));
        }
      });
    }).on('error', reject);
  });
};

/**
 * Provider 액세스 토큰 검증 및 프로필 조회
 */
const verifyToken = async (provider, accessToken) => {
  switch (provider) {
    case 'kakao': {
      const data = await httpsGet('https://kapi.kakao.com/v2/user/me', accessToken);
      return {
        providerId: String(data.id),
        email: data.kakao_account?.email || null,
        name: data.properties?.nickname || data.kakao_account?.profile?.nickname || null,
        profileImage: data.properties?.profile_image || data.kakao_account?.profile?.profile_image_url || null,
      };
    }
    case 'naver': {
      const data = await httpsGet('https://openapi.naver.com/v1/nid/me', accessToken);
      if (data.resultcode !== '00') throw new AppError('Naver 인증에 실패했습니다.', 401);
      const { response } = data;
      return {
        providerId: response.id,
        email: response.email || null,
        name: response.nickname || response.name || null,
        profileImage: response.profile_image || null,
      };
    }
    case 'google': {
      const data = await httpsGet('https://www.googleapis.com/oauth2/v3/userinfo', accessToken);
      return {
        providerId: data.sub,
        email: data.email || null,
        name: data.name || null,
        profileImage: data.picture || null,
      };
    }
    default:
      throw new AppError('지원하지 않는 SNS 로그인 방식입니다.', 400);
  }
};

/**
 * Social Login 공통 처리
 */
const socialLogin = async (provider, accessToken, res, next) => {
  try {
    if (!accessToken) return next(new AppError('액세스 토큰이 필요합니다.', 400));

    const profile = await verifyToken(provider, accessToken);

    // 기존 social_account 확인
    const existing = await socialAccountRepository.findByProvider(provider, profile.providerId);

    if (existing && existing.user_id) {
      // 기존 계정 → JWT 발급
      const user = existing.users;
      const { token, refreshToken } = signTokens(user);
      setTokenCookies(res, token, refreshToken);
      return res.success({ token, refreshToken, user: safeUser(user), isNew: false }, '로그인 성공');
    }

    // 신규 — 사용자 찾기 또는 생성
    let user = null;

    // 같은 이메일의 기존 사용자 찾기
    if (profile.email) {
      user = await userRepository.findByEmail(profile.email);
    }

    if (!user) {
      // 새 사용자 생성
      const userName = profile.name || (provider === 'kakao' ? 'KakaoUser' : provider === 'naver' ? 'NaverUser' : 'GoogleUser');
      user = await userRepository.create({
        name: userName,
        email: profile.email || null,
        role: 'user',
        profile_step: 1,
      });
    }

    // social_account 레코드 생성
    await socialAccountRepository.create({
      user_id: user.id,
      provider,
      provider_id: profile.providerId,
      email: profile.email,
      name: profile.name,
      profile_image: profile.profileImage,
    });

    logger.info({ userId: user.id, provider }, 'Social account linked');

    const { token, refreshToken } = signTokens(user);
    setTokenCookies(res, token, refreshToken);
    res.created({ token, refreshToken, user: safeUser(user), isNew: true }, '회원가입이 완료되었습니다.');
  } catch (error) {
    if (error instanceof AppError) return next(error);
    logger.error({ error: error.message, provider }, 'Social login failed');
    return next(new AppError('SNS 로그인 처리 중 오류가 발생했습니다.', 500));
  }
};

/**
 * Kakao 로그인
 * POST /auth/social/kakao { accessToken }
 */
const kakao = (req, res, next) => {
  socialLogin('kakao', req.body.accessToken, res, next);
};

/**
 * Naver 로그인
 * POST /auth/social/naver { accessToken }
 */
const naver = (req, res, next) => {
  socialLogin('naver', req.body.accessToken, res, next);
};

/**
 * Google 로그인
 * POST /auth/social/google { accessToken }
 */
const google = (req, res, next) => {
  socialLogin('google', req.body.accessToken, res, next);
};

/**
 * 연결된 SNS 계정 목록 조회
 * GET /auth/social/accounts
 */
const getAccounts = async (req, res, next) => {
  try {
    const accounts = await socialAccountRepository.findByUserId(req.user.id);
    const list = accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      name: a.name,
      email: a.email,
      profile_image: a.profile_image,
      created_at: a.created_at,
    }));
    res.success(list, 'SNS 계정 목록');
  } catch (error) {
    next(error);
  }
};

/**
 * SNS 계정 연결 (기존 사용자)
 * POST /auth/social/link { provider, accessToken }
 */
const link = async (req, res, next) => {
  const { provider, accessToken } = req.body;
  try {
    if (!provider || !accessToken) return next(new AppError('provider와 accessToken이 필요합니다.', 400));

    const profile = await verifyToken(provider, accessToken);

    // 이미 연결된 계정인지 확인
    const existing = await socialAccountRepository.findByProvider(provider, profile.providerId);
    if (existing) {
      if (existing.user_id === req.user.id) {
        return res.success(null, '이미 연결된 계정입니다.');
      }
      return next(new AppError('다른 사용자에 의해 이미 연결된 SNS 계정입니다.', 409));
    }

    await socialAccountRepository.create({
      user_id: req.user.id,
      provider,
      provider_id: profile.providerId,
      email: profile.email,
      name: profile.name,
      profile_image: profile.profileImage,
    });

    logger.info({ userId: req.user.id, provider }, 'Social account linked');
    res.success(null, 'SNS 계정이 연결되었습니다.');
  } catch (error) {
    if (error instanceof AppError) return next(error);
    logger.error({ error: error.message, provider }, 'Social link failed');
    return next(new AppError('SNS 계정 연결 중 오류가 발생했습니다.', 500));
  }
};

/**
 * SNS 계정 연결 해제
 * DELETE /auth/social/unlink/:provider
 */
const unlink = async (req, res, next) => {
  try {
    const { provider } = req.params;
    const accounts = await socialAccountRepository.findByUserId(req.user.id);
    const target = accounts.find((a) => a.provider === provider);

    if (!target) return next(new AppError('연결된 SNS 계정을 찾을 수 없습니다.', 404));

    await socialAccountRepository.delete(target.id);
    logger.info({ userId: req.user.id, provider }, 'Social account unlinked');
    res.success(null, 'SNS 계정 연결이 해제되었습니다.');
  } catch (error) {
    next(error);
  }
};

module.exports = { kakao, naver, google, getAccounts, link, unlink };
