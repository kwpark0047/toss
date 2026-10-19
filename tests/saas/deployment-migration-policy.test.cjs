const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Render builds never apply database migrations automatically', () => {
  const blueprint = fs.readFileSync('render.yaml', 'utf8');
  const buildCommand = blueprint.match(/^\s*buildCommand:\s*(.+)$/m)?.[1] || '';
  assert.match(buildCommand, /npm ci --include=dev/);
  assert.match(buildCommand, /prisma generate/);
  assert.doesNotMatch(buildCommand, /migrate|--apply/i);
  assert.match(blueprint, /^\s*autoDeploy:\s*false\s*$/m);
});

test('production migration apply stays an explicit operator command with a dry-run companion', () => {
  const scripts = require('../../package.json').scripts;
  assert.equal(scripts['db:migrate:plan'], 'node scripts/deploy-migrations.cjs');
  assert.equal(scripts['db:migrate:prod'], 'node scripts/deploy-migrations.cjs --apply');
  const migrationTool = fs.readFileSync('scripts/deploy-migrations.cjs', 'utf8');
  assert.match(migrationTool, /if\(!process\.argv\.includes\('--apply'\)\)/);
});

