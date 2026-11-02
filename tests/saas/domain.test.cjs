const test = require('node:test');
const assert = require('node:assert/strict');
const domain = require('../../config/domain.js');

test('domain config permits the owned SaaS production origins and rejects unrelated deployments', () => {
  assert.equal(domain.isOriginAllowed('https://wemarket-saas.vercel.app'), true);
  assert.equal(domain.isOriginAllowed('https://wemarket-saas-kwpark0047-8227s-projects.vercel.app'), true);
  assert.equal(domain.isOriginAllowed('https://attacker.vercel.app'), false);
  assert.equal(domain.isOriginAllowed('https://wemarket-saas.vercel.app.attacker.example'), false);
});
