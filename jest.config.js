module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  setupFiles: ["./jest.setup.js"],
  transformIgnorePatterns: [
    "/node_modules/(?!(sanitize-html|htmlparser2|dom-serializer|domelementtype|domhandler|entities|domexception|abort-controller|node-fetch|buffer|stream/web|worker_threads)/)"
  ],
  // 커버리지 게이트: 백엔드 핵심 계층 최소 한계 (점진적 상향 목표)
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 40,
      lines: 45,
      statements: 45,
    },
    "./routes/": {
      statements: 50,
    },
    "./controllers/": {
      statements: 50,
    },
    "./services/": {
      statements: 50,
    },
  },
};
