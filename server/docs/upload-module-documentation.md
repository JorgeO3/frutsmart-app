# Upload Module - Complete Documentation

> **Purpose**: This document provides comprehensive documentation of the Upload Module for AI-powered test generation. It covers architecture, endpoints, use cases, DTOs, domain logic, error handling, and integration points.

**Date**: October 9, 2025  
**Version**: 1.0  
**Architecture**: Clean Architecture (Hexagonal Architecture)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Structure](#2-module-structure)
3. [API Endpoints](#3-api-endpoints)
4. [Use Cases (Application Layer)](#4-use-cases-application-layer)
5. [Domain Layer](#5-domain-layer)
6. [Infrastructure Layer](#6-infrastructure-layer)
7. [Data Flow](#7-data-flow)
8. [Error Handling](#8-error-handling)
9. [Security](#9-security)
10. [Database Schema](#10-database-schema)
11. [Configuration](#11-configuration)
12. [Testing Considerations](#12-testing-considerations)

---

## 1. Architecture Overview

### 1.1 Pattern: Clean Architecture / Hexagonal Architecture

The Upload Module follows **Clean Architecture** principles with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Interface Layer (HTTP)                   │
│  Controllers • DTOs • Mappers • Presenters • Guards         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Application Layer                         │
│  Use Cases • Application DTOs • Mappers • Ports             │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                     Domain Layer                             │
│  Entities • Value Objects • Domain Errors • Business Rules   │
└─────────────────────────────────────────────────────────────┘
                       ▲
┌──────────────────────┴──────────────────────────────────────┐
│                  Infrastructure Layer                        │
│  Adapters • Repositories • External Services • ORM Entities  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Key Principles

- **Dependency Inversion**: Domain layer has zero dependencies on infrastructure
- **Port & Adapters**: Application defines ports (interfaces), infrastructure provides adapters
- **Single Responsibility**: Each layer has distinct responsibilities
- **Testability**: Business logic isolated and easily testable

---

## 2. Module Structure

```
src/modules/upload/
├── upload.module.ts                           # NestJS module configuration
│
├── interface/                                 # Interface Layer (HTTP)
│   └── http/
│       ├── controllers/
│       │   └── upload.controller.ts           # REST endpoints
│       ├── dto/
│       │   ├── requests/                      # Request DTOs
│       │   │   ├── create-upload-session.dto.ts
│       │   │   ├── sas-batch.dto.ts
│       │   │   ├── refresh-sas-batch.dto.ts
│       │   │   ├── complete-session.dto.ts
│       │   │   └── shared-types.ts
│       │   └── responses/                     # Response DTOs
│       │       ├── create-upload-session.response.ts
│       │       ├── sas-batch.response.ts
│       │       ├── refresh-sas.response.ts
│       │       ├── complete-session.response.ts
│       │       └── shared-response-types.ts
│       ├── mappers/                           # HTTP DTO → Use Case Input
│       │   ├── create-upload-session.mapper.ts
│       │   ├── get-sas-batch.mapper.ts
│       │   ├── refresh-sas-batch.mapper.ts
│       │   └── complete-session.mapper.ts
│       └── presenters/                        # Use Case Output → HTTP Response
│           ├── create-upload-session.presenter.ts
│           ├── get-sas-batch.presenter.ts
│           ├── refresh-sas-batch.presenter.ts
│           └── complete-session.presenter.ts
│
├── application/                               # Application Layer
│   ├── use-cases/                             # Business use cases
│   │   ├── create-upload-session.use-case.ts
│   │   ├── get-sas-batch.use-case.ts
│   │   ├── refresh-sas-batch.use-case.ts
│   │   └── complete-session.use-case.ts
│   ├── dto/                                   # Application DTOs
│   │   ├── create-upload-session/
│   │   │   ├── create-upload-session.input.ts
│   │   │   └── create-upload-session.output.ts
│   │   ├── get-sas-batch/
│   │   │   ├── get-sas-batch.input.ts
│   │   │   └── get-sas-batch.output.ts
│   │   ├── refresh-sas-batch/
│   │   │   ├── refresh-sas-batch.input.ts
│   │   │   └── refresh-sas-batch.output.ts
│   │   └── complete-session/
│   │       ├── complete-session.input.ts
│   │       └── complete-session.output.ts
│   ├── mappers/                               # Domain ↔ Application DTOs
│   │   ├── create-upload-session.mapper.ts
│   │   ├── get-sas-batch.mapper.ts
│   │   ├── refresh-sas-batch.mapper.ts
│   │   └── complete-session.mapper.ts
│   ├── ports/                                 # Interfaces (contracts)
│   │   ├── logger.port.ts
│   │   ├── blob-storage.port.ts
│   │   ├── transaction-manager.port.ts
│   │   ├── uuid-generator.port.ts
│   │   └── repositories/
│   │       ├── upload-sessions.repo.port.ts
│   │       └── upload-items.repo.port.ts
│   ├── errors/                                # Application-level errors
│   │   ├── session-not-found.error.ts
│   │   └── item-not-found.error.ts
│   └── constants/
│       └── sas-config.constants.ts
│
├── domain/                                    # Domain Layer
│   ├── entities/
│   │   ├── upload-session.entity.ts           # Aggregate Root
│   │   └── upload-item.entity.ts              # Entity
│   ├── value-objects/
│   │   ├── client-identifier.vo.ts
│   │   ├── storage-location.vo.ts
│   │   └── file-properties.vo.ts
│   ├── errors/                                # Domain errors
│   │   ├── session-not-open.error.ts
│   │   ├── session-empty.error.ts
│   │   ├── session-has-pending-items.error.ts
│   │   ├── item-invalid-status-transition.error.ts
│   │   ├── item-md5-mismatch.error.ts
│   │   └── argument-invalid.error.ts
│   └── types.ts                               # Domain types
│
└── infrastructure/                            # Infrastructure Layer
    ├── persistence/
    │   ├── entities/
    │   │   ├── upload-session.orm-entity.ts   # TypeORM entities
    │   │   └── upload-item.orm-entity.ts
    │   ├── repositories/
    │   │   ├── upload-sessions.typeorm-repo.ts
    │   │   └── upload-items.typeorm-repo.ts
    │   ├── mappers/
    │   │   └── upload-session-orm.mapper.ts
    │   └── adapters/
    │       ├── upload-sessions-repository.adapter.ts
    │       └── typeorm-transaction-manager.adapter.ts
    ├── integrations/
    │   └── azure/
    │       └── azure-blob-storage.adapter.ts
    └── logging/
        └── pino-logger.adapter.ts
```

---

## 3. API Endpoints

### Base Path: `/api/upload`

### 3.1 Authentication & Authorization

- **Guard**: `ApiKeyGuard`
- **Header Required**: `x-internal-secret` (or configured header name)
- **Decorator**: `@Public()` (bypasses JWT authentication, but requires API key)
- **Swagger**: `@ApiBearerAuth()`

All endpoints require a valid API key via the configured header (default: `x-internal-secret`).

---

### 3.2 Endpoint: Create Upload Session

**POST** `/api/upload/sessions`

Creates a new upload session for a batch of files. Returns session metadata and pre-configured blob paths for each file.

#### Request DTO: `CreateUploadSessionDto`

```typescript
{
  "domain": "plant" | "field",              // Required, enum
  "clientBatchId": "uuid-v4",              // Required, UUID format
  "files": [                                // Required, min 1 item
    {
      "clientItemId": "uuid-v4",           // Required, UUID format
      "fileName": "document.pdf",          // Required, max 255 chars, secure filename
      "fileSizeBytes": 1024000,            // Required, positive integer >= 1
      "contentType": "image/jpeg",         // Optional, whitelist: image/jpeg, image/webp, image/jpg
      "md5": "d41d8cd98f00b204e9800998ecf8427e"  // Optional, 32 hex chars
    }
  ],
  "description": "Optional description"     // Optional, max 500 chars
}
```

#### Validations

- `domain`: Enum validation (plant, field)
- `clientBatchId`: UUID format validation
- `files`: Array min size 1
- `clientItemId`: UUID format, unique per session
- `fileName`: Secure filename (no path traversal, ASCII-only)
- `fileSizeBytes`: Positive integer >= 1
- `contentType`: Whitelist validation (image/jpeg, image/webp, image/jpg)
- `md5`: MD5 hash format (32 hex characters)

#### Response: `CreateUploadSessionResponse` (201 Created)

```typescript
{
  "sessionId": "uuid-v4",
  "domain": "plant",
  "clientBatchId": "uuid-v4",
  "status": "OPEN",
  "createdAt": "2024-01-01T10:00:00.000Z",
  "description": "Optional description",
  "items": [
    {
      "itemId": "uuid-v4",
      "clientItemId": "uuid-v4",
      "status": "PENDING",
      "blobContainer": "frutsmart",
      "blobName": "plant/2025-01-15T10-30-00-000Z/uuid-v4/document.pdf",
      "createdAt": "2024-01-01T10:00:00.000Z"
    }
  ]
}
```

#### Error Responses

- **400 Bad Request**: Invalid DTO validation
- **401 Unauthorized**: Invalid or missing API key

---

### 3.3 Endpoint: Generate SAS Tokens (Batch)

**POST** `/api/upload/sessions/:sessionId/sas-batch`

Generates time-limited signed URLs (SAS tokens) for direct client-to-storage uploads.

#### Request DTO: `SasBatchRequestDto`

```typescript
{
  "items": [                                // Required, min 1 item
    {
      "blobName": "plant/2025-01-15T10-30-00-000Z/uuid-v4/document.pdf",  // Required, secure path
      "contentType": "image/jpeg"          // Optional, whitelist validation
    }
  ]
}
```

#### Validations

- `items`: Array min size 1
- `blobName`: Secure blob path (no traversal, max 1024 chars)
- `contentType`: Whitelist validation

#### Response: `SasBatchResponse` (200 OK)

```typescript
{
  "sas": [
    {
      "blobName": "plant/2025-01-15T10-30-00-000Z/uuid-v4/document.pdf",
      "url": "https://storage.blob.core.windows.net/container/blob?sv=2023-01-03&se=...",
      "blobUrl": "https://storage.blob.core.windows.net/container/blob",
      "expiresOn": "2024-01-01T11:00:00.000Z",
      "contentType": "image/jpeg"
    }
  ]
}
```

#### Error Responses

- **400 Bad Request**: Invalid DTO
- **404 Not Found**: Session not found
- **401 Unauthorized**: Invalid API key

---

### 3.4 Endpoint: Refresh SAS Tokens

**POST** `/api/upload/sessions/:sessionId/sas/refresh`

Generates new signed URLs for items with expired tokens.

#### Request DTO: `RefreshSasBatchDto`

```typescript
{
  "items": [                                // Required, min 1 item
    {
      "blobName": "plant/2025-01-15T10-30-00-000Z/uuid-v4/document.pdf",
      "contentType": "image/jpeg"
    }
  ]
}
```

#### Response: `RefreshSasBatchResponse` (200 OK)

Same structure as SAS batch response.

#### Error Responses

- **400 Bad Request**: Invalid DTO
- **404 Not Found**: Session or item not found
- **401 Unauthorized**: Invalid API key

---

### 3.5 Endpoint: Complete Upload Session

**POST** `/api/upload/sessions/:sessionId/complete`

Finalizes the session, optionally verifying integrity and promoting files.

#### Request DTO: `CompleteSessionDto`

```typescript
{
  "verifyAndPromote": true,                 // Optional, default: true
  "failOnIncomplete": false,                // Optional, default: false
  "onlyClientItems": [                      // Optional, process subset
    {
      "clientItemId": "uuid-v4"
    }
  ]
}
```

#### Behavior Flags

- **verifyAndPromote** (default: `true`):
  - `true`: Re-validates integrity (size/MD5) and promotes files to destination
  - `false`: Completes session without verification
  
- **failOnIncomplete** (default: `false`):
  - `true`: Fail session if any item is not VERIFIED
  - `false`: Mark non-verified items as INCOMPLETE, session still completes
  
- **onlyClientItems** (optional):
  - If provided: Only process specified items
  - If omitted: Process all items in session

#### Response: `CompleteSessionResponse` (200 OK)

```typescript
{
  "sessionId": "uuid-v4",
  "finalStatus": "COMPLETED",
  "results": [
    {
      "clientItemId": "uuid-v4",
      "finalStatus": "VERIFIED",
      "sizeBytes": 1024000,
      "md5": "d41d8cd98f00b204e9800998ecf8427e",
      "error": null
    }
  ],
  "summary": {
    "verified": 5,
    "incomplete": 1,
    "failed": 0,
    "total": 6
  }
}
```

#### Error Responses

- **400 Bad Request**: Invalid DTO
- **404 Not Found**: Session not found
- **401 Unauthorized**: Invalid API key

---

## 4. Use Cases (Application Layer)

### 4.1 CreateUploadSessionUseCase

**File**: `application/use-cases/create-upload-session.use-case.ts`

#### Responsibility

Creates a new upload session or reuses an existing open session with the same `clientBatchId`.

#### Input: `CreateUploadSessionInput`

```typescript
{
  clientBatchId: string;
  domain: UploadDomain;
  files: FileInput[];
}
```

#### Output: `CreateUploadSessionOutput`

```typescript
{
  sessionId: string;
  domain: UploadDomain;
  clientBatchId: string;
  status: UploadSessionStatus;
  createdAt: Date;
  items: CreatedItemOutput[];
}
```

#### Process Flow

1. **Validate input** via mapper
2. **Check for existing open session** by `clientBatchId`
3. If exists: Return existing session (idempotency)
4. If not exists:
   - **Create domain aggregate** (UploadSession + UploadItems)
   - **Generate blob paths** for each file
   - **Save to repository** in transaction
   - **Return output DTO**

#### Dependencies (Ports)

- `LOGGER`: Logging operations
- `TRANSACTION_MANAGER`: Transaction management
- `UPLOAD_SESSIONS_REPOSITORY`: Session persistence
- `CreateUploadSessionMapper`: Domain ↔ DTO mapping

#### Business Rules

- Session starts in `OPEN` status
- Each item starts in `PENDING` status
- Blob paths follow pattern: `{domain}/{timestamp}/{clientItemId}/{fileName}`
- Idempotent: Reuses existing open session with same `clientBatchId`

#### Errors Thrown

- None (application-level errors are handled by repository/infrastructure)

---

### 4.2 GetSasBatchUseCase

**File**: `application/use-cases/get-sas-batch.use-case.ts`

#### Responsibility

Generates SAS tokens (signed URLs) for batch upload to Azure Blob Storage.

#### Input: `GetSasBatchInput`

```typescript
{
  sessionId: string;
  items: Array<{
    objectKey: string;      // blob name
    contentType?: string;
  }>;
  ttlMinutes?: number;      // Optional, default: 60
}
```

#### Output: `GetSasBatchOutput`

```typescript
{
  signedUrls: Array<{
    objectKey: string;
    url: string;            // SAS URL
    objectUrl: string;      // Permanent blob URL
    expiresOn: Date;
  }>;
}
```

#### Process Flow

1. **Fetch session** by ID
2. **Validate session exists** (throws `SessionNotFoundError` if not)
3. **Guard session is OPEN** (throws `SessionNotOpenError` if not)
4. **Validate items exist** in session (throws `ItemNotFoundError` if not)
5. **Build storage requests** for each item
6. **Generate SAS tokens** via blob storage adapter
7. **Return signed URLs**

#### Dependencies (Ports)

- `LOGGER`: Logging
- `UPLOAD_SESSIONS_REPOSITORY`: Session retrieval
- `BLOB_STORAGE`: SAS token generation
- `GetSasBatchMapper`: Output mapping

#### Business Rules

- Session must be in `OPEN` status
- All requested blob names must exist in session
- Default TTL: 60 minutes
- SAS tokens allow `write` and `create` permissions

#### Errors Thrown

- `SessionNotFoundError`: Session with given ID not found
- `ItemNotFoundError`: Blob name not found in session
- `SessionNotOpenError`: Session not in OPEN status

---

### 4.3 RefreshSasBatchUseCase

**File**: `application/use-cases/refresh-sas-batch.use-case.ts`

#### Responsibility

Refreshes expired SAS tokens for ongoing uploads.

#### Input: `RefreshSasBatchInput`

```typescript
{
  sessionId: string;
  items: Array<{
    objectKey: string;
    contentType?: string;
  }>;
}
```

#### Output: `RefreshSasBatchOutput`

Same as `GetSasBatchOutput`.

#### Process Flow

1. **Fetch session** by ID
2. **Validate session** (exists and OPEN)
3. **Validate items** exist in session
4. **Generate new SAS tokens** with default TTL
5. **Return refreshed URLs**

#### Dependencies

Same as `GetSasBatchUseCase`.

#### Business Rules

- Uses fixed TTL (60 minutes from `SAS_CONFIG.DEFAULT_TTL_MINUTES`)
- Session must still be OPEN
- Items must exist in session

#### Errors Thrown

Same as `GetSasBatchUseCase`.

---

### 4.4 CompleteSessionUseCase

**File**: `application/use-cases/complete-session.use-case.ts`

#### Responsibility

Finalizes upload session, optionally verifying file integrity and promoting files.

#### Input: `CompleteSessionInput`

```typescript
{
  sessionId: string;
  verifyAndPromote?: boolean;      // default: true
  failOnIncomplete?: boolean;       // default: false
  onlyClientItemIds?: string[];     // optional subset
}
```

#### Output: `CompleteSessionOutput`

```typescript
{
  sessionId: string;
  finalStatus: UploadSessionStatus;
  results: ItemProcessingResultOutput[];
  summary: {
    verified: number;
    incomplete: number;
    failed: number;
    total: number;
  };
}
```

#### Process Flow

1. **Fetch session** from repository
2. **Validate session exists**
3. **Select items to process** (all or subset via `onlyClientItemIds`)
4. **For each item**:
   - If `verifyAndPromote = true`:
     - **Get blob metadata** from storage
     - **Verify MD5 hash** (if client provided one)
     - **Verify file size**
     - **Mark item as VERIFIED** (or FAILED)
   - If `verifyAndPromote = false`:
     - Skip verification
5. **Finalize session**:
   - If `failOnIncomplete = true` and any item not VERIFIED:
     - **Mark session as FAILED**
   - Else:
     - **Mark session as COMPLETED**
6. **Save session** (in transaction)
7. **Return results summary**

#### Dependencies (Ports)

- `LOGGER`: Logging
- `TRANSACTION_MANAGER`: Transaction
- `UPLOAD_SESSIONS_REPOSITORY`: Session persistence
- `BLOB_STORAGE`: Metadata retrieval
- `CompleteSessionMapper`: Output mapping

#### Business Rules

- Session must be OPEN
- Session cannot be empty (must have items)
- If all items VERIFIED: session COMPLETED
- If `failOnIncomplete = true` and not all VERIFIED: session FAILED
- If `failOnIncomplete = false`: mark incomplete items as INCOMPLETE, session still COMPLETED
- MD5 validation: If client provided MD5, it must match server MD5

#### Errors Thrown

- `SessionNotFoundError`: Session not found
- Domain errors (handled by entity methods):
  - `SessionNotOpenError`: Session not in OPEN status
  - `SessionEmptyError`: Session has no items
  - `SessionHasPendingItemsError`: Not all items VERIFIED (when strict mode)

---

## 5. Domain Layer

### 5.1 Entities

#### 5.1.1 UploadSession (Aggregate Root)

**File**: `domain/entities/upload-session.entity.ts`

##### Properties

```typescript
{
  id: UUID;
  clientBatchId: ClientIdentifier;  // Value Object
  domain: UploadDomain;             // 'plant' | 'field'
  status: UploadSessionStatus;      // 'OPEN' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED'
  createdAt: Date;
  updatedAt: Date;
  items: UploadItem[];              // Child entities
}
```

##### Factory Methods

- `UploadSession.create(props)`: Creates new session (status: OPEN)
- `UploadSession.fromPersistence(props)`: Reconstitutes from DB

##### Business Methods

- **`guardCanGenerateSas()`**: Throws if session not OPEN
- **`addItem(item)`**: Adds item to session, throws if not OPEN
- **`complete()`**: Marks session as COMPLETED
  - Validates: not empty, all items VERIFIED
  - Throws: `SessionEmptyError`, `SessionHasPendingItemsError`, `SessionNotOpenError`
- **`fail()`**: Marks session as FAILED
  - Throws: `SessionNotOpenError`

##### Query Methods

- **`findItemByBlobName(blobName)`**: Finds item by blob name
- **`isTerminal()`**: Returns true if COMPLETED or FAILED

##### Invariants

- Session can only be modified if OPEN
- Cannot complete empty session
- Cannot complete with non-VERIFIED items (strict mode)

---

#### 5.1.2 UploadItem (Entity)

**File**: `domain/entities/upload-item.entity.ts`

##### Properties

```typescript
{
  id: UUID;
  clientItemId: ClientIdentifier;   // Value Object
  status: UploadItemStatus;         // State machine
  location: StorageLocation;        // Value Object
  properties: FileProperties;       // Value Object
  createdAt: Date;
  updatedAt: Date;
}
```

##### Status State Machine

```
PENDING → IN_PROGRESS → UPLOADED → VERIFIED
           ↓              ↓
         FAILED        FAILED
```

##### Factory Methods

- `UploadItem.create(props)`: Creates new item (status: PENDING)
- `UploadItem.fromPersistence(props)`: Reconstitutes from DB

##### Business Methods

- **`markAsInProgress()`**: PENDING → IN_PROGRESS
  - Throws: `ItemInvalidStatusTransitionError` if not PENDING
  
- **`markAsUploaded()`**: (PENDING | IN_PROGRESS) → UPLOADED
  - Throws: `ItemInvalidStatusTransitionError` if invalid state
  
- **`verify(md5HashFromServer)`**: UPLOADED → VERIFIED
  - Validates MD5 hash match
  - Throws: `ItemInvalidStatusTransitionError`, `ItemMD5MismatchError`
  
- **`markAsFailed()`**: Any status → FAILED (except VERIFIED, FAILED)
  - Throws: `ItemInvalidStatusTransitionError` if already terminal
  
- **`markAsIncomplete()`**: Any status → INCOMPLETE
  - Throws: `ItemInvalidStatusTransitionError` if already terminal

##### Invariants

- Status transitions follow state machine
- MD5 must match if provided by client
- Cannot transition from terminal states (VERIFIED, FAILED, ABORTED)

---

### 5.2 Value Objects

#### 5.2.1 ClientIdentifier

**File**: `domain/value-objects/client-identifier.vo.ts`

##### Purpose
Encapsulates client-provided identifiers (batch ID, item ID).

##### Properties
```typescript
{ value: string }
```

##### Validation
- Non-empty string
- UUID format (validated at DTO level)

---

#### 5.2.2 StorageLocation

**File**: `domain/value-objects/storage-location.vo.ts`

##### Purpose
Represents file location in cloud storage.

##### Properties
```typescript
{
  provider: StorageProvider;  // 'azure' | 's3' | 'gcs'
  container: string;
  blobName: string;
}
```

##### Validation
- Container and blobName cannot be empty

---

#### 5.2.3 FileProperties

**File**: `domain/value-objects/file-properties.vo.ts`

##### Purpose
Encapsulates file metadata.

##### Properties
```typescript
{
  mimeType?: string;
  sizeInBytes: number;
  md5Hash?: string;
}
```

##### Validation
- sizeInBytes >= 0
- md5Hash: 32 hex characters if provided

---

### 5.3 Domain Errors

#### Session-Level Errors

- **`SessionNotOpenError`**: Operation requires OPEN status
- **`SessionEmptyError`**: Cannot complete empty session
- **`SessionHasPendingItemsError`**: Cannot complete with non-VERIFIED items

#### Item-Level Errors

- **`ItemInvalidStatusTransitionError`**: Invalid state transition
- **`ItemMD5MismatchError`**: MD5 hash doesn't match

#### Generic Domain Errors

- **`ArgumentInvalidError`**: Value object validation failure

---

## 6. Infrastructure Layer

### 6.1 Persistence

#### 6.1.1 Database Schema

**Table**: `core.upload_sessions`

```sql
CREATE TYPE core.upload_session_status AS ENUM ('OPEN', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE core.upload_domain AS ENUM ('plant', 'field');

CREATE TABLE core.upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain core.upload_domain NOT NULL DEFAULT 'plant',
  client_batch_id UUID NOT NULL,
  user_id UUID,
  status core.upload_session_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: only one OPEN session per client_batch_id per domain
CREATE UNIQUE INDEX uq_open_session_by_client_batch_open 
  ON core.upload_sessions (domain, client_batch_id) 
  WHERE status = 'OPEN';

-- Indexes
CREATE INDEX idx_session_by_client_batch ON core.upload_sessions (client_batch_id);
CREATE INDEX idx_session_by_user ON core.upload_sessions (user_id);
CREATE INDEX idx_session_status ON core.upload_sessions (status);
```

**Table**: `core.upload_items`

```sql
CREATE TYPE core.upload_item_status AS ENUM (
  'PENDING', 'IN_PROGRESS', 'UPLOADED', 'VERIFIED', 'FAILED', 'ABORTED'
);

CREATE TABLE core.upload_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES core.upload_sessions(id) ON DELETE CASCADE,
  client_item_id UUID NOT NULL,
  status core.upload_item_status NOT NULL DEFAULT 'PENDING',
  
  -- Storage location
  blob_container VARCHAR(63) NOT NULL,
  blob_name VARCHAR(1024) NOT NULL,
  
  -- File properties
  mime_type VARCHAR(100),
  size_bytes BIGINT NOT NULL,
  md5_hash CHAR(32),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_item_by_session ON core.upload_items (session_id);
CREATE INDEX idx_item_by_client_item ON core.upload_items (client_item_id);
CREATE INDEX idx_item_status ON core.upload_items (status);
```

#### 6.1.2 Repository Adapters

- **`UploadSessionsRepositoryAdapter`**: Implements `IUploadSessionsRepository`
- **`TypeOrmTransactionManager`**: Implements `ITransactionManager`

#### 6.1.3 ORM Mappers

- **`UploadSessionOrmMapper`**: Domain Entity ↔ TypeORM Entity

---

### 6.2 External Integrations

#### 6.2.1 Azure Blob Storage Adapter

**File**: `infrastructure/integrations/azure/azure-blob-storage.adapter.ts`

##### Implements: `IBlobStorage`

##### Methods

- **`generateUploadUrls(requests, ttlMinutes)`**: Generates SAS tokens
- **`getObjectMetadata(objectKey, domain)`**: Retrieves blob metadata
- **`generateBlobName(domain, clientItemId, fileName)`**: Creates blob path

##### Blob Name Pattern

```
{domain}/{timestamp}/{clientItemId}/{fileName}
```

Example:
```
plant/2025-01-15T10-30-00-000Z/550e8400-e29b-41d4-a716-446655440000/image.jpg
```

##### SAS Token Configuration

- **Permissions**: Write, Create
- **Default TTL**: 60 minutes
- **Service**: Azure Blob Storage
- **Protocol**: HTTPS only

---

### 6.3 Logging

#### PinoLoggerAdapter

**File**: `infrastructure/logging/pino-logger.adapter.ts`

##### Implements: `ILogger`

##### Methods
- `debug(message, context?)`
- `log(message, context?)`
- `warn(message, context?)`
- `error(message, stack?, context?)`

---

## 7. Data Flow

### 7.1 Create Upload Session Flow

```
1. Client → POST /api/upload/sessions
2. Controller receives CreateUploadSessionDto
3. DTO validation (class-validator)
4. HTTP Mapper → CreateUploadSessionInput
5. CreateUploadSessionUseCase.execute()
   ├─ Check existing open session
   ├─ If not exists:
   │  ├─ Create domain entities (Session + Items)
   │  ├─ Generate blob paths
   │  └─ Save in transaction
   └─ Return output
6. Presenter → CreateUploadSessionResponse
7. Controller → HTTP 201 Response
```

### 7.2 Generate SAS Tokens Flow

```
1. Client → POST /api/upload/sessions/:sessionId/sas-batch
2. Controller receives SasBatchRequestDto
3. DTO validation
4. HTTP Mapper → GetSasBatchInput
5. GetSasBatchUseCase.execute()
   ├─ Fetch session
   ├─ Validate session OPEN
   ├─ Validate items exist
   ├─ Call Azure adapter
   └─ Return signed URLs
6. Presenter → SasBatchResponse
7. Controller → HTTP 200 Response
```

### 7.3 Complete Session Flow

```
1. Client → POST /api/upload/sessions/:sessionId/complete
2. Controller receives CompleteSessionDto
3. DTO validation
4. HTTP Mapper → CompleteSessionInput
5. CompleteSessionUseCase.execute()
   ├─ Fetch session
   ├─ Select items to process
   ├─ For each item:
   │  ├─ Get blob metadata
   │  ├─ Verify MD5
   │  └─ Update item status
   ├─ Finalize session (COMPLETED | FAILED)
   ├─ Save in transaction
   └─ Return results
6. Presenter → CompleteSessionResponse
7. Controller → HTTP 200 Response
```

---

## 8. Error Handling

### 8.1 Error Categories

#### 8.1.1 HTTP Layer Errors (400-level)

- **400 Bad Request**: DTO validation failures
  - Handled by `ValidationPipe` and `ValidationExceptionFilter`
  - Returns detailed validation errors per field
  
- **401 Unauthorized**: API key validation failure
  - Handled by `ApiKeyGuard`
  - Message: "Invalid or missing API key"
  
- **404 Not Found**: Resource not found
  - `SessionNotFoundError`
  - `ItemNotFoundError`

#### 8.1.2 Domain Layer Errors

**Session Errors:**
- `SessionNotOpenError`: Operation requires OPEN status
- `SessionEmptyError`: Cannot complete empty session
- `SessionHasPendingItemsError`: Cannot complete with non-VERIFIED items

**Item Errors:**
- `ItemInvalidStatusTransitionError`: Invalid state transition
- `ItemMD5MismatchError`: Hash mismatch during verification

**Generic:**
- `ArgumentInvalidError`: Value object validation failure

#### 8.1.3 Infrastructure Errors (500-level)

- Database connection errors
- Azure Blob Storage errors
- Transaction failures

All unhandled errors are caught by `AllExceptionsFilter`.

### 8.2 Error Response Format

```typescript
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": {
    "files.0.fileName": ["fileName must not contain path separators"]
  },
  "traceId": "uuid-v4",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "path": "/api/upload/sessions",
  "method": "POST"
}
```

---

## 9. Security

### 9.1 Authentication

- **Mechanism**: API Key via header
- **Guard**: `ApiKeyGuard`
- **Header**: `x-internal-secret` (configurable)
- **Config**: `security.internalApiSecret` from environment

### 9.2 Authorization

- **Public Endpoints**: All upload endpoints are public (no JWT required)
- **API Key Required**: Yes, for all endpoints
- **Decorator**: `@Public()` (bypasses JWT, but keeps API key requirement)

### 9.3 Input Validation

#### Custom Validators (class-validator)

- **`IsSecureUUID`**: Validates UUID format
- **`IsSecureFileName`**: No path traversal, ASCII-only, max length
- **`IsSecureBlobPath`**: No traversal, no backslashes, ASCII segments
- **`IsSecureContentType`**: Whitelist validation
- **`IsPositiveInteger`**: >= 1

#### Validation Rules

- **No path traversal**: `../`, `./`, `\`
- **ASCII-only filenames**: Prevents encoding attacks
- **Whitelist content types**: `image/jpeg`, `image/webp`, `image/jpg`
- **Max lengths**: Prevent DoS via large inputs
- **UUID format**: Prevents injection attacks

### 9.4 Rate Limiting

- **Not implemented at module level**
- Should be configured at API Gateway or NestJS global level

### 9.5 Secrets Management

- **No hardcoded secrets**
- **Environment variables**: `INTERNAL_API_SECRET`, `AZURE_STORAGE_CONNECTION_STRING`
- **Configuration module**: Centralized config reading

---

## 10. Database Schema

### 10.1 Enums

```sql
CREATE TYPE core.upload_domain AS ENUM ('plant', 'field');
CREATE TYPE core.upload_session_status AS ENUM ('OPEN', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE core.upload_item_status AS ENUM ('PENDING', 'IN_PROGRESS', 'UPLOADED', 'VERIFIED', 'FAILED', 'ABORTED');
```

### 10.2 Tables

**`core.upload_sessions`**

| Column           | Type                      | Constraints           |
|------------------|---------------------------|-----------------------|
| id               | UUID                      | PK, default gen       |
| domain           | upload_domain             | NOT NULL, default 'plant' |
| client_batch_id  | UUID                      | NOT NULL              |
| user_id          | UUID                      | NULL                  |
| status           | upload_session_status     | NOT NULL, default 'OPEN' |
| created_at       | TIMESTAMPTZ               | NOT NULL, default NOW |
| updated_at       | TIMESTAMPTZ               | NOT NULL, default NOW |

**`core.upload_items`**

| Column           | Type                   | Constraints           |
|------------------|------------------------|-----------------------|
| id               | UUID                   | PK, default gen       |
| session_id       | UUID                   | FK → upload_sessions, CASCADE |
| client_item_id   | UUID                   | NOT NULL              |
| status           | upload_item_status     | NOT NULL, default 'PENDING' |
| blob_container   | VARCHAR(63)            | NOT NULL              |
| blob_name        | VARCHAR(1024)          | NOT NULL              |
| mime_type        | VARCHAR(100)           | NULL                  |
| size_bytes       | BIGINT                 | NOT NULL              |
| md5_hash         | CHAR(32)               | NULL                  |
| created_at       | TIMESTAMPTZ            | NOT NULL, default NOW |
| updated_at       | TIMESTAMPTZ            | NOT NULL, default NOW |

### 10.3 Indexes

```sql
-- Sessions
CREATE UNIQUE INDEX uq_open_session_by_client_batch_open 
  ON core.upload_sessions (domain, client_batch_id) 
  WHERE status = 'OPEN';
CREATE INDEX idx_session_by_client_batch ON core.upload_sessions (client_batch_id);
CREATE INDEX idx_session_by_user ON core.upload_sessions (user_id);
CREATE INDEX idx_session_status ON core.upload_sessions (status);

-- Items
CREATE INDEX idx_item_by_session ON core.upload_items (session_id);
CREATE INDEX idx_item_by_client_item ON core.upload_items (client_item_id);
CREATE INDEX idx_item_status ON core.upload_items (status);
```

### 10.4 Relationships

- **One-to-Many**: `UploadSession` → `UploadItem[]`
- **Cascade Delete**: Items deleted when session deleted
- **Foreign Key**: `upload_items.session_id` → `upload_sessions.id`

---

## 11. Configuration

### 11.1 Environment Variables

```bash
# Security
INTERNAL_API_SECRET=your-secret-key
API_KEY_HEADER=x-internal-secret  # optional, default: x-internal-secret

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_STORAGE_CONTAINER=frutsmart

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=frutsmart_back
DATABASE_USER=postgres
DATABASE_PASSWORD=secret
```

### 11.2 Module Configuration

**File**: `upload.module.ts`

#### Providers

- **HTTP Layer**: Controllers, Mappers, Presenters
- **Application Layer**: Use Cases, Application Mappers
- **Infrastructure**: Adapters (Logger, BlobStorage, Repositories, TransactionManager)
- **Ports**: UUID Generator, Configuration

#### Imports

- `TypeOrmModule.forFeature([UploadSessionEntity, UploadItemEntity])`
- `AzureBlobModule`

---

## 12. Testing Considerations

### 12.1 Unit Tests (Domain Layer)

#### Test Entities

**UploadSession:**
- ✅ Create session with valid data
- ✅ Add item to OPEN session
- ✅ Throw error when adding item to non-OPEN session
- ✅ Complete session with all VERIFIED items
- ✅ Throw error when completing empty session
- ✅ Throw error when completing with non-VERIFIED items
- ✅ Fail session successfully
- ✅ Find item by blob name
- ✅ Check terminal status

**UploadItem:**
- ✅ Create item with PENDING status
- ✅ Mark as IN_PROGRESS from PENDING
- ✅ Throw error when marking as IN_PROGRESS from wrong status
- ✅ Mark as UPLOADED from PENDING or IN_PROGRESS
- ✅ Verify item with matching MD5
- ✅ Throw error when MD5 mismatch
- ✅ Throw error when verifying non-UPLOADED item
- ✅ Mark as FAILED from valid statuses
- ✅ Throw error when invalid status transition

#### Test Value Objects

**ClientIdentifier:**
- ✅ Create with valid string
- ✅ Throw error with empty string

**StorageLocation:**
- ✅ Create with valid properties
- ✅ Throw error with empty container
- ✅ Throw error with empty blobName

**FileProperties:**
- ✅ Create with valid properties
- ✅ Throw error with negative size
- ✅ Throw error with invalid MD5 format

---

### 12.2 Integration Tests (Use Cases)

#### CreateUploadSessionUseCase

**Happy Path:**
- ✅ Create new session with valid input
- ✅ Session saved to database
- ✅ Items created with correct blob paths
- ✅ Return correct output structure

**Idempotency:**
- ✅ Reuse existing OPEN session with same clientBatchId
- ✅ Do not create duplicate sessions

**Error Cases:**
- ✅ Handle database connection errors
- ✅ Handle transaction rollback

---

#### GetSasBatchUseCase

**Happy Path:**
- ✅ Generate SAS tokens for valid items
- ✅ Return signed URLs with expiration

**Error Cases:**
- ✅ Throw SessionNotFoundError when session doesn't exist
- ✅ Throw SessionNotOpenError when session not OPEN
- ✅ Throw ItemNotFoundError when blob name not in session
- ✅ Handle Azure service errors

---

#### RefreshSasBatchUseCase

**Happy Path:**
- ✅ Refresh expired tokens

**Error Cases:**
- ✅ Same as GetSasBatchUseCase

---

#### CompleteSessionUseCase

**Happy Path:**
- ✅ Complete session with all items VERIFIED
- ✅ Mark session as COMPLETED

**Verification Enabled:**
- ✅ Verify MD5 hash matches
- ✅ Mark item as VERIFIED when successful
- ✅ Mark item as FAILED when MD5 mismatch
- ✅ Mark item as FAILED when blob not found

**Verification Disabled:**
- ✅ Skip verification, complete session

**Fail On Incomplete:**
- ✅ Mark session as FAILED when items not VERIFIED
- ✅ Mark session as COMPLETED when items INCOMPLETE (failOnIncomplete=false)

**Partial Processing:**
- ✅ Process only specified clientItemIds
- ✅ Leave other items unchanged

**Error Cases:**
- ✅ Throw SessionNotFoundError
- ✅ Throw SessionNotOpenError
- ✅ Throw SessionEmptyError
- ✅ Handle blob storage errors

---

### 12.3 E2E Tests (HTTP Layer)

#### Endpoint: POST /api/upload/sessions

**Happy Path:**
- ✅ Create session with valid DTO
- ✅ Return 201 with session and items

**Validation Errors:**
- ✅ Return 400 when domain invalid
- ✅ Return 400 when clientBatchId not UUID
- ✅ Return 400 when files array empty
- ✅ Return 400 when fileName has path traversal
- ✅ Return 400 when fileSizeBytes <= 0
- ✅ Return 400 when contentType not in whitelist
- ✅ Return 400 when md5 invalid format

**Authentication:**
- ✅ Return 401 when API key missing
- ✅ Return 401 when API key invalid

---

#### Endpoint: POST /api/upload/sessions/:sessionId/sas-batch

**Happy Path:**
- ✅ Generate SAS tokens for valid items
- ✅ Return 200 with signed URLs

**Error Cases:**
- ✅ Return 404 when session not found
- ✅ Return 404 when item not found
- ✅ Return 400 when DTO validation fails
- ✅ Return 401 when unauthorized

---

#### Endpoint: POST /api/upload/sessions/:sessionId/complete

**Happy Path:**
- ✅ Complete session with verification
- ✅ Return 200 with results summary

**Error Cases:**
- ✅ Return 404 when session not found
- ✅ Return 400 when DTO validation fails
- ✅ Handle domain errors gracefully

---

### 12.4 Edge Cases & Corner Cases

#### Concurrency

- ✅ Concurrent session creation with same clientBatchId
- ✅ Database unique constraint prevents duplicates
- ✅ Race condition handling

#### Large Batches

- ✅ Upload session with 1000+ items
- ✅ SAS token generation for 100+ items
- ✅ Performance degradation thresholds

#### Expired Tokens

- ✅ Refresh tokens multiple times
- ✅ Token expiration edge cases

#### Partial Failures

- ✅ Some items verified, some failed
- ✅ Session completion with mixed results
- ✅ Retry logic

#### Data Consistency

- ✅ Transaction rollback on error
- ✅ Orphaned items prevention
- ✅ Session state consistency

---

### 12.5 Security Tests

#### Input Validation

- ✅ Path traversal attempts (`../../../etc/passwd`)
- ✅ SQL injection in filenames
- ✅ XSS in descriptions
- ✅ Buffer overflow with long strings
- ✅ Invalid UUID formats
- ✅ Null byte injection
- ✅ Unicode normalization attacks

#### Authentication

- ✅ Missing API key
- ✅ Invalid API key
- ✅ Empty API key
- ✅ API key in wrong header

#### Rate Limiting

- ✅ Burst requests (if implemented)
- ✅ DoS prevention

---

### 12.6 Performance Tests

#### Load Testing

- ✅ 100 concurrent session creations
- ✅ 1000 concurrent SAS token requests
- ✅ Large batch processing (1000+ items)

#### Response Times

- ✅ Session creation < 200ms
- ✅ SAS generation < 100ms
- ✅ Session completion < 500ms (with verification)

#### Database Performance

- ✅ Index effectiveness
- ✅ Query optimization
- ✅ Transaction duration

---

## 13. Additional Notes

### 13.1 Idempotency

- **CreateUploadSession**: Reuses existing OPEN session with same `clientBatchId`
- **GetSasBatch**: Stateless, can be called multiple times
- **CompleteSession**: Not idempotent, should be called once

### 13.2 Limitations

- **No pagination**: Session items loaded entirely (consider for large batches)
- **No session cleanup**: Expired sessions not auto-deleted (requires cron job)
- **No file size limit**: Enforced at DTO level but not at business level
- **No concurrent uploads**: Client must handle concurrency

### 13.3 Future Enhancements

- **Chunked uploads**: Support for large files (>100MB)
- **Resumable uploads**: Continue from interrupted uploads
- **Webhook notifications**: Notify on session completion
- **Batch operations**: Delete multiple sessions
- **Analytics**: Upload statistics and monitoring
- **S3 support**: Multi-cloud storage adapter

---

## 14. Glossary

- **SAS Token**: Shared Access Signature, time-limited signed URL for Azure Blob Storage
- **Aggregate Root**: DDD pattern, main entity that controls consistency boundary
- **Value Object**: Immutable object defined by its attributes, not identity
- **Port**: Interface defining contract (Hexagonal Architecture)
- **Adapter**: Implementation of a port
- **DTO**: Data Transfer Object, used for data exchange between layers
- **Use Case**: Application service that orchestrates domain logic
- **Guard**: NestJS component for authentication/authorization
- **Presenter**: Transforms application output to HTTP response format
- **Mapper**: Transforms between different representations (DTO ↔ Entity)

---

**End of Documentation**
