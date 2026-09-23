const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  setupFiles: [...baseConfig.setupFiles, './tests/integration/setupIntegration.js'],
  // Only run integration tests
  testMatch: ['**/tests/integration/**/*.test.js'],
  // drvfs/WSL에서 app.js 모듈 로딩이 매우 느림(>180s). 테스트 타임아웃을 300s(5분)로 연장.
  testTimeout: 300000,
};
