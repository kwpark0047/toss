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

  test('Render only checks for pending migrations and never applies them during build', () => {
    const renderConfig = fs
      .readFileSync(path.join(__dirname, '../../../render.yaml'), 'utf8')
      .split('\n')
      .find((line) => line.includes('buildCommand:'));
    const checkIndex = renderConfig.indexOf('node scripts/deploy-migrations.cjs --check');
    const generateIndex = renderConfig.indexOf('prisma generate');

    expect(renderConfig).not.toContain('--apply');
    expect(checkIndex).toBeGreaterThan(-1);
    expect(generateIndex).toBeGreaterThan(checkIndex);
  });

  test('migrations are applied only by the approval-gated workflow', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '../../../.github/workflows/db-migrate.yml'),
      'utf8'
    );

    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).toMatch(/environment: \$\{\{ inputs\.target \}\}/);
    expect(workflow).toContain('node scripts/deploy-migrations.cjs --apply');
  });

  test('reports local migrations missing from the database journal', () => {
    const { pendingMigrations } = require('../../../scripts/deploy-migrations.cjs');

    expect(pendingMigrations(['b_two', 'a_one', 'c_three'], ['a_one'])).toEqual([
      'b_two',
      'c_three',
    ]);
    expect(pendingMigrations(['a_one'], ['a_one', 'legacy'])).toEqual([]);
  });
});
