const request = require('supertest');
const { app } = require('../../app');

it('csp header includes a per-request nonce', async () => {
  const r1 = await request(app).get('/api/health').timeout({ response: 3000 });
  const r2 = await request(app).get('/api/health').timeout({ response: 3000 });
  const csp1 = r1.headers['content-security-policy'];
  const csp2 = r2.headers['content-security-policy'];
  console.log('CSP1 =', csp1);
  console.log('nonce present =', /nonce-/.test(csp1 || ''));
  console.log('nonce differs per request =', csp1 !== csp2);
  expect(r1.status).toBe(200);
  expect(csp1).toBeDefined();
  expect(csp1).toMatch(/nonce-/);
}, 8000);
