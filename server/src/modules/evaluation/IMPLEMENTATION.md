# Evaluation Module - Implementation Summary

## Overview

This module implements the **evaluation** domain following **Clean Architecture** and **Domain-Driven Design (DDD)** principles. It provides a single endpoint for creating complete evaluations in one operation (one-shot flow).

## Architecture

The module is organized in four distinct layers, with dependencies flowing inward:

```
interface (HTTP) → application → domain ← infrastructure
```

### Layers

1. **Domain Layer** (Pure, framework-agnostic)
   - Entities: `Evaluation` (aggregate root), `ClassificationStep`, `ClassificationResult`, `Photo`, `ClassifiedSegment`
   - Value Objects: `Traceability`, `Geolocation`, `HarvestCriteria`
   - Domain errors: Custom exceptions for business rule violations
   - Types: Type-safe enums as string unions

2. **Application Layer**
   - Use case: `CreateEvaluationUseCase`
   - Repository port: `IEvaluationRepository`
   - DTOs: Input/Output without decorators
   - Mapper: `CreateEvaluationMapper` (domain ↔ use-case DTOs)

3. **Infrastructure Layer**
   - TypeORM entities: Map to `core` schema tables
   - ORM mapper: `EvaluationOrmMapper` (domain ↔ TypeORM)
   - Repository adapter: `EvaluationRepositoryAdapter`

4. **Interface Layer (HTTP)**
   - Controller: `EvaluationController`
   - Request/Response DTOs with security validators
   - Presenter: `CreateEvaluationPresenter` (HTTP DTOs ↔ use-case DTOs)

## Endpoint

### POST /evaluations

Creates a complete evaluation with all steps, results, photos, and segments in a single transaction.

**Request Body:**
```json
{
  "id": "uuid",
  "type": "PLANT_ANALYSIS" | "FIELD_EVENT",
  "creationTimestamp": "2023-10-14T12:00:00Z",
  "providerKind": "own" | "third-party",
  "truckPlate": "ABC-123",
  "programId": "uuid",
  "steps": [
    {
      "id": "uuid",
      "kind": "external" | "internal",
      "iterationIndex": 0,
      "result": {
        "id": "uuid",
        "aiClassName": "class1",
        "aiConfidence": 0.95,
        "aiRawConfidencesJson": { "class1": 0.95, "class2": 0.05 }
      },
      "photos": [
        {
          "id": "uuid",
          "role": "raw" | "segmented" | "cropped",
          "blobContainer": "container",
          "blobName": "path/to/blob"
        }
      ],
      "segments": [
        {
          "id": "uuid",
          "blobContainer": "container",
          "blobName": "path/to/segment",
          "bestClassName": "class1",
          "bestConfidence": 0.98,
          "confidencesJson": { "class1": 0.98, "class2": 0.02 }
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "id": "uuid",
  "type": "PLANT_ANALYSIS",
  "isFinalized": true,
  "createdAt": "2023-10-14T12:00:00.000Z",
  "totalSteps": 1,
  "totalPhotos": 1,
  "totalSegments": 1,
  "stepsSummary": [
    {
      "kind": "external",
      "iterationIndex": 0,
      "hasResult": true,
      "photoCount": 1,
      "segmentCount": 1
    }
  ]
}
```

## Business Rules (Enforced in Domain)

### Traceability

The `Traceability` value object enforces the SQL CHECK constraint:

1. **FIELD_EVENT**: Requires `programId`, `lotId`, `centerId`; forbids `providerKind`/`providerId`
2. **PLANT_ANALYSIS + third-party**: Requires `providerId` & `truckPlate`; forbids `programId`/`lotId`/`centerId`
3. **PLANT_ANALYSIS + own**: Requires `programId` & `truckPlate`; forbids `providerId`/`lotId`/`centerId`

### Geolocation

- Both `latitude` and `longitude` must be present or both absent
- Latitude range: [-90, 90]
- Longitude range: [-180, 180]

### Classification Steps

- `iterationIndex` must be in range [0, 3]
- Uniqueness by (`kind`, `iterationIndex`) per evaluation
- A step can have only one result
- Photos are unique by `blobName` per step
- Segments are unique by `blobName` per step

### Confidence Validation

- `aiConfidence`: [0, 1]
- `bestConfidence`: [0, 1]

### One-Shot Flow

- Evaluation is finalized immediately upon creation (`isFinalized=true`)
- No updates or modifications after creation

## Security

All HTTP DTOs use security validators from `src/common/validators`:

- `@NoSqlInjection()`: Prevents SQL injection in string fields
- `@IsSecureBlobPath()`: Validates blob paths
- `@IsSecureFileName()`: Validates file names
- `@IsSecureContentType()`: Validates content types with whitelist
- `@IsIsoDateString()`: Validates ISO 8601 dates
- `@IsPositiveInteger()`: Validates positive integers

## Database Schema

Maps to the following tables in the `core` schema:

- `core.evaluations`
- `core.classification_steps`
- `core.classification_results`
- `core.photos`
- `core.classified_segments`

Cascade behavior: `INSERT` only (one-shot creation)

## Dependencies

The module reuses infrastructure from the `upload` module:

- `ILogger` (from upload module)
- `ITransactionManager` (from upload module)
- TypeORM for persistence

## Testing Strategy

(To be implemented)

- **Unit tests**: Domain entities, value objects, mappers
- **Integration tests**: Use case with repository
- **E2E tests**: HTTP endpoint with real database

## Future Enhancements

Not in scope for the current implementation:

- Update evaluations
- Query/list evaluations
- Delete evaluations
- Partial evaluation creation
- Async processing
