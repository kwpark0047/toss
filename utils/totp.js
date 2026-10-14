const otp = require('otplib');
function verifyTotp(token, secret) {
  if (typeof token !== 'string' || !/^\d{6}$/.test(token) || !secret) return false;
  try {
    return otp.verifySync({ secret, token, epochTolerance: 30 }).valid === true;
  } catch {
    return false;
  }
}
module.exports = { verifyTotp };
