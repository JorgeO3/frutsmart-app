/**
 * Jest Setup for Unit Tests
 *
 * Configuración global para tests unitarios con Jest + SWC
 */

// Enable decorators metadata reflection
import 'reflect-metadata';

// Set test timeout (15 seconds for unit tests)
jest.setTimeout(15_000);

// Suppress console output in tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Global test utilities
global.testContext = {
  now: new Date('2024-01-01T00:00:00.000Z'),
};

// Mock environment variables if needed
process.env.BACKEND_NODE_ENV = 'test';
process.env.BACKEND_LOG_LEVEL = 'silent';

console.log('🧪 Jest unit test setup loaded');
