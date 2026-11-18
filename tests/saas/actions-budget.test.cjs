const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const yaml = require('js-yaml');
const minimatch = require('minimatch');
const match = minimatch.minimatch || minimatch;
const read = (name) => yaml.load(fs.readFileSync(`.github/workflows/${name}.yml`, 'utf8'));
const ci = read('ci');
const permits = (patterns, file) =>
  patterns.reduce(
    (included, pattern) =>
      match(file, pattern.replace(/^!/, ''), { dot: true }) ? !pattern.startsWith('!') : included,
    false
  );
test('application CI skips documentation-only edits while retaining runtime, migrations and workflow coverage', () => {
  for (const event of ['push', 'pull_request']) {
    const paths = ci.on[event].paths;
    assert.ok(Array.isArray(paths));
    for (const path of ['README.md', 'docs/guide.md', 'reports/release.json'])
      assert.equal(permits(paths, path), false, path);
    for (const path of [
      'services/NewService.js',
      'frontend/src/index.css',
      'prisma/migrations/new/migration.sql',
      '.github/workflows/ci.yml',
      '.github/actions/setup-playwright/action.yml',
      'package-lock.json',
      '.env.example',
    ])
      assert.equal(permits(paths, path), true, path);
  }
});
test('standalone integration and E2E no longer duplicate scheduled or push/PR jobs', () => {
  for (const name of ['test', 'playwright'])
    assert.deepEqual(Object.keys(read(name).on), ['workflow_dispatch']);
  assert.ok(ci.on.schedule);
});
test('unit coverage runs once and deployment retains all required gates', () => {
  assert.ok(!ci.jobs['lint-and-test'].steps.some((s) => s.run?.includes('test:coverage')));
  assert.ok(ci.jobs['backend-unit-tests'].steps.some((s) => s.run?.includes('test:coverage')));
  for (const job of [
    'backend-unit-tests',
    'financial-postgres-tests',
    'backend-integration-tests',
    'e2e-tests',
    'security-scan',
    'frontend-test',
    'frontend-browser-smoke',
  ])
    assert.ok(ci.jobs.deploy.needs.includes(job));
  assert.match(ci.jobs.deploy.if, /ENABLE_PRODUCTION_DEPLOY == 'true'/);
  assert.match(ci.jobs.deploy.if, /github.ref == 'refs\/heads\/main'/);
  assert.match(ci.jobs.deploy.if, /inputs.job == 'deploy'/);
});
test('one SHA-bound frontend artifact is reused by E2E and optional size/Lighthouse jobs', () => {
  const smoke = ci.jobs['frontend-browser-smoke'];
  const upload = smoke.steps.find(
    (s) => s.uses === 'actions/upload-artifact@v4' && s.with.path === 'frontend/dist'
  );
  assert.ok(upload);
  assert.match(upload.with.name, /github.sha/);
  assert.equal(upload.with['include-hidden-files'], true);
  for (const name of ['e2e-tests', 'bundle-size-check', 'lighthouse-ci']) {
    const job = ci.jobs[name];
    const download = job.steps.find(
      (s) => s.uses === 'actions/download-artifact@v4' && s.with.path === 'frontend/dist'
    );
    assert.ok(download, name);
    assert.equal(download.with.name, upload.with.name);
    assert.ok(!job.steps.some((s) => /npm run (build|cloudflare-build)/.test(s.run || '')), name);
  }
  assert.ok(ci.jobs['e2e-tests'].needs.includes('frontend-browser-smoke'));
  assert.ok(ci.jobs['bundle-size-check'].needs.includes('frontend-browser-smoke'));
});
test('required is the manual default and heavyweight jobs honor explicit selection', () => {
  assert.equal(ci.on.workflow_dispatch.inputs.job.default, 'required');
  for (const name of [
    'print-agent-test',
    'docker-build',
    'trivy-image-scan',
    'bundle-size-check',
    'lighthouse-ci',
  ]) {
    assert.match(ci.jobs[name].if, /inputs.job/);
    assert.ok(!ci.jobs[name].if.includes("inputs.job == 'required'"));
  }
  assert.match(ci.jobs['docker-build'].if, /trivy-image-scan/);
  assert.match(ci.jobs['bundle-size-check'].if, /lighthouse-ci/);
});
test('browser binaries are cached by OS image and lockfile; system dependencies are still installed', () => {
  const action = yaml.load(fs.readFileSync('.github/actions/setup-playwright/action.yml', 'utf8'));
  const steps = action.runs.steps;
  const cache = steps.find((s) => s.uses === 'actions/cache@v4');
  assert.equal(cache.with.path, '~/.cache/ms-playwright');
  assert.match(cache.with.key, /steps.image.outputs.id/);
  assert.match(cache.with.key, /package-lock.json/);
  assert.ok(steps.some((s) => s.run?.includes('install-deps chromium') && !s.if));
  assert.ok(steps.some((s) => s.run?.includes('install chromium') && s.if?.includes('cache-hit')));
  for (const name of ['frontend-browser-smoke', 'e2e-tests'])
    assert.ok(ci.jobs[name].steps.some((s) => s.uses === './.github/actions/setup-playwright'));
});
test('security keeps text/Markdown secret scanning and removes duplicate automatic Semgrep/audit', () => {
  const security = read('security');
  assert.ok(!security.on.schedule);
  assert.equal(permits(security.on.pull_request.paths, 'docs/guide.md'), true);
  for (const name of ['semgrep', 'npm-audit'])
    assert.equal(security.jobs[name].if, "github.event_name == 'workflow_dispatch'");
  assert.equal(security.jobs.trufflehog.if, undefined);
  assert.equal(ci.jobs['security-scan'].if, undefined);
});
test('Docker cache scopes cannot overwrite backend with frontend layers', () => {
  const builds = ci.jobs['docker-build'].steps.filter(
    (s) => s.uses === 'docker/build-push-action@v6'
  );
  assert.match(builds[0].with['cache-to'], /scope=backend/);
  assert.match(builds[1].with['cache-to'], /scope=frontend/);
});
test('Jest restores transforms by job and dependency/config fingerprint, not node_modules', () => {
  for (const name of [
    'backend-unit-tests',
    'backend-regression-tests',
    'backend-integration-tests',
  ]) {
    const cache = ci.jobs[name].steps.find((s) => s.uses === 'actions/cache@v4');
    assert.equal(cache.with.path, '.cache/jest');
    assert.match(cache.with.key, /github.job/);
    assert.match(cache.with.key, /hashFiles/);
    assert.match(cache.with.key, /github.sha/);
    assert.ok(cache.with['restore-keys']);
    assert.ok(!ci.jobs[name].steps.some((s) => s.run?.includes('--no-cache')));
  }
});
