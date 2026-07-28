module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  setupFiles: ['./jest.setup.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/frontend/src/test/',
    '/tests/e2e/',
    '/tests/api/',
    '/print-agent/',
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!(sanitize-html|htmlparser2|dom-serializer|domelementtype|domhandler|entities|domexception|abort-controller|node-fetch|buffer|stream/web|worker_threads)/)',
  ],

  // ── 커버리지 수집 범위 (M-1) ──────────────────────────────────────────
  // [배경] collectCoverageFrom 이 없으면 Jest 는 "테스트가 require 한 파일"만
  // 계측한다. 그 결과 테스트가 전혀 없는 라우트 계층이 분모에서 통째로 빠져
  // 실제보다 높은 수치가 보고되고, 심지어 "Coverage data for ./routes/ was not
  // found" 로 임계값 검사가 무력화됐다. 아래 설정으로 전 계층을 분모에 포함해
  // 미테스트 파일이 0% 로 정직하게 반영되도록 한다.
  collectCoverageFrom: [
    'routes/**/*.js',
    'controllers/**/*.js',
    'services/**/*.js',
    'repositories/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'config/**/*.js',
    'app/**/*.js',
    '!**/node_modules/**',
    // 진입점/생성물/외부 SDK 래퍼는 단위 테스트 대상이 아니다
    '!utils/i18nTranslations.js',
    '!**/*.d.ts',
    '!**/*.ts',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/', '/scripts/'],

  // ── 커버리지 임계값 (래칫) ────────────────────────────────────────────
  // [운영 규칙] 이 수치는 **절대 내려갈 수 없다**.
  // 아래 값은 2026-07-29 실측치에서 소폭(약 1~3%p) 내린 값이다. CI 를 초록으로
  // 유지하면서, 커버리지를 떨어뜨리는 PR 은 즉시 실패하게 만드는 것이 목적이다.
  // 테스트를 추가할 때마다 새 실측치에 맞춰 **위로만** 조정한다.
  //
  //   측정 명령: npm run test:coverage
  //   측정일 실측 (stmt/branch/func/lines):
  //     routes       6.56 / 12.15 /  4.00 /  6.79
  //     controllers 15.46 / 11.45 / 20.69 / 16.20
  //     services    36.55 / 27.37 / 35.57 / 38.13
  //     middleware  55.30 / 45.57 / 40.00 / 55.77
  //     utils       32.73 / 29.19 / 24.72 / 32.53
  //     repositories 4.97 /  2.06 /  1.84 /  5.55
  //     app         13.80 /  0.00 /  8.12 / 14.41
  //     TOTAL       22.86 / 19.11 / 21.45 / 23.63
  //
  // 주의: 경로별 임계값을 지정하면 해당 경로 파일은 "global" 집계에서 제외된다.
  //       (과거 global 이 13% 로 표시되던 원인) 그래서 경로별로 명시 관리한다.
  coverageThreshold: {
    './routes/': { statements: 6, branches: 10, functions: 3, lines: 6 },
    './controllers/': { statements: 14, branches: 10, functions: 19, lines: 15 },
    './services/': { statements: 35, branches: 26, functions: 34, lines: 36 },
    './middleware/': { statements: 53, branches: 43, functions: 38, lines: 53 },
    './utils/': { statements: 31, branches: 27, functions: 23, lines: 31 },
    './repositories/': { statements: 4, branches: 1, functions: 1, lines: 5 },
    './app/': { statements: 12, branches: 0, functions: 7, lines: 13 },
    './config/': { statements: 60, branches: 50, functions: 55, lines: 60 },
    global: { statements: 20, branches: 17, functions: 19, lines: 21 },
  },

  globalTeardown: './tests/globalTeardown.js',
};
