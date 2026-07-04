/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    testMatch: [
        '**/tests/unit/**/*.test.js',
        '**/tests/integration/**/*.test.js',
        '**/tests/regression/**/*.test.js',
    ],
    globalSetup:    './tests/globalSetup.js',
    globalTeardown: './tests/globalTeardown.js',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'routes/**/*.js',
        'models/**/*.js',
        'services/**/*.js',
        'utils/**/*.js',
        '!utils/logger.js',
        '!utils/swagger*.js',
    ],
    coverageThreshold: {
        global: { lines: 30, functions: 30 }
    },
    testTimeout: 30000,
    verbose: true,
    // Jest 25 + Node 24: node: 프로토콜 내장 모듈 지원
    resolver: './tests/nodeProtocolResolver.js',
};
