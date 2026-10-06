const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { loginSchema } = require('../../src/validation/schemas/auth');

test('actual frontend login payload passes server validation for email and phone', () => {
  const requests = [];
  const api = { post: (url, body) => requests.push({ url, body }) };
  const source = fs.readFileSync(require.resolve('../../frontend/src/api/auth.js'), 'utf8')
    .replace(/import api from '\.\/client';/, '')
    .replace('export const authAPI =', 'globalThis.authAPI =');
  const context = { api };
  vm.runInNewContext(source, context);
  for (const identifier of [' user@example.com ', '01012345678', '010-1234-5678']) {
    context.authAPI.login(identifier, 'ExistingPassword!');
    const request = requests.at(-1);
    assert.equal(request.url, '/auth/login');
    const parsed = loginSchema.parse(request.body);
    assert.equal(parsed.identifier, identifier.trim());
    assert.equal(parsed.password, 'ExistingPassword!');
  }
});

test('legacy email login remains supported', () => {
  assert.equal(loginSchema.parse({ email: ' user@example.com ', password: 'password' }).email, 'user@example.com');
});

test('missing or malformed identifiers and empty passwords are rejected', () => {
  for (const body of [
    { password: 'password' },
    { identifier: 'invalid', password: 'password' },
    { identifier: '010-short', password: 'password' },
    { identifier: 'user@example.com', password: '' },
  ]) assert.equal(loginSchema.safeParse(body).success, false);
});
