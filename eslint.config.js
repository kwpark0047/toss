const globals = require('globals');
const js = require('@eslint/js');

module.exports = [
  {
    ignores: [
      'node_modules/',
      'frontend/dist/',
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
    files: ['**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
