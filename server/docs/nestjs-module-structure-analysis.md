# NestJS Module Structure Analysis - frutsmart-back

## Overview
This document describes the current module architecture and dependency injection setup for the frutsmart-back NestJS application. The project follows **Hexagonal Architecture** (Ports & Adapters) with clear separation between domain, application, infrastructure, and interface layers.

---

## Current Module Hierarchy

```
AppModule (Root)
├── GlobalModule (@Global) - Provides shared services across all modules
├── ConfigModule - Environment configuration
├── TypeOrmModule - Database connection
├── PinoLoggerModule - Logging infrastructure
├── HealthModule - Health check endpoints
├── UploadModule - File upload feature
├── EvaluationModule - Evaluation management feature
└── AzureBlobModule - Azure Blob Storage integration
```

---

## Module Breakdown

### 1. **AppModule** (`src/app.module.ts`)
**Type:** Root Module  
**Role:** Application entry point, registers global providers and imports all feature modules

**Imports:**
- `ConfigModule` (via `configModuleConfig`)
- `TypeOrmModule` (via `getTypeOrmModule()`)
- `PinoLoggerModule`
- `GlobalModule` ⚠️
- `HealthModule`
- `UploadModule`
- `EvaluationModule`
- `AzureBlobModule`

**Global Providers (APP_*):**
- `APP_GUARD`: `EasyAuthGuard`, `RolesGuard`
- `APP_INTERCEPTOR`: `CorrelationIdInterceptor`, `LoggingInterceptor`, `ClassSerializerInterceptor`
- `APP_FILTER`: `ValidationExceptionFilter`, `AllExceptionsFilter`

---

### 2. **GlobalModule** (`src/modules/global.module.ts`)
**Type:** Global Module (@Global decorator)  
**Role:** Provides shared services that should be available across all modules without explicit import

**Current State:**
```typescript
@Global()
@Module({
  imports: [ConfigModule],
  providers: [ConfigFacade],
  exports: [ConfigFacade],
})
```

**Exports:**
- `ConfigFacade` - Centralized configuration access

**Issues:**
- ⚠️ Currently imports `ConfigModule` locally, but `ConfigModule.forRoot()` is already in `AppModule`
- ⚠️ Previously imported `UploadModule` and `EvaluationModule` (circular dependency - FIXED)

---

### 3. **ConfigFacade** (`src/config/config.facade.ts`)
**Type:** Service (@Injectable)  
**Dependencies:** `ConfigService<AllConfigType, true>` (from @nestjs/config)

**Role:** Type-safe facade over ConfigService to access configuration sections

**Methods:**
- `app`, `azure`, `security` - Section getters
- `requireApp()`, `requireAzure()`, `requireSecurity()` - Fail-fast accessors
- `isProd()`, `isDev()`, `isTest()` - Environment helpers

**Problem:** Needs `ConfigService` injected, which comes from `ConfigModule.forRoot()` in AppModule

---

### 4. **AzureBlobModule** (`src/providers/azure/azure-blob.module.ts`)
**Type:** Provider Module  
**Role:** Encapsulates Azure Blob Storage client and service

**Current State:**
```typescript
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: AZURE_BLOB_SERVICE_CLIENT,
      inject: [azureConfig.KEY, appConfig.KEY],
      useFactory: (azure, app) => createBlobServiceClient(...)
    },
    {
      provide: AzureBlobService,
      inject: [AZURE_BLOB_SERVICE_CLIENT, ConfigFacade],
      useFactory: (bundle, facade) => new AzureBlobService(...)
    }
  ],
  exports: [AzureBlobService, AZURE_BLOB_SERVICE_CLIENT]
})
```

**Dependencies:**
- `azureConfig.KEY` (from ConfigModule)
- `appConfig.KEY` (from ConfigModule)
- `ConfigFacade` (should come from GlobalModule)

**Issue:**
- ⚠️ Needs `ConfigFacade` but can't import `GlobalModule` due to circular dependency
- ⚠️ `ConfigFacade` is not available because GlobalModule wasn't imported in AppModule initially

---

### 5. **UploadModule** (`src/modules/upload/upload.module.ts`)
**Type:** Feature Module  
**Role:** Manages file upload sessions with SAS token generation

**Architecture Layers:**

#### Interface Layer (HTTP)
- **Controller:** `UploadController`
- **DTOs:** Request/Response validation objects
- **Presenters:** Transform use case output to HTTP responses
- **Mappers:** Convert HTTP DTOs to Application DTOs

#### Application Layer (Use Cases)
- **Use Cases:**
  - `CreateUploadSessionUseCase`
  - `CompleteSessionUseCase`
  - `GetSasBatchUseCase`
  - `RefreshSasBatchUseCase`
- **Mappers:** Transform between layers
- **Ports (Interfaces):**
  - `LOGGER` - Logging abstraction
  - `UUID_GENERATOR` - UUID generation
  - `BLOB_STORAGE` - Blob storage operations
  - `TRANSACTION_MANAGER` - Database transactions
  - `UPLOAD_SESSIONS_REPOSITORY` - Data persistence

#### Infrastructure Layer (Adapters)
- **Persistence:**
  - `UploadSessionEntity`, `UploadItemEntity` (TypeORM)
  - `UploadSessionsRepositoryAdapter`
  - `TypeOrmTransactionManager`
  - `UploadSessionOrmMapper`
- **Integrations:**
  - `AzureBlobStorageAdapter` (implements `BLOB_STORAGE` port)
- **Logging:**
  - `PinoLoggerAdapter` (implements `LOGGER` port)
- **Providers:**
  - `UuidGeneratorAdapter` (implements `UUID_GENERATOR` port)

#### Domain Layer
- **Entities:** `UploadSession`, `UploadItem`
- **Value Objects:** `ClientIdentifier`, `FileProperties`, `StorageLocation`
- **Errors:** Domain-specific errors

**Imports:**
- `TypeOrmModule.forFeature([UploadSessionEntity, UploadItemEntity])`
- `AzureBlobModule`

**Port Bindings:**
```typescript
{ provide: UUID_GENERATOR, useClass: UuidGeneratorAdapter }
{ provide: LOGGER, useClass: PinoLoggerAdapter }
{ provide: BLOB_STORAGE, useClass: AzureBlobStorageAdapter }
{ provide: TRANSACTION_MANAGER, useClass: TypeOrmTransactionManager }
{ provide: UPLOAD_SESSIONS_REPOSITORY, useClass: UploadSessionsRepositoryAdapter }
```

---

### 6. **EvaluationModule** (`src/modules/evaluation/evaluation.module.ts`)
**Type:** Feature Module  
**Role:** Manages evaluation workflows with classification steps

**Architecture Layers:**

#### Interface Layer (HTTP)
- **Controller:** `EvaluationController`
- **DTOs:** Request/Response validation
- **Presenters:** Response formatting
- **Mappers:** DTO transformation

#### Application Layer
- **Use Cases:**
  - `CreateEvaluationUseCase`
- **Ports:**
  - `LOGGER`
  - `UUID_GENERATOR`
  - `TRANSACTION_MANAGER`
  - `EVALUATION_REPOSITORY`

#### Infrastructure Layer
- **Persistence:**
  - ORM Entities: `EvaluationEntity`, `ClassificationStepEntity`, `ClassificationResultEntity`, etc.
  - `EvaluationRepositoryAdapter`
  - `TypeOrmTransactionManager`
  - `EvaluationOrmMapper`
- **Logging:**
  - `PinoLoggerAdapter`
- **Providers:**
  - `UuidGeneratorAdapter`

#### Domain Layer
- **Entities:** `Evaluation`, `ClassificationStep`, `ClassificationResult`, etc.
- **Value Objects:** `Geolocation`, `HarvestCriteria`, `Traceability`
- **Errors:** Domain validation errors

**Imports:**
- `TypeOrmModule.forFeature([EvaluationEntity, PhotoEntity, ...])`

**Port Bindings:**
```typescript
{ provide: UUID_GENERATOR, useClass: UuidGeneratorAdapter }
{ provide: LOGGER, useClass: PinoLoggerAdapter }
{ provide: TRANSACTION_MANAGER, useClass: TypeOrmTransactionManager }
{ provide: EVALUATION_REPOSITORY, useClass: EvaluationRepositoryAdapter }
```

---

### 7. **HealthModule** (`src/health/health.module.ts`)
**Type:** Feature Module  
**Role:** Health check endpoints for monitoring

**Components:**
- `HealthController` - `/health` endpoint

---

### 8. **PinoLoggerModule** (`src/common/logging/pino-logger.module.ts`)
**Type:** Infrastructure Module  
**Role:** Provides Pino logger instance globally

---

## Dependency Injection Patterns Used

### 1. **Port-Adapter Pattern (Hexagonal Architecture)**
```typescript
// Application Layer - Port (Interface)
export const LOGGER = Symbol('LOGGER');
export interface Logger {
  log(message: string): void;
}

// Infrastructure Layer - Adapter (Implementation)
@Injectable()
export class PinoLoggerAdapter implements Logger {
  log(message: string) { /* implementation */ }
}

// Module - Binding
{
  provide: LOGGER,
  useClass: PinoLoggerAdapter
}
```

### 2. **Factory Providers**
```typescript
{
  provide: AzureBlobService,
  inject: [AZURE_BLOB_SERVICE_CLIENT, ConfigFacade],
  useFactory: (bundle, facade) => new AzureBlobService(bundle, facade)
}
```

### 3. **Token-based Injection (ConfigModule pattern)**
```typescript
// Config registration
export default registerAs('azure', () => ({ /* config */ }));

// Injection
inject: [azureConfig.KEY]
```

### 4. **Global Module Pattern**
```typescript
@Global()
@Module({
  providers: [ConfigFacade],
  exports: [ConfigFacade]
})
export class GlobalModule {}
```

---

## Current Issues & Circular Dependencies

### Issue #1: ConfigFacade Resolution in AzureBlobModule
**Problem:**
```
UnknownDependenciesException: Nest can't resolve dependencies of the ConfigFacade (?)
```

**Root Cause:**
- `AzureBlobModule` needs `ConfigFacade`
- `ConfigFacade` needs `ConfigService` from `ConfigModule`
- `GlobalModule` provides `ConfigFacade` but must be imported in `AppModule` first
- `GlobalModule` was previously importing feature modules (circular dependency)

**Current Solution Attempt:**
1. Make `GlobalModule` truly global with `@Global()` decorator
2. Import `GlobalModule` in `AppModule` before feature modules
3. `GlobalModule` imports `ConfigModule` locally
4. Remove `ConfigFacade` from `AzureBlobModule` providers (use global one)

### Issue #2: ConfigModule Import Duplication
**Problem:**
- `ConfigModule.forRoot()` in `AppModule`
- `ConfigModule` imported again in `GlobalModule`
- `ConfigModule` imported again in `AzureBlobModule`

**Expected Behavior:**
- `ConfigModule.forRoot()` should only be in `AppModule`
- Other modules can inject `ConfigService` or config tokens directly
- OR use `ConfigModule` import for namespace access (doesn't re-register)

---

## Recommended Architecture

### Option A: Keep GlobalModule Global (Current Approach)
```typescript
// AppModule
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ... }), // Make ConfigModule global
    TypeOrmModule.forRoot(...),
    PinoLoggerModule,
    GlobalModule,          // Registers ConfigFacade globally
    HealthModule,
    UploadModule,
    EvaluationModule,
    AzureBlobModule,
  ],
  // ...
})

// GlobalModule
@Global()
@Module({
  providers: [ConfigFacade],  // ConfigService auto-available if ConfigModule is global
  exports: [ConfigFacade],
})
export class GlobalModule {}

// AzureBlobModule
@Module({
  providers: [
    // ConfigFacade auto-available from GlobalModule
    { provide: AzureBlobService, inject: [AZURE_BLOB_SERVICE_CLIENT, ConfigFacade], ... }
  ],
  // ...
})
```

### Option B: Separate Config Module
Create a dedicated `ConfigFacadeModule`:
```typescript
@Global()
@Module({
  imports: [ConfigModule],
  providers: [ConfigFacade],
  exports: [ConfigFacade],
})
export class ConfigFacadeModule {}
```
Then remove `ConfigFacade` from `GlobalModule` and import `ConfigFacadeModule` in `AppModule`.

### Option C: Remove ConfigFacade from Providers, Use Direct Injection
Instead of factory with `ConfigFacade`, inject config tokens directly:
```typescript
@Injectable()
export class AzureBlobService {
  constructor(
    @Inject(azureConfig.KEY) private azure: AzureConfig,
    @Inject(appConfig.KEY) private app: AppConfig,
  ) {}
}
```

---

## Module Import Rules for NestJS

### 1. **@Global() Modules**
- Registered once in root module
- Exports available everywhere without re-import
- Use for: Config, Logging, Database, Shared Services

### 2. **Feature Modules**
- Import their dependencies explicitly
- Can use global module exports
- Should NOT be imported by global modules (causes circular deps)

### 3. **Provider Modules (like AzureBlobModule)**
- Encapsulate external service clients
- Export service for use in feature modules
- Can be imported by multiple feature modules

### 4. **ConfigModule Pattern**
- Use `.forRoot()` only once in AppModule
- Set `isGlobal: true` to avoid re-importing
- Child modules can inject `ConfigService` or config tokens directly

---

## Token Summary

### Port Tokens (Application Layer)
```typescript
// Upload Module
LOGGER = Symbol('LOGGER')
UUID_GENERATOR = Symbol('UUID_GENERATOR')
BLOB_STORAGE = Symbol('BLOB_STORAGE')
TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER')
UPLOAD_SESSIONS_REPOSITORY = Symbol('UPLOAD_SESSIONS_REPOSITORY')

// Evaluation Module
LOGGER = Symbol('LOGGER')
UUID_GENERATOR = Symbol('UUID_GENERATOR')
TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER')
EVALUATION_REPOSITORY = Symbol('EVALUATION_REPOSITORY')
```

### Mapper Tokens (Application Layer)
```typescript
CREATE_UPLOAD_SESSION_MAPPER = Symbol('CREATE_UPLOAD_SESSION_MAPPER')
COMPLETE_SESSION_MAPPER = Symbol('COMPLETE_SESSION_MAPPER')
GET_SAS_BATCH_MAPPER = Symbol('GET_SAS_BATCH_MAPPER')
REFRESH_SAS_BATCH_MAPPER = Symbol('REFRESH_SAS_BATCH_MAPPER')
CREATE_EVALUATION_MAPPER = Symbol('CREATE_EVALUATION_MAPPER')
```

### Config Tokens
```typescript
azureConfig.KEY  // 'azure'
appConfig.KEY    // 'app'
```

### Custom Provider Tokens
```typescript
AZURE_BLOB_SERVICE_CLIENT = 'AZURE_BLOB_SERVICE_CLIENT'
```

---

## Next Steps for AI Organization Task

1. **Fix ConfigModule setup**: Make it truly global with `isGlobal: true`
2. **Verify GlobalModule**: Should only provide shared cross-cutting concerns
3. **Remove duplicate imports**: ConfigModule shouldn't be imported in multiple places
4. **Test dependency resolution**: Ensure all ports are properly bound
5. **Document provider strategy**: Choose between factory patterns vs constructor injection

---

## File Type Classification

### Modules (`*.module.ts`)
- `app.module.ts` - Root
- `global.module.ts` - Global shared services
- `health.module.ts` - Feature
- `upload.module.ts` - Feature
- `evaluation.module.ts` - Feature
- `azure-blob.module.ts` - Provider
- `pino-logger.module.ts` - Infrastructure

### Services (`*.service.ts`)
- `azure-blob.service.ts` - External integration service
- `transaction.service.ts` - Database transaction service

### Adapters (`*.adapter.ts`)
- `azure-blob-storage.adapter.ts` - Infrastructure adapter
- `pino-logger.adapter.ts` - Infrastructure adapter
- `typeorm-transaction-manager.adapter.ts` - Infrastructure adapter
- `upload-sessions-repository.adapter.ts` - Infrastructure adapter
- `evaluation.repository.adapter.ts` - Infrastructure adapter
- `uuid-generator.adapter.ts` - Infrastructure adapter

### Use Cases (`*.use-case.ts`)
- `create-upload-session.use-case.ts` - Application logic
- `complete-session.use-case.ts` - Application logic
- `get-sas-batch.use-case.ts` - Application logic
- `refresh-sas-batch.use-case.ts` - Application logic
- `create-evaluation.use-case.ts` - Application logic

### Controllers (`*.controller.ts`)
- `health.controller.ts` - HTTP endpoint
- `upload.controller.ts` - HTTP endpoint
- `evaluation.controller.ts` - HTTP endpoint

### Guards, Interceptors, Filters (Global Providers)
- `easy-auth.guard.ts`, `roles.guard.ts` - Authentication/Authorization
- `correlation-id.interceptor.ts`, `logging.interceptor.ts` - Request processing
- `all-exceptions.filter.ts`, `validation-exception.filter.ts` - Error handling
