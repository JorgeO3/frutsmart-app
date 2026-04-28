# Upload Module - HTTP Layer Implementation

## ✅ Implementación Completada

### 📂 Estructura Implementada

```
src/modules/upload/interface/http/
├── controllers/
│   └── upload.controller.ts          ✅ IMPLEMENTADO
├── dto/
│   ├── requests/
│   │   ├── complete-session.dto.ts
│   │   ├── create-upload-session.dto.ts
│   │   ├── refresh-sas-batch.dto.ts  ✅ NUEVO
│   │   ├── refresh-sas.dto.ts
│   │   ├── sas-batch.dto.ts
│   │   └── shared-types.ts
│   └── responses/
│       ├── complete-session.response.ts
│       ├── create-upload-session.response.ts
│       ├── refresh-sas.response.ts    ✅ ACTUALIZADO
│       ├── sas-batch.response.ts
│       └── shared-response-types.ts
├── mappers/
│   ├── complete-session.mapper.ts         ✅ IMPLEMENTADO
│   ├── create-upload-session.mapper.ts    ✅ IMPLEMENTADO
│   ├── get-sas-batch.mapper.ts            ✅ IMPLEMENTADO
│   └── refresh-sas-batch.mapper.ts        ✅ IMPLEMENTADO
└── presenters/
    ├── complete-session.presenter.ts         ✅ IMPLEMENTADO
    ├── create-upload-session.presenter.ts    ✅ IMPLEMENTADO
    ├── get-sas-batch.presenter.ts            ✅ IMPLEMENTADO
    └── refresh-sas-batch.presenter.ts        ✅ IMPLEMENTADO
```

---

## 🎯 Componentes Implementados

### 1️⃣ **HTTP Mappers** (Request DTO → Use Case Input)
Transforman desde `HTTP DTO` → `Application Input`

#### ✅ `CreateUploadSessionHttpMapper`
- **Input**: `CreateUploadSessionDto`
- **Output**: `CreateUploadSessionInput`
- **Función**: Extrae datos del DTO HTTP y construye el input del use case

#### ✅ `GetSasBatchHttpMapper`
- **Input**: `sessionId: string`, `SasBatchRequestDto`
- **Output**: `GetSasBatchInput`
- **Función**: Combina parámetro de ruta con body, mapea `blobName` → `objectKey`

#### ✅ `RefreshSasBatchHttpMapper`
- **Input**: `sessionId: string`, `RefreshSasBatchDto`
- **Output**: `RefreshSasBatchInput`
- **Función**: Mapea batch de refresh con sessionId

#### ✅ `CompleteSessionHttpMapper`
- **Input**: `sessionId: string`, `CompleteSessionDto`
- **Output**: `CompleteSessionInput`
- **Función**: Aplica defaults (verifyAndPromote, failOnIncomplete), mapea arrays opcionales

---

### 2️⃣ **Presenters** (Use Case Output → HTTP Response)
Transforman desde `Application Output` → `HTTP Response`

#### ✅ `CreateUploadSessionPresenter`
- **Input**: `CreateUploadSessionOutput`
- **Output**: `CreateUploadSessionResponse`
- **Función**: Serializa `Date` → ISO string, mantiene estructura de sesión y items

#### ✅ `CompleteSessionPresenter`
- **Input**: `CompleteSessionOutput`
- **Output**: `CompleteSessionResponse`
- **Función**: Mapea resultados de procesamiento, summary y errores

#### ✅ `GetSasBatchPresenter`
- **Input**: `GetSasBatchOutput`
- **Output**: `SasBatchResponse`
- **Función**: Transforma signed URLs, serializa `expiresOn` Date

#### ✅ `RefreshSasBatchPresenter`
- **Input**: `RefreshSasBatchOutput`
- **Output**: `RefreshSasBatchResponse`
- **Función**: Similar a GetSasBatch, maneja refresh de tokens

---

### 3️⃣ **Controller** (`UploadController`)
Endpoints REST con validación y documentación OpenAPI.

**Responsabilidades del Controller:**
- ✅ Validación de DTOs (delegada a class-validator)
- ✅ Extracción de parámetros de ruta
- ✅ Delegación a mappers HTTP
- ✅ Ejecución de use cases
- ✅ Delegación a presenters
- ✅ Manejo de guards y decoradores OpenAPI
- ❌ **NO contiene lógica de negocio**
- ❌ **NO construye inputs manualmente**

#### 📌 **Endpoints Implementados:**

1. **`POST /api/upload/sessions`**
   - Crea nueva sesión de upload
   - DTO: `CreateUploadSessionDto`
   - Response: `CreateUploadSessionResponse`

2. **`POST /api/upload/sessions/:sessionId/sas-batch`**
   - Genera SAS tokens para batch
   - DTO: `SasBatchRequestDto`
   - Response: `SasBatchResponse`

3. **`POST /api/upload/sessions/:sessionId/sas/refresh`**
   - Refresca SAS tokens expirados
   - DTO: `RefreshSasBatchDto` ✅ NUEVO
   - Response: `RefreshSasBatchResponse`

4. **`POST /api/upload/sessions/:sessionId/complete`**
   - Completa sesión con verificación opcional
   - DTO: `CompleteSessionDto`
   - Response: `CompleteSessionResponse`

#### 🔒 **Seguridad:**
- `@UseGuards(ApiKeyGuard)` - Requiere API key válida
- `@ApiBearerAuth()` - Documentado en Swagger
- Validación completa de DTOs con `class-validator`

#### 📝 **Documentación OpenAPI:**
- `@ApiTags('upload')`
- `@ApiOperation` con descripción en cada endpoint
- `@ApiCreatedResponse`, `@ApiOkResponse`
- `@ApiBadRequestResponse`, `@ApiNotFoundResponse`

---

### 3️⃣ **Module** (`UploadModule`)
Registra todos los providers necesarios.

#### ✅ **Providers Registrados:**

**HTTP Mappers (DTO → Input):**
- `CreateUploadSessionHttpMapper` ✨
- `GetSasBatchHttpMapper` ✨
- `RefreshSasBatchHttpMapper` ✨
- `CompleteSessionHttpMapper` ✨

**Presenters (Output → Response):**
- `CreateUploadSessionPresenter`
- `CompleteSessionPresenter`
- `GetSasBatchPresenter`
- `RefreshSasBatchPresenter`

**Use Cases:**
- `CreateUploadSessionUseCase`
- `CompleteSessionUseCase`
- `GetSasBatchUseCase`
- `RefreshSasBatchUseCase`

**Application Mappers:**
- `CreateUploadSessionMapper`
- `CompleteSessionMapper`
- `GetSasBatchMapper`
- `RefreshSasBatchMapper`

**Port Implementations (Adapters):**
- `UUID_GENERATOR` → uuid v4
- `LOGGER` → Pino logger wrapper
- `BLOB_STORAGE` → `AzureBlobStorageAdapter`
- `TRANSACTION_MANAGER` → TypeORM transaction wrapper
- `UPLOAD_SESSIONS_REPOSITORY` → TypeORM repository adapter (temporal)

#### 📦 **Imports:**
- `TypeOrmModule.forFeature([UploadSessionEntity, UploadItemEntity])`
- `LoggerModule` (Pino)
- `AzureBlobModule`

---

## 📋 Cambios Realizados

### ✅ Archivos Creados:
1. `src/modules/upload/interface/http/presenters/create-upload-session.presenter.ts`
2. `src/modules/upload/interface/http/presenters/complete-session.presenter.ts`
3. `src/modules/upload/interface/http/presenters/get-sas-batch.presenter.ts`
4. `src/modules/upload/interface/http/presenters/refresh-sas-batch.presenter.ts`
5. `src/modules/upload/interface/http/mappers/create-upload-session.mapper.ts` ✨
6. `src/modules/upload/interface/http/mappers/get-sas-batch.mapper.ts` ✨
7. `src/modules/upload/interface/http/mappers/refresh-sas-batch.mapper.ts` ✨
8. `src/modules/upload/interface/http/mappers/complete-session.mapper.ts` ✨
9. `src/modules/upload/interface/http/dto/requests/refresh-sas-batch.dto.ts`

### ✏️ Archivos Modificados:
1. `src/modules/upload/interface/http/controllers/upload.controller.ts` - Endpoints completos
2. `src/modules/upload/upload.module.ts` - Providers y configuración
3. `src/modules/upload/interface/http/dto/responses/refresh-sas.response.ts` - Cambio a batch

### 🗑️ Archivos Eliminados:
1. `src/modules/upload/interface/http/presenters/get-session-status.presenter.ts`
2. `src/modules/upload/application/mappers/get-session-status.mapper.ts`

### 📄 Archivos Sin Usar (pueden eliminarse si no se necesitan):
- `src/modules/upload/interface/http/dto/responses/session-status.response.ts`

---

## ⚠️ Notas Importantes

### 🔧 **Implementaciones Temporales:**

El módulo tiene **una implementación inline temporal**:

1. **`UPLOAD_SESSIONS_REPOSITORY`** (línea ~120 en `upload.module.ts`)
   - ⚠️ Mapeo simplificado Domain ↔ ORM
   - ⚠️ No implementa todas las operaciones del puerto
   - 📌 **TODO**: Crear adapter dedicado en `infrastructure/persistence/repositories/`

2. **`TRANSACTION_MANAGER`** (línea ~103)
   - ⚠️ Implementación funcional pero podría extraerse a adapter dedicado
   - 📌 **TODO**: Crear `infrastructure/persistence/adapters/transaction-manager.adapter.ts`

### ✅ **Adapters Implementados:**

1. **`PinoLoggerAdapter`** ✅
   - Ubicación: `infrastructure/logging/pino-logger.adapter.ts`
   - Implementa: `ILogger` usando `PinoLogger` de `nestjs-pino`
   - Reutiliza: La infraestructura de logging común en `src/common/logging/`

2. **`AzureBlobStorageAdapter`** ✅
   - Ubicación: `infrastructure/integrations/azure/azure-blob-storage.adapter.ts`
   - Implementa: `IBlobStorage`

3. **`UUID_GENERATOR`** ✅
   - Implementación inline con `uuid.v4()`
   - Suficientemente simple, no requiere adapter dedicado

### 🎯 **Próximos Pasos (Opcionales):**

1. **Crear adapters faltantes:**
   ```
   infrastructure/
   ├── persistence/
   │   └── adapters/
   │       ├── upload-sessions.repo.adapter.ts    ⚠️ PENDIENTE
   │       └── transaction-manager.adapter.ts     ⚠️ PENDIENTE
   └── logging/
       └── pino-logger.adapter.ts                 ✅ IMPLEMENTADO
   ```

2. **Implementar mappers ORM ↔ Domain:**
   ```
   infrastructure/persistence/mappers/
   ├── upload-session.mapper.ts    ⚠️ PENDIENTE
   └── upload-item.mapper.ts       ⚠️ PENDIENTE
   ```

3. **Testing:**
   - Unit tests para presenters
   - Unit tests para HTTP mappers
   - Integration tests para controller
   - E2E tests para flujo completo

---

## ✅ Validación

### Sin Errores de Compilación:
- ✅ Todos los presenters compilan
- ✅ Controller compila
- ✅ Module compila
- ✅ DTOs validados

### Arquitectura Clean:
- ✅ Separación de capas respetada
- ✅ Dependency Inversion aplicada
- ✅ DTOs HTTP separados de Application DTOs
- ✅ Presenters sin lógica de negocio

### Estándares NestJS:
- ✅ Guards aplicados
- ✅ OpenAPI documentado
- ✅ Validación de DTOs
- ✅ Inyección de dependencias

---

## 🚀 Uso de los Endpoints

### Ejemplo: Crear Sesión
```bash
POST /api/upload/sessions
Headers:
  x-internal-secret: <API_KEY>
  Content-Type: application/json

Body:
{
  "domain": "plant",
  "clientBatchId": "uuid-v4",
  "files": [
    {
      "clientItemId": "file-001",
      "fileName": "document.pdf",
      "fileSizeBytes": 1024000,
      "contentType": "application/pdf",
      "md5": "d41d8cd98f00b204e9800998ecf8427e"
    }
  ]
}
```

### Ejemplo: Obtener SAS Tokens
```bash
POST /api/upload/sessions/{sessionId}/sas-batch
Headers:
  x-internal-secret: <API_KEY>
  Content-Type: application/json

Body:
{
  "items": [
    {
      "blobName": "frutsmart/2024/file-001/document.pdf",
      "contentType": "application/pdf"
    }
  ]
}
```

---

**Implementación completada siguiendo Clean Architecture y estándares NestJS** ✨
