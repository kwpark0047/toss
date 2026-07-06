import globals from 'globals';
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// eslint-plugin-react 미설치(플랫폼 lockfile로 install 불가) 환경에서
// JSX에서만 참조되는 컴포넌트가 no-unused-vars 오탐되는 문제를 해결하는
// 최소 인라인 플러그인 (react/jsx-uses-vars 동등).
const jsxA11yLocal = {
  rules: {
    'uses-vars': {
      create(context) {
        return {
          JSXOpeningElement(node) {
            let name = node.name;
            while (name && name.type === 'JSXMemberExpression') name = name.object;
            if (name && name.type === 'JSXIdentifier') {
              if (context.sourceCode && context.sourceCode.markVariableAsUsed) {
                context.sourceCode.markVariableAsUsed(name.name, node);
              } else if (context.markVariableAsUsed) {
                context.markVariableAsUsed(name.name);
              }
            }
          },
        };
      },
    },
  },
};

export default [
  {
    ignores: ['dist/', 'dev-dist/', 'node_modules/'],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx': jsxA11yLocal,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'jsx/uses-vars': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    // 서비스 워커 (importScripts/firebase 등 SW 전역)
    files: ['**/*sw.js', 'public/**/*.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, importScripts: 'readonly', firebase: 'readonly' },
    },
  },
  {
    // 빌드/설정 스크립트 (Node 전역: __dirname 등)
    files: ['*.config.js', 'vite.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
