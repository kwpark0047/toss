/**
 * ssrfGuard 단위 테스트 — 웹훅 URL SSRF 방어
 * 프로덕션 모드에서 내부(사설/loopback/링크로컬/메타데이터) 주소를 차단하는지 검증.
 */
const { isPrivateAddress } = require('../../utils/ssrfGuard');

describe('isPrivateAddress', () => {
  test.each([
    ['127.0.0.1', true],   // loopback
    ['10.0.0.5', true],    // 사설 10/8
    ['172.16.0.1', true],  // 사설 172.16/12
    ['172.31.255.255', true],
    ['192.168.1.1', true], // 사설 192.168/16
    ['169.254.169.254', true], // 클라우드 메타데이터(링크로컬)
    ['0.0.0.0', true],
    ['100.64.0.1', true],  // CGNAT
    ['::1', true],         // IPv6 loopback
    ['fd00::1', true],     // IPv6 ULA
    ['fe80::1', true],     // IPv6 링크로컬
    ['8.8.8.8', false],    // 공인 (구글 DNS)
    ['1.1.1.1', false],    // 공인 (클라우드플레어)
    ['172.15.0.1', false], // 172.15는 사설 아님
    ['172.32.0.1', false], // 172.32는 사설 아님
  ])('%s → private=%s', (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });
});

describe('validateWebhookUrl (production)', () => {
  const OLD_ENV = process.env.NODE_ENV;
  beforeAll(() => { process.env.NODE_ENV = 'production'; });
  afterAll(() => { process.env.NODE_ENV = OLD_ENV; });

  // 모듈이 isProd를 런타임 평가하므로 require를 여기서
  const { validateWebhookUrl } = require('../../utils/ssrfGuard');

  test('http는 프로덕션에서 거부', async () => {
    const r = await validateWebhookUrl('http://example.com/hook');
    expect(r.ok).toBe(false);
  });
  test('메타데이터 IP 차단', async () => {
    const r = await validateWebhookUrl('https://169.254.169.254/latest/meta-data');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/내부/);
  });
  test('loopback IP 차단', async () => {
    const r = await validateWebhookUrl('https://127.0.0.1/x');
    expect(r.ok).toBe(false);
  });
  test('사설 IP 차단', async () => {
    const r = await validateWebhookUrl('https://192.168.0.1/x');
    expect(r.ok).toBe(false);
  });
  test('잘못된 URL 거부', async () => {
    const r = await validateWebhookUrl('not-a-url');
    expect(r.ok).toBe(false);
  });
});
