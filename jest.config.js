module.exports = {
  maxWorkers: 1,
  testEnvironment: 'node',
  clearMocks: true,
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['./tests/setupAfterEnv.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/frontend/src/test/',
    '/tests/e2e/',
    '/tests/api/',
    '/print-agent/',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/toss-miniapp-examples/',
    '<rootDir>/wemarket-miniapp/',
    '<rootDir>/miniapp/',
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
  // 아래 값은 2026-08-24 실측치 기준으로 설정된 통과 기준선이다.
  // 테스트를 추가할 때마다 새 실측치에 맞춰 **위로만** 조정한다.
  //
  //   측정 명령: npm run test:coverage
  //   2026-08-24 실측 (stmt/branch/func/lines):
  //     routes       6.56 / 12.15 /  4.00 /  6.79
  //     controllers 15.46 / 12.64 / 18.78 / 15.94
  //     services    36.55 / 27.37 / 35.57 / 38.13
  //     middleware  55.30 / 45.57 / 40.00 / 55.77
  //     utils       32.73 / 29.19 / 25.38 / 32.53
  //     repositories 4.97 /  2.06 /  1.84 /  5.55
  //     app         13.80 /  0.00 /  8.12 / 14.41
  //     TOTAL       31.00 / 27.45 / 26.88 / 32.14
  //
  // [2026-08-24 Phase 1] 실측치 기준 래칫 (통과 기준선)
  //   routes        6 / 12 / 4 / 7
  //   controllers  15 / 12 / 18 / 15
  //   services     36 / 27 / 35 / 38
  //   middleware   55 / 45 / 40 / 55
  //   utils        32 / 29 / 25 / 32
  //   repositories  4 /  2 /  1 /  5
  //   app          13 /  0 /  8 / 14
  //   config       62 / 52 / 57 / 62
  //   global       31 / 27 / 26 / 32
  //
  // 주의: 경로별 임계값을 지정하면 해당 경로 파일은 "global" 집계에서 제외된다.
  coverageThreshold: {
    './routes/': { statements: 6, branches: 12, functions: 4, lines: 7 },
    './controllers/': { statements: 15, branches: 12, functions: 18, lines: 15 },
    './services/': { statements: 36, branches: 27, functions: 35, lines: 38 },
    './middleware/': { statements: 55, branches: 45, functions: 40, lines: 55 },
    './utils/': { statements: 32, branches: 29, functions: 25, lines: 32 },
    './repositories/': { statements: 4, branches: 2, functions: 1, lines: 5 },
    './app/': { statements: 13, branches: 0, functions: 8, lines: 14 },
    './config/': { statements: 62, branches: 52, functions: 57, lines: 62 },
    global: { statements: 31, branches: 27, functions: 26, lines: 32 },
  },
};
