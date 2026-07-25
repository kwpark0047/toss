-- phone_otps 테이블: 핸드폰 번호 OTP 인증에 사용
CREATE TABLE IF NOT EXISTS phone_otps (
  id         SERIAL PRIMARY KEY,
  phone      VARCHAR(20) NOT NULL,
  otp        VARCHAR(6)  NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified   BOOLEAN     NOT NULL DEFAULT FALSE,
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps (phone);
