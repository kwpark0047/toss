-- WeMarket: 핸드폰 번호 기반 회원가입 마이그레이션
-- Supabase 대시보드 → SQL Editor에서 실행하세요

-- 1. name, email을 nullable로 변경 (기존 데이터 보존)
ALTER TABLE users ALTER COLUMN name DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- 2. phone, address, profile_step 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_step INTEGER NOT NULL DEFAULT 1;

-- 3. phone unique 인덱스 (null 제외)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_phone"
  ON users(phone)
  WHERE phone IS NOT NULL;
