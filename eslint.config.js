import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import fsd from './eslint/fsd.mjs';

export default defineConfig(
  globalIgnores([
    'dist/',
    '.idea/',
    'actual-design/',
    '.local/',
    '.mock-data/',
    'docs/',
    'test/',
    'src/shared/vendor/',
    '**/*.test.ts',
    '**/__tests__/',
    'jest.config.js',
    'mock-server.mjs',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  prettier,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.ts', 'src/**/__tests__/**'],
    plugins: { fsd },
    rules: { 'fsd/import-boundaries': 'error' },
  },
  {
    rules: {
      'consistent-return': 'error',
      curly: ['error', 'all'],
      'no-void': 'error',
      'no-nested-ternary': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ForOfStatement',
          message:
            'Use array methods or sequential promise operations instead of for…of.',
        },
        {
          selector: 'ForInStatement',
          message:
            'Use Object.keys/values/entries and array methods instead of for…in.',
        },
        {
          selector: 'ForStatement',
          message: 'Use array methods instead of for loops.',
        },
        {
          selector: 'WhileStatement',
          message:
            'Use array methods or asynchronous continuation instead of while loops.',
        },
        {
          selector: 'DoWhileStatement',
          message:
            'Use array methods or asynchronous continuation instead of do…while loops.',
        },
        {
          selector: ':function[generator=true]',
          message:
            'Generators require regenerator-runtime in the target environment.',
        },
      ],
    },
  },
);
