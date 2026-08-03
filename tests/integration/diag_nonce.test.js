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
  // /api/health는 DB 연결 여부에 따라 200/503을 반환할 수 있다(테스트는 dummy DB).
  // 본 테스트의 목적은 DB 가용성이 아닌 CSP nonce 검증이므로 상태 코드를 고정하지 않는다.
  expect([200, 503]).toContain(r1.status);
  expect(csp1).toBeDefined();
  expect(csp1).toMatch(/nonce-/);
  expect(csp2).toBeDefined();
  expect(csp2).toMatch(/nonce-/);
  expect(csp1).not.toBe(csp2);
}, 8000);
