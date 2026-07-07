const request = require('supertest');
const { app } = require('../../app');

/**
 * Notifications API 계약 테스트.
 * 모든 알림 엔드포인트는 authMiddleware로 보호된다(routes/notifications.js).
 * 인증 없는 요청은 401이어야 하며(공개 노출 금지), 경로는 존재해야 한다(404 아님).
 */
describe('Notifications API (인증 보호 계약)', () => {
  const base = '/api/notifications';

  const protectedEndpoints = [
    ['get', `${base}`],
    ['get', `${base}/unread-count`],
    ['post', `${base}/register-token`],
    ['patch', `${base}/read-all`],
    ['patch', `${base}/some-id/read`],
    ['delete', `${base}/clear`],
    ['delete', `${base}/some-id`],
  ];

  test.each(protectedEndpoints)(
    '%s %s → 인증 없으면 401',
    async (method, url) => {
      const res = await request(app)[method](url);
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404); // 경로가 존재해야 함(라우팅 회귀 방지)
    }
  );
});
