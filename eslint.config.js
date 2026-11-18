import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/', '.idea/']),
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
  {
    rules: {
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
  prettier,
);
