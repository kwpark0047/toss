const globals = require('globals');
const js = require('@eslint/js');

module.exports = [
  {
    ignores: [
      'node_modules/',
      // 프론트엔드는 자체 eslint(frontend/eslint.config.js)로 린트 (브라우저 환경)
      'frontend/',
      'public/',
      '*.json',
      'coverage/',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.node,
        ...globals.commonjs,
        ...globals.es2021,
        // 백엔드는 node:crypto를 require로 명시 사용 → 전역 crypto(Web Crypto)와
        // 이름 충돌(no-redeclare) 오탐 방지 위해 전역 crypto 비활성화
        crypto: 'off',
      },
    },
    rules: {
      ...js.configs.recommended.rules,

      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-empty': ['error', { allowEmptyCatch: true }],

      'handle-callback-err': 'off',
      'no-undef': 'error',
      'no-prototype-builtins': 'off',

      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'multi-line'],
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'off',

      'require-atomic-updates': 'off',
    },
  },
  {
    // 유닛/통합 테스트 (Jest, Node 환경). node:crypto를 require로 사용.
    files: ['**/*.test.js', 'tests/unit/**/*.js', 'tests/integration/**/*.js', 'tests/scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        crypto: 'off',
      },
    },
  },
  {
    // e2e 테스트 (Playwright). test/expect는 @playwright/test에서 import하며,
    // page.evaluate 콜백은 브라우저 컨텍스트라 브라우저 전역이 필요하다.
    files: ['**/*.spec.js', 'tests/e2e/**/*.js', 'kitchen_test_runner.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
