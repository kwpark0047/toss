module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  setupFiles: ["./jest.setup.js"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/frontend/src/test/",
    "/tests/e2e/",
    "/tests/api/",
    "/print-agent/"
  ],
  transformIgnorePatterns: [
    "/node_modules/(?!(sanitize-html|htmlparser2|dom-serializer|domelementtype|domhandler|entities|domexception|abort-controller|node-fetch|buffer|stream/web|worker_threads)/)"
  ],
  // ESM migration: .mjs 파일 변환 지원 (babel-jest 사용)
  // 커버리지 게이지 — 개선 목표 반영 (2025-07 기준)
  // routes + controllers + services 계층 집중 커버, utils는 보조
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 60,
      lines: 65,
      statements: 65,
    },
    "./routes/": {
      statements: 70,
    },
    "./controllers/": {
      statements: 65,
    },
    "./services/": {
      statements: 60,
    },
    "./middleware/": {
      statements: 60,
    },
    "./utils/": {
      statements: 40,
    },
  },
  globalTeardown: './tests/globalTeardown.js',
};
