const nodemailer = require('nodemailer');
const { AppError } = require('../utils/errorHandler');
const { frontendOrigin, normalizeEmail } = require('../utils/freeAuthPolicy');
class AuthMailService {
  constructor(env = process.env, create = nodemailer.createTransport) {
    this.env = env;
    this.create = create;
  }
  configured() {
    return !!(
      this.env.SMTP_HOST &&
      this.env.SMTP_USER &&
      this.env.SMTP_PASSWORD &&
      (this.env.MAIL_FROM || this.env.SMTP_FROM)
    );
  }
  async send({ email, code, id, token }) {
    if (!this.configured()) throw new AppError('이메일 발송 설정이 필요합니다.', 503);
    const from = normalizeEmail(this.env.MAIL_FROM || this.env.SMTP_FROM),
      to = normalizeEmail(email),
      port = Number(this.env.SMTP_PORT || 587);
    if (![465, 587, 2525].includes(port))
      throw new AppError('SMTP 포트 설정을 확인해 주세요.', 503);
    const transport = this.create({
      host: this.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: this.env.SMTP_USER, pass: this.env.SMTP_PASSWORD },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
      tls: { rejectUnauthorized: true },
      disableFileAccess: true,
      disableUrlAccess: true,
      logger: false,
      debug: false,
    });
    const link = `${frontendOrigin(this.env)}/auth/free/email#challenge=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
    try {
      const result = await transport.sendMail({
        from,
        to,
        subject: '[위마켓] 이메일 인증',
        messageId: `<${id}@${from.split('@')[1]}>`,
        text: `인증번호: ${code}\n5분 안에 입력해 주세요.\n\n같은 브라우저에서 아래 링크를 열어 인증할 수도 있습니다.\n${link}\n\n이 링크는 10분 동안 유효합니다. 요청하지 않았다면 무시해 주세요.`,
        headers: { 'X-Entity-Ref-ID': id },
      });
      if (!result.accepted?.some((x) => String(x).toLowerCase() === to) || result.rejected?.length)
        throw new AppError('이메일 공급자가 요청을 접수하지 못했습니다.', 503);
      return { accepted: true, delivered: false };
    } finally {
      transport.close?.();
    }
  }
}
module.exports = { AuthMailService };
