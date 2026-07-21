const express = require('express');
const helmet = require('helmet');
const request = require('supertest');

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-<%= nonce %>'", "'strict-dynamic'"],
      styleSrc: ["'self'", "'nonce-<%= nonce %>'", "'unsafe-inline'"],
      objectSrc: ["'none'"],
    },
  },
}));
app.get('/ping', (req, res) => res.json({ ok: true, nonce: res.locals.cspNonce }));

it('helmet v8 nonce substitution', async () => {
  const r = await request(app).get('/ping').timeout({ response: 3000 });
  console.log('HEADER =', r.headers['content-security-policy']);
  console.log('locals nonce =', r.body.nonce);
  console.log('substituted =', !/<%=\s*nonce\s*%>/.test(r.headers['content-security-policy'] || ''));
  expect(r.status).toBe(200);
}, 8000);
