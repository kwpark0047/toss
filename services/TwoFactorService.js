const otplib = require('otplib');
const qrcode = require('qrcode');
const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const { decryptPhone } = require('../utils/phoneEncryption');
const { sendSms } = require('../utils/smsService');

const IS_DEV = process.env.NODE_ENV !== 'production';

// otplib v12+ 설정
const totp = otplib.TOTP;
totp.options = {
  window: 1,
  step: 30,
  digits: 6,
  algorithm: 'SHA1',
  encoding: 'base32',
};

/**
 * TOTP 기반 2단계 인증 서비스 (일반 사용자용)
 */
class TwoFactorService {
  /**
   * TOTP 비밀키 생성 및 QR 코드 반환
   * @param {Object} user - 사용자 객체
   * @returns {Object} { secret, otpauthUrl, qrCodeDataUrl }
   */
  async generateSecret(user) {
    const secret = otplib.generateSecret();
    const issuer = 'WeMarket';
    const accountName = user.email || user.phone || `user_${user.id}`;

    const otpauthUrl = otplib.generateURI(accountName, issuer, secret);

    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
    } catch (e) {
      // QR 코드 생성 실패 시 무시
    }

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /**
   * TOTP 토큰 검증
   * @param {string} token - 사용자 입력 토큰 (6자리)
   * @param {string} secret - 저장된 비밀키
   * @returns {boolean}
   */
  verifyToken(token, secret) {
    if (!token || !secret) return false;
    return otplib.verify(token, secret);
  }

  /**
   * 2FA 활성화 (비밀키 저장)
   * @param {number} userId
   * @param {string} secret
   */
  async enableTwoFactor(userId, secret) {
    await prisma.users.update({
      where: { id: userId },
      data: {
        two_factor_enabled: true,
        two_factor_secret: secret,
      },
    });
  }

  /**
   * 2FA 비활성화
   * @param {number} userId
   */
  async disableTwoFactor(userId) {
    await prisma.users.update({
      where: { id: userId },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null,
      },
    });
  }

  /**
   * 백업 코드 생성 (10개)
   * @returns {string[]}
   */
  generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
    }
    return codes;
  }

  /**
   * 백업 코드 저장 (해시로 저장)
   */
  async saveBackupCodes(userId, codes) {
    const crypto = require('crypto');
    const hashedCodes = codes.map((code) => crypto.createHash('sha256').update(code).digest('hex'));
    await prisma.users.update({
      where: { id: userId },
      data: { two_factor_backup_codes: JSON.stringify(hashedCodes) },
    });
  }

  /**
   * 백업 코드 검증 및 사용 처리
   */
  async verifyAndConsumeBackupCode(userId, code) {
    const crypto = require('crypto');
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { two_factor_backup_codes: true },
    });
    if (!user?.two_factor_backup_codes) return false;

    const hashedCodes = JSON.parse(user.two_factor_backup_codes);
    const hashedInput = crypto.createHash('sha256').update(code).digest('hex');

    const index = hashedCodes.indexOf(hashedInput);
    if (index === -1) return false;

    // 사용된 코드 제거
    hashedCodes.splice(index, 1);
    await prisma.users.update({
      where: { id: userId },
      data: { two_factor_backup_codes: JSON.stringify(hashedCodes) },
    });
    return true;
  }

  /**
   * SMS 기반 2FA (기존 호환용)
   */
  async sendSmsOtp(userId, purpose = 'LOGIN') {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    if (!user?.phone) throw new AppError('등록된 전화번호가 없습니다.', 400);

    const phone = decryptPhone(user.phone);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.admin_otps.create({
      data: { user_id: userId, otp, purpose, expires_at: expiresAt },
    });

    await sendSms(phone, `[위마켓] 인증번호: ${otp}`);

    return { success: true, dev_otp: IS_DEV ? otp : undefined };
  }

  /**
   * SMS OTP 검증
   */
  async verifySmsOtp(userId, otp, purpose = 'LOGIN') {
    const record = await prisma.admin_otps.findFirst({
      where: {
        user_id: userId,
        otp: String(otp),
        purpose,
        used: false,
        expires_at: { gte: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!record) return false;

    await prisma.admin_otps.update({
      where: { id: record.id },
      data: { used: true, verified: true },
    });
    return true;
  }
}

module.exports = new TwoFactorService();
