const { spawnSync } = require('child_process');

const stagingUrl = process.env.STAGING_DATABASE_URL;
if (!stagingUrl) {
  console.error(
    'STAGING_DATABASE_URL을 설정한 뒤 실행하세요. 운영 DATABASE_URL은 사용하지 않습니다.'
  );
  process.exit(2);
}

const env = {
  ...process.env,
  DATABASE_URL: stagingUrl,
  DIRECT_URL: process.env.STAGING_DIRECT_URL || stagingUrl,
};

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
