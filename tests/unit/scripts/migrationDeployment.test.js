const fs = require('fs');
const path = require('path');

describe('production migration deployment', () => {
  test('repairs the missing 2FA column idempotently', () => {
    const migration = fs.readFileSync(
      path.join(
        __dirname,
        '../../../prisma/migrations/20260729000000_add_users_two_factor_enabled/migration.sql'
      ),
      'utf8'
    );

    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "two_factor_enabled"/);
    expect(migration).toMatch(/BOOLEAN NOT NULL DEFAULT false/);
  });

  test('Render build generates Prisma Client without applying database migrations', () => {
    const renderConfig = fs
      .readFileSync(path.join(__dirname, '../../../render.yaml'), 'utf8')
      .split('\n')
      .find((line) => line.includes('buildCommand:'));
    const generateIndex = renderConfig.indexOf('prisma generate');

    expect(renderConfig).toMatch(/npm ci --include=dev/);
    expect(generateIndex).toBeGreaterThan(-1);
    expect(renderConfig).not.toMatch(/migrate|--apply/i);
    expect(require('../../../package.json').scripts['db:migrate:prod']).toBe(
      'node scripts/deploy-migrations.cjs --apply'
    );
  });
});

