const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const deploy = workflow.slice(workflow.indexOf('\n  deploy:'), workflow.indexOf('\n  # Docker build'));

test('production deploy uses the checked-out repository root and a pinned CLI', () => {
  assert.doesNotMatch(deploy, /cd frontend\s*&&.*vercel/);
  assert.match(deploy, /vercel@64\.0\.2 deploy/);
  assert.match(deploy, /--meta githubCommitSha="\$GITHUB_SHA"/);
});

test('Render hook pins the exact tested commit and has bounded transport', () => {
  assert.match(deploy, /--data-urlencode "ref=\$GITHUB_SHA"/);
  assert.match(deploy, /--max-time 60/);
  assert.doesNotMatch(deploy, /--retry\b/);
});
