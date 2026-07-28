/**
 * scripts/guard-db-push.js 테스트 (H-4)
 *
 * 운영 DB 에 `prisma db push` 가 적용되면 마이그레이션 히스토리 없이
 * 스키마가 바뀌어 드리프트/롤백 불가 상태가 된다. 가드가 확실히 막는지 검증한다.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const GUARD = path.resolve(__dirname, '../../../scripts/guard-db-push.js');

/** 가드를 별도 프로세스로 실행하고 종료 코드를 반환한다 */
function runGuard(env) {
  try {
    execFileSync(process.execPath, [GUARD], {
      env: { ...process.env, ...env },
      stdio: 'pipe',
    });
    return 0;
  } catch (e) {
    return e.status ?? 1;
  }
}

describe('guard-db-push', () => {
  describe('허용되어야 하는 경우', () => {
    test('개발 환경 + localhost DB', () => {
      expect(
        runGuard({
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://u:p@localhost:5432/dev',
          ALLOW_PROD_DB_PUSH: '',
        })
      ).toBe(0);
    });

    test('개발 환경 + docker 서비스명 DB', () => {
      expect(
        runGuard({
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://u:p@postgres:5432/wemarket_test',
          ALLOW_PROD_DB_PUSH: '',
        })
      ).toBe(0);
    });

    test('명시적 우회 플래그가 있으면 운영에서도 허용', () => {
      expect(
        runGuard({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://u:p@db.abc.supabase.co:5432/postgres',
          ALLOW_PROD_DB_PUSH: '1',
        })
      ).toBe(0);
    });
  });

  describe('차단되어야 하는 경우', () => {
    test('NODE_ENV=production', () => {
      expect(
        runGuard({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://u:p@localhost:5432/dev',
          ALLOW_PROD_DB_PUSH: '',
        })
      ).toBe(1);
    });

    test('Supabase 호스트', () => {
      expect(
        runGuard({
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://u:p@db.abc.supabase.co:5432/postgres',
          ALLOW_PROD_DB_PUSH: '',
        })
      ).toBe(1);
    });

    test('AWS RDS 호스트', () => {
      expect(
        runGuard({
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://u:p@x.abc.ap-northeast-2.rds.amazonaws.com:5432/db',
          ALLOW_PROD_DB_PUSH: '',
        })
      ).toBe(1);
    });

    test('Neon 호스트', () => {
      expect(
        runGuard({
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://u:p@ep-x.ap-southeast-1.aws.neon.tech/db',
          ALLOW_PROD_DB_PUSH: '',
        })
      ).toBe(1);
    });
  });
});
