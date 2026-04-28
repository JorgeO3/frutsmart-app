// Setup para tests de integración con Jest
import 'reflect-metadata';

// Silenciar logs en test
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Timeouts razonables para integración (DB, Azure, etc.)
jest.setTimeout(30000); // 30 segundos

console.log('🧪 Jest integration test setup loaded');
