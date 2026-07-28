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

  test('Render applies pending migrations before generating Prisma Client', () => {
    const renderConfig = fs.readFileSync(path.join(__dirname, '../../../render.yaml'), 'utf8');
    const deployIndex = renderConfig.indexOf('prisma migrate deploy');
    const generateIndex = renderConfig.indexOf('prisma generate');

    expect(deployIndex).toBeGreaterThan(-1);
    expect(generateIndex).toBeGreaterThan(deployIndex);
  });
});
