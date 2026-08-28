const { AppError } = require('../utils/errorHandler');
const twoFactorService = require('../services/TwoFactorService');
const prisma = require('../config/prisma');

const twoFactorController = {
  /**
   * 2FA 설정 상태 조회
   * GET /api/auth/2fa/status
   */
  getStatus: async (req, res, next) => {
    try {
      const user = await prisma.users.findUnique({
        where: { id: req.user.id },
        select: {
          two_factor_enabled: true,
          two_factor_secret: true,
          two_factor_backup_codes: true,
        },
      });
      if (!user) return next(new AppError('사용자를 찾을 수 없습니다.', 404));

      const hasBackupCodes = user.two_factor_backup_codes
        ? JSON.parse(user.two_factor_backup_codes).length > 0
        : false;

      res.success(
        {
          enabled: user.two_factor_enabled,
          hasSecret: !!user.two_factor_secret,
          backupCodesRemaining: hasBackupCodes
            ? JSON.parse(user.two_factor_backup_codes).length
            : 0,
        },
        '2FA 상태 조회 완료'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * TOTP 2FA 활성화 시작 - 비밀키 및 QR 코드 생성
   * POST /api/auth/2fa/enable
   */
  enableSetup: async (req, res, next) => {
    try {
      const user = await prisma.users.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, phone: true, two_factor_enabled: true },
      });
      if (!user) return next(new AppError('사용자를 찾을 수 없습니다.', 404));

      if (user.two_factor_enabled) {
        return next(new AppError('이미 2FA가 활성화되어 있습니다.', 400));
      }

      const { secret, otpauthUrl, qrCodeDataUrl } = await twoFactorService.generateSecret(user);

      // 비밀키는 검증 완료 후 저장하므로 여기서는 반환만
      res.success(
        {
          secret,
          otpauthUrl,
          qrCodeDataUrl,
          message:
            '인증 앱(Google Authenticator, Authy 등)에서 QR 코드를 스캔한 후 6자리 코드를 입력하세요.',
        },
        '2FA 설정 준비 완료'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * TOTP 2FA 활성화 완료 - 토큰 검증 후 비밀키 저장
   * POST /api/auth/2fa/enable/verify
   * Body: { token, backup_codes: boolean }
   */
  enableVerify: async (req, res, next) => {
    try {
      const { token, saveBackupCodes = true } = req.body;
      if (!token) return next(new AppError('인증 코드를 입력해주세요.', 400));

      const user = await prisma.users.findUnique({
        where: { id: req.user.id },
        select: { id: true, two_factor_secret: true },
      });
      if (!user) return next(new AppError('사용자를 찾을 수 없습니다.', 404));

      // 임시 비밀키가 전달되지 않았으면 기존 저장된 비밀키 사용
      const secret = user.two_factor_secret || req.body.secret;
      if (!secret) return next(new AppError('비밀키가 없습니다. 다시 시도해주세요.', 400));

      const valid = twoFactorService.verifyToken(token, secret);
      if (!valid) {
        return next(new AppError('인증 코드가 올바르지 않습니다. 시간 동기화를 확인하세요.', 400));
      }

      // 백업 코드 생성
      let backupCodes = [];
      if (saveBackupCodes) {
        backupCodes = twoFactorService.generateBackupCodes();
        await twoFactorService.saveBackupCodes(user.id, backupCodes);
      }

      // 2FA 활성화 및 비밀키 저장
      await twoFactorService.enableTwoFactor(user.id, secret);

      res.success(
        {
          backupCodes,
          message: '2FA가 성공적으로 활성화되었습니다. 백업 코드를 안전한 곳에 보관하세요.',
        },
        '2FA 활성화 완료'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * 2FA 비활성화
   * POST /api/auth/2fa/disable
   * Body: { token } - TOTP 토큰 또는 백업 코드
   */
  disable: async (req, res, next) => {
    try {
      const { token, useBackupCode = false } = req.body;
      if (!token) return next(new AppError('인증 코드 또는 백업 코드를 입력해주세요.', 400));

      const user = await prisma.users.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          two_factor_enabled: true,
          two_factor_secret: true,
          two_factor_backup_codes: true,
        },
      });
      if (!user || !user.two_factor_enabled) {
        return next(new AppError('2FA가 활성화되어 있지 않습니다.', 400));
      }

      let valid = false;

      if (useBackupCode) {
        // 백업 코드로 검증
        valid = await twoFactorService.verifyAndConsumeBackupCode(user.id, token);
      } else {
        // TOTP 토큰으로 검증
        if (!user.two_factor_secret) {
          return next(new AppError('비밀키가 없습니다.', 400));
        }
        valid = twoFactorService.verifyToken(token, user.two_factor_secret);
      }

      if (!valid) {
        return next(new AppError('인증 코드 또는 백업 코드가 올바르지 않습니다.', 400));
      }

      // 2FA 비활성화
      await twoFactorService.disableTwoFactor(user.id);

      res.success({ message: '2FA가 비활성화되었습니다.' }, '2FA 비활성화 완료');
    } catch (error) {
      next(error);
    }
  },

  /**
   * 백업 코드 재발급
   * POST /api/auth/2fa/backup-codes/regenerate
   * Body: { token } - TOTP 토큰으로 인증
   */
  regenerateBackupCodes: async (req, res, next) => {
    try {
      const { token } = req.body;
      if (!token) return next(new AppError('인증 코드를 입력해주세요.', 400));

      const user = await prisma.users.findUnique({
        where: { id: req.user.id },
        select: { id: true, two_factor_enabled: true, two_factor_secret: true },
      });
      if (!user || !user.two_factor_enabled) {
        return next(new AppError('2FA가 활성화되어 있지 않습니다.', 400));
      }

      if (!user.two_factor_secret) {
        return next(new AppError('비밀키가 없습니다.', 400));
      }

      const valid = twoFactorService.verifyToken(token, user.two_factor_secret);
      if (!valid) {
        return next(new AppError('인증 코드가 올바르지 않습니다.', 400));
      }

      const backupCodes = twoFactorService.generateBackupCodes();
      await twoFactorService.saveBackupCodes(user.id, backupCodes);

      res.success({ backupCodes }, '백업 코드가 재발급되었습니다. 안전한 곳에 보관하세요.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * 로그인 시 2FA 토큰 검증 (로그인 플로우에서 호출)
   * POST /api/auth/2fa/verify-login
   * Body: { identifier, token, useBackupCode }
   */
  verifyLogin: async (req, res, next) => {
    try {
      const { identifier, token, useBackupCode = false } = req.body;
      if (!identifier || !token) {
        return next(new AppError('아이디/전화번호와 인증 코드가 필요합니다.', 400));
      }

      // identifier로 사용자 찾기 (이메일 또는 전화번호)
      const user = await prisma.users.findFirst({
        where: {
          OR: [{ email: identifier }, { phone: identifier }],
        },
        select: {
          id: true,
          two_factor_enabled: true,
          two_factor_secret: true,
          two_factor_backup_codes: true,
        },
      });

      if (!user || !user.two_factor_enabled) {
        return next(new AppError('2FA가 설정되지 않은 계정입니다.', 400));
      }

      let valid = false;

      if (useBackupCode) {
        valid = await twoFactorService.verifyAndConsumeBackupCode(user.id, token);
      } else {
        if (!user.two_factor_secret) {
          return next(new AppError('2FA 설정이 완료되지 않았습니다.', 400));
        }
        valid = twoFactorService.verifyToken(token, user.two_factor_secret);
      }

      if (!valid) {
        return next(new AppError('인증 코드 또는 백업 코드가 올바르지 않습니다.', 400));
      }

      res.success({ userId: user.id }, '2FA 검증 완료');
    } catch (error) {
      next(error);
    }
  },
};

module.exports = twoFactorController;
