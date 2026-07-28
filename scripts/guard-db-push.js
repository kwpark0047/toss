#!/usr/bin/env node
/**
 * guard-db-push.js — 운영 환경에서 `prisma db push` 실행을 차단한다. (H-4)
 *
 * `db push` 는 마이그레이션 히스토리를 남기지 않으므로 운영 DB 에 적용되면
 * 스키마 드리프트가 발생하고 롤백 경로가 사라진다.
 * 로컬/CI 개발 DB 에서는 그대로 허용한다.
 *
 * 우회가 꼭 필요한 예외 상황에서는 ALLOW_PROD_DB_PUSH=1 을 명시한다.
 */

const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_URL = process.env.DATABASE_URL || '';

const isProdEnv = NODE_ENV === 'production';
// 운영 DB 를 가리키는 흔한 호스트 패턴 (로컬 개발 DB 오탐 방지)
const looksLikeManagedDb = /supabase\.(co|com)|neon\.tech|rds\.amazonaws\.com|render\.com/i.test(
  DATABASE_URL
);
const isLocalDb = /@(localhost|127\.0\.0\.1|host\.docker\.internal|postgres|db)[:/]/i.test(
  DATABASE_URL
);

const blocked =
  (isProdEnv || (looksLikeManagedDb && !isLocalDb)) && process.env.ALLOW_PROD_DB_PUSH !== '1';

if (blocked) {
  console.error(
    [
      '',
      '  ✖ `prisma db push` 가 차단되었습니다.',
      '',
      `    NODE_ENV = ${NODE_ENV}`,
      `    DATABASE_URL 이 관리형/운영 DB 를 가리킵니다.`,
      '',
      '    운영 스키마 변경은 마이그레이션으로만 수행하세요:',
      '      npm run db:migrate -- --name <변경_설명>   # 로컬에서 마이그레이션 생성',
      '      npm run db:migrate:prod                     # 배포 시 적용',
      '',
      '    자세한 절차: prisma/migrations/README.md',
      '',
    ].join('\n')
  );
  process.exit(1);
}
