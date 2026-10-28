module.exports = {
  testEnvironment: '<rootDir>/jest-environment.cjs',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@merchi/error-catch$': '<rootDir>/../error-catch-sdk/dist/index.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        isolatedModules: true,
        diagnostics: false,
      },
    ],
    '/error-catch-sdk/dist/.+\\.js$': '<rootDir>/jest-esm-transform.cjs',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
};
