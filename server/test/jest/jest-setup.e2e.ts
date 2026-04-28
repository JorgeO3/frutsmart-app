// Setup para tests E2E con Jest
import 'reflect-metadata';

// Configuración de entorno para E2E
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Timeouts más largos para E2E (levantar servidor, DB, etc.)
jest.setTimeout(60000); // 60 segundos

console.log('🧪 Jest E2E test setup loaded');

// Nota: Cierra app/DB en afterAll en tus tests o aquí si usas un bootstrap común
