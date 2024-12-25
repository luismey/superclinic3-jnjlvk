import type { Config } from '@jest/types'; // v29.0.0

/**
 * Jest configuration for the Next.js web application
 * Defines test environment settings, module resolution, coverage reporting,
 * and test matching patterns for frontend testing
 */
const config: Config.InitialOptions = {
  // Use jsdom environment for DOM manipulation testing
  testEnvironment: 'jsdom',

  // Setup file for test environment configuration
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Patterns to ignore when looking for test files
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/out/',
    '<rootDir>/build/',
    '<rootDir>/dist/',
  ],

  // Module name mapping for path aliases and static assets
  moduleNameMapper: {
    // Path aliases matching tsconfig paths
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/store/(.*)$': '<rootDir>/src/store/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/config/(.*)$': '<rootDir>/src/config/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',

    // Static asset mocks
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**/*',
  ],

  // Coverage thresholds to enforce
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Transform configuration for TypeScript and JSX
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: ['next/babel']
    }],
  },

  // Patterns to ignore during transformation
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node',
  ],

  // Test timeout in milliseconds
  testTimeout: 10000,

  // Enable verbose test output
  verbose: true,

  // Test file patterns to match
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],

  // Limit parallel test execution to 50% of available cores
  maxWorkers: '50%',
};

export default config;