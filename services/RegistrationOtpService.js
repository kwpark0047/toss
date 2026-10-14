const crypto = require('crypto');
const { Buffer: NodeBuffer } = require('node:buffer');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const { sendSms } = require('../utils/smsService');
const { OTP_EXPIRY_MS } = require('../config/authConstants');
class RegistrationOtpService {
  constructor(db = prisma, send = sendSms, env = process.env) {
    this.db = db;
    this.sendSms = send;
    this.env = env;
  }
  digest(phone, code) {
    if (!this.env.JWT_SECRET) throw new AppError('인증 서비스 설정을 확인해 주세요.', 503);
    return crypto
      .createHmac('sha256', this.env.JWT_SECRET)
      .update(`signup:${phone}:${code}`)
      .digest('hex');
  }
  async lock(tx, phone) {
    await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `signup:${phone}`);
  }
  async send(phone) {
    const result = await this.db.$transaction(async (tx) => {
      await this.lock(tx, phone);
      const latest = await tx.phone_otps.findFirst({
        where: { phone },
        orderBy: { created_at: 'desc' },
      });
      if (latest && Date.now() - new Date(latest.created_at).getTime() < 60000)
        throw new AppError('인증번호는 1분 뒤 다시 요청해 주세요.', 429);
      const code = String(crypto.randomInt(100000, 1000000)),
        digest = this.digest(phone, code);
      const sent = await this.sendSms(phone, `[위마켓] 인증번호: ${code}`);
      if (this.env.NODE_ENV === 'production' && sent?.sent !== true)
        throw new AppError(
          '인증 문자를 발송하지 못했습니다. 관리자에게 SMS 공급자·발신번호 설정 확인을 요청해 주세요.',
          503
        );
      await tx.phone_otps.updateMany({ where: { phone, used: false }, data: { used: true } });
      await tx.phone_otps.create({
        data: { phone, otp: `v1:0:${digest}`, expires_at: new Date(Date.now() + OTP_EXPIRY_MS) },
      });
      return code;
    });
    return this.env.NODE_ENV === 'production'
      ? { message: '인증번호가 발송되었습니다.' }
      : { message: '개발용 인증번호가 생성되었습니다.', dev_otp: result };
  }
  async verify(phone, code) {
    const outcome = await this.db.$transaction(async (tx) => {
      await this.lock(tx, phone);
      const record = await tx.phone_otps.findFirst({
        where: { phone, used: false, verified: false },
        orderBy: { created_at: 'desc' },
      });
      if (!record || new Date(record.expires_at) <= new Date())
        return '인증번호가 만료되었거나 없습니다. 다시 요청해 주세요.';
      const [version, attempts, digest] = record.otp.split(':');
      if (version !== 'v1' || !/^\d$/.test(attempts) || !digest || Number(attempts) >= 5)
        return '인증번호를 다시 요청해 주세요.';
      const expected = this.digest(phone, code);
      if (
        digest.length !== expected.length ||
        !crypto.timingSafeEqual(NodeBuffer.from(digest), NodeBuffer.from(expected))
      ) {
        const count = Number(attempts) + 1;
        await tx.phone_otps.update({
          where: { id: record.id },
          data: { otp: `v1:${count}:${digest}`, used: count >= 5 },
        });
        return count >= 5
          ? '인증 시도 횟수를 초과했습니다. 다시 요청해 주세요.'
          : '인증번호가 일치하지 않습니다.';
      }
      await tx.phone_otps.update({ where: { id: record.id }, data: { verified: true } });
      return record.id;
    });
    if (typeof outcome === 'string') throw new AppError(outcome, 400);
    return {
      verified: true,
      phone,
      verificationToken: jwt.sign(
        { purpose: 'registration', otp_id: outcome },
        this.env.JWT_SECRET,
        { algorithm: 'HS256', audience: 'wemarket-signup', expiresIn: '5m' }
      ),
    };
  }
  async createUser(phone, candidates, data, verificationToken) {
    let proof;
    try {
      proof = jwt.verify(verificationToken, this.env.JWT_SECRET, {
        algorithms: ['HS256'],
        audience: 'wemarket-signup',
      });
    } catch {
      throw new AppError(
        '가입 인증이 만료되었거나 올바르지 않습니다. 인증번호를 다시 요청해 주세요.',
        400
      );
    }
    if (proof.purpose !== 'registration' || !Number.isInteger(proof.otp_id))
      throw new AppError('가입 인증이 올바르지 않습니다.', 400);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, phone);
      if (await tx.users.findFirst({ where: { phone: { in: candidates } } }))
        throw new AppError('이미 가입된 핸드폰 번호입니다.', 409);
      const record = await tx.phone_otps.findFirst({
        where: { phone, verified: true, used: false, expires_at: { gt: new Date() } },
        orderBy: { created_at: 'desc' },
      });
      // Production never accepts BYPASS_OTP or legacy plaintext challenges.
      if (!record || record.id !== proof.otp_id || !record.otp.startsWith('v1:'))
        throw new AppError('핸드폰 번호 인증이 필요합니다. 인증번호를 다시 요청해 주세요.', 400);
      const user = await tx.users.create({ data });
      await tx.phone_otps.update({ where: { id: record.id }, data: { used: true } });
      return user;
    });
  }
}
module.exports = RegistrationOtpService;
