/**
 * Jest configuration for frutsmart-plant
 * Uses @swc/jest for fast TypeScript transformation
 */

const path = require("path");

module.exports = {
  rootDir: path.resolve(__dirname),
  testEnvironment: "node",
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          target: "es2022",
          parser: {
            syntax: "typescript",
            tsx: true,
            decorators: true,
            dynamicImport: true,
          },
          transform: {
            react: {
              runtime: "automatic",
            },
          },
        },
      },
    ],
  },
  transformIgnorePatterns: [
    "node_modules/(?!((react-native.*)|(expo.*)|(@expo.*)|(@react-native.*)|(@react-navigation.*)|(zustand)))/",
  ],
  moduleNameMapper: {
    "^@src/(.*)$": "<rootDir>/src/$1",
    "^@services/(.*)$": "<rootDir>/src/services/$1",
    "^@adapters/(.*)$": "<rootDir>/src/adapters/$1",
    "^@components/(.*)$": "<rootDir>/src/components/$1",
    "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@stores/(.*)$": "<rootDir>/src/stores/$1",
    "^skybolt$": "<rootDir>/../../packages/skybolt/src/index.tsx",
    "expo-constants": "<rootDir>/__mocks__/expo-constants.js",
    "expo-file-system/legacy": "<rootDir>/__mocks__/expo-file-system.js",
  },
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  clearMocks: true,
  restoreMocks: true,
};
