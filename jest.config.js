/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: {
    '^@sber-site/sbercraft-nova-kit/(.*)$':
      '<rootDir>/src/shared/vendor/sbercraft-nova-kit/$1',
    '^@sber-site/malachite-kit/(.*)$':
      '<rootDir>/src/shared/vendor/malachite-kit/$1',
    '^@sber-site/malachite-kit$':
      '<rootDir>/src/shared/vendor/malachite-kit/index.tsx',
    '\\.svg$': '<rootDir>/test/assetMock.ts',
    '\\.module\\.css$': '<rootDir>/test/styleMock.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'Node',
          verbatimModuleSyntax: false,
        },
      },
    ],
  },
};
