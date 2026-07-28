/**
 * config/domain — CORS 오리진 판정 테스트 (C-3 회귀 방지)
 *
 * 과거 규칙은 `origin.endsWith('.pages.dev' | '.workers.dev' | '.vercel.app')`
 * 였다. 누구나 무료 배포 가능한 플랫폼이므로 `evil.pages.dev` 가 통과했고,
 * credentials:true 와 결합되어 세션 탈취 경로가 되었다.
 */

describe('config/domain — isOriginAllowed', () => {
  const ORIGINAL_ENV = { ...process.env };

  function loadDomain(env = {}) {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, ...env };
    return require('../../../config/domain');
  }

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  describe('와일드카드 플랫폼 도메인 차단', () => {
    test.each([
      'https://evil.pages.dev',
      'https://attacker.workers.dev',
      'https://phishing.vercel.app',
      'https://wemarket-fake.vercel.app',
      'https://not-ours.pages.dev',
    ])('%s 는 차단된다', (origin) => {
      const { isOriginAllowed } = loadDomain({ NODE_ENV: 'production' });
      expect(isOriginAllowed(origin)).toBe(false);
    });
  });

  describe('화이트리스트 정확 일치', () => {
    test('등록된 오리진은 허용된다', () => {
      const { isOriginAllowed } = loadDomain({ NODE_ENV: 'production' });
      expect(isOriginAllowed('https://wemarket-6k6.pages.dev')).toBe(true);
      expect(isOriginAllowed('https://250105.kangwonpark71.workers.dev')).toBe(true);
    });

    test('CORS_ORIGIN 으로 추가한 도메인은 허용된다', () => {
      const { isOriginAllowed } = loadDomain({
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.example.com, https://admin.example.com',
      });
      expect(isOriginAllowed('https://app.example.com')).toBe(true);
      expect(isOriginAllowed('https://admin.example.com')).toBe(true);
      expect(isOriginAllowed('https://other.example.com')).toBe(false);
    });
  });

  describe('소유 프로젝트의 프리뷰 하위 도메인만 허용', () => {
    test('Cloudflare Pages 프리뷰(<hash>.<project>.pages.dev)는 허용', () => {
      const { isOriginAllowed } = loadDomain({ NODE_ENV: 'production' });
      expect(isOriginAllowed('https://abc123.wemarket-6k6.pages.dev')).toBe(true);
    });

    test('Workers 프리뷰 하위 도메인은 허용', () => {
      const { isOriginAllowed } = loadDomain({ NODE_ENV: 'production' });
      expect(isOriginAllowed('https://v2.250105.kangwonpark71.workers.dev')).toBe(true);
    });

    test('suffix 를 흉내낸 도메인은 차단 (접미사 매칭 우회 방지)', () => {
      const { isOriginAllowed } = loadDomain({ NODE_ENV: 'production' });
      // "wemarket-6k6.pages.dev" 로 끝나지만 별개 등록 도메인인 경우
      expect(isOriginAllowed('https://evilwemarket-6k6.pages.dev')).toBe(false);
      expect(isOriginAllowed('https://wemarket-6k6.pages.dev.evil.com')).toBe(false);
    });

    test('CORS_PREVIEW_SUFFIXES 로 지정한 호스트의 하위 도메인은 허용', () => {
      const { isOriginAllowed } = loadDomain({
        NODE_ENV: 'production',
        CORS_PREVIEW_SUFFIXES: 'preview.example.com',
      });
      expect(isOriginAllowed('https://pr-12.preview.example.com')).toBe(true);
      expect(isOriginAllowed('https://pr-12.other.example.com')).toBe(false);
    });
  });

  describe('프로토콜/형식 검증', () => {
    test('Origin 이 없으면(서버 간 호출) 허용', () => {
      const { isOriginAllowed } = loadDomain({ NODE_ENV: 'production' });
      expect(isOriginAllowed(undefined)).toBe(true);
      expect(isOriginAllowed('')).toBe(true);
    });

    test('http 프리뷰는 차단 (다운그레이드 방지)', () => {
      const { isOriginAllowed } = loadDomain({ NODE_ENV: 'production' });
      expect(isOriginAllowed('http://abc.wemarket-6k6.pages.dev')).toBe(false);
    });

    test('파싱 불가한 Origin 은 차단', () => {
      const { isOriginAllowed } = loadDomain({ NODE_ENV: 'production' });
      expect(isOriginAllowed('not-a-url')).toBe(false);
      expect(isOriginAllowed('null')).toBe(false);
    });
  });

  describe('개발 환경', () => {
    test('localhost 는 개발 환경에서만 허용', () => {
      const dev = loadDomain({ NODE_ENV: 'development' });
      expect(dev.isOriginAllowed('http://localhost:5173')).toBe(true);

      const prod = loadDomain({ NODE_ENV: 'production' });
      expect(prod.isOriginAllowed('http://localhost:5173')).toBe(false);
    });
  });
});
