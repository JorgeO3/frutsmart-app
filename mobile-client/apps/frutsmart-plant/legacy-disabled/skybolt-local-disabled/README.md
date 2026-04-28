# Skybolt - Cloud Upload Module for Expo

High-performance, production-ready cloud upload module for React Native / Expo applications. Optimized for uploading large files to Azure Blob Storage with chunking, background processing, and comprehensive error handling.

## Features

✅ **Chunked Uploads** - Split large files into manageable chunks  
✅ **Background Processing** - Uploads continue even when app is backgrounded (Android)  
✅ **Progress Tracking** - Real-time progress events with detailed metrics  
✅ **Automatic Retry** - Exponential backoff for transient failures  
✅ **SAS Token Management** - Automatic token refresh on expiry  
✅ **Network Constraints** - Configure WiFi-only or cellular uploads  
✅ **Type-Safe** - Fully typed with TypeScript and Kotlin  
✅ **MD5 Verification** - Integrity checks for uploaded data  

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Android | ✅ Fully Supported | WorkManager for background uploads |
| iOS | ❌ Out of Scope | Android-only release in current phase |
| Web | ❌ Out of Scope | Native Android module |

## Installation

```bash
npm install @yourorg/skybolt
# or
yarn add @yourorg/skybolt
```

## Quick Start

### 1. Configure the Module

```typescript
import * as Skybolt from '@yourorg/skybolt';

await Skybolt.configure({
  version: '1.0.0',
  environment: 'prod',
  backend: {
    baseUrl: 'https://api.yourapp.com',
    endpoints: {
      sasBatchPath: '/api/v1/upload/sas/batch',
      sasRefreshPath: '/api/v1/upload/sas/refresh'
    },
    defaultHeaders: {
      'X-API-Key': 'your-api-key'
    }
  },
  azure: {
    serviceVersion: '2023-11-03',
    sendBlockMd5: true,
    defaultChunkBytes: 4 * 1024 * 1024 // 4MB
  },
  concurrency: {
    maxParallelFiles: 2,
    maxParallelChunks: 4
  },
  retry: {
    maxRetries: 3,
    baseDelayMs: 500,
    maxDelayMs: 10_000
  }
});
```

### 2. Initialize and Start an Upload Session

```typescript
const sessionId = `upload-${Date.now()}`;

// Initialize session with files
await Skybolt.initializeSession({
  sessionId,
  items: [
    {
      clientItemId: 'file-1',
      localUri: 'file:///path/to/file.jpg',
      blobName: 'uploads/photo.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024000,
      metadata: { userId: '123' }
    }
  ],
  options: {
    maxParallelFiles: 3,
    maxParallelChunks: 4,
    chunkSizeBytes: 4 * 1024 * 1024,
    enableBackground: true,
    requiresWiFi: false,
    allowsCellular: true
  }
});

// Start upload
await Skybolt.startSession(sessionId);
```

### 3. Listen for Events

```typescript
const subscription = Skybolt.addUploadListener((event) => {
  switch (event.type) {
    case 'session:started':
      console.log('Upload started:', event.sessionId);
      break;
    
    case 'item:progress':
      const percent = (event.payload.bytesUploaded / event.payload.totalBytes) * 100;
      console.log(`Progress: ${percent.toFixed(1)}%`);
      break;
    
    case 'item:completed':
      console.log('File uploaded:', event.payload.clientItemId);
      break;
    
    case 'session:completed':
      console.log('All files uploaded!');
      break;
    
    case 'session:failed':
      console.error('Upload failed:', event.error);
      break;
  }
});

// Don't forget to unsubscribe
subscription.remove();
```

### 4. Control Upload Session

```typescript
// Pause upload
await Skybolt.pauseSession(sessionId);

// Resume upload
await Skybolt.resumeSession(sessionId);

// Cancel upload
await Skybolt.cancelSession(sessionId);

// Get progress
const progress = await Skybolt.getSessionProgress(sessionId);
console.log(`${progress.completedFiles}/${progress.totalFiles} files uploaded`);
```

## API Reference

### Configuration

#### `configure(settings: CloudUploadSettings): Promise<void>`

Configure Skybolt with cloud upload settings. Must be called before starting any uploads.

**Settings:**
- `version` - Configuration schema version
- `environment` - Deployment environment ('dev', 'stage', 'prod')
- `backend` - Backend API configuration
- `azure` - Azure Blob Storage settings
- `concurrency` - Upload concurrency limits
- `retry` - Retry strategy configuration

### Session Management

#### `initializeSession(config: SessionConfig): Promise<void>`

Initialize a new upload session with files to upload.

#### `startSession(sessionId: string): Promise<void>`

Start uploading files in a session.

#### `pauseSession(sessionId: string): Promise<void>`

Pause an active upload session.

#### `resumeSession(sessionId: string): Promise<void>`

Resume a paused upload session.

#### `cancelSession(sessionId: string): Promise<void>`

Cancel an upload session and clean up resources.

### Queries

#### `getSessionProgress(sessionId: string): Promise<SessionProgress | null>`

Get current progress information for a session.

**Returns:**
```typescript
{
  sessionId: string;
  status: 'idle' | 'preparing' | 'uploading' | 'paused' | 'completed' | 'failed';
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  transferRateBps?: number;
  estimatedCompletionMs?: number;
}
```

#### `listActiveSessions(): Promise<string[]>`

List all currently active session IDs.

### Utilities

#### `extractMD5FromFiles(fileUris: string[]): Promise<Md5HexResult[]>`

Extract MD5 hashes from local files for integrity verification.

#### `purgeCompletedSessions(olderThanMs?: number): Promise<number>`

Remove completed sessions older than specified time.

#### `cleanupTempFiles(): Promise<number>`

Clean up temporary files created during upload process.

### Events

Subscribe to upload events with `addUploadListener(listener)`:

- `session:started` - Session upload began
- `session:paused` - Session was paused
- `session:resumed` - Session was resumed
- `session:completed` - All files uploaded successfully
- `session:failed` - Session failed with error
- `item:progress` - Individual file progress update
- `item:completed` - File uploaded successfully
- `sas:requested` - SAS tokens requested from backend
- `sas:received` - SAS tokens received
- `sas:error` - SAS token error
- `debug` - Debug message

## React Hook

Use the `useSkybolt` hook for easier state management:

```typescript
import { useSkybolt } from '@yourorg/skybolt';

function UploadScreen() {
  const {
    isReady,
    status,
    files,
    overall,
    error,
    configure,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    addFiles,
    removeFile,
    reset
  } = useSkybolt();

  // Use the hook state and methods...
}
```

## Error Handling

All errors follow a consistent format:

```typescript
{
  code: string;    // e.g., 'E_NETWORK_TIMEOUT', 'E_AUTH_EXPIRED'
  message: string; // Human-readable error message
}
```

Common error codes:
- `E_AUTH_EXPIRED` - Authentication token expired
- `E_NETWORK_TIMEOUT` - Network request timed out
- `E_NETWORK_UNAVAILABLE` - No network connection
- `E_SAS_EXPIRED` - SAS token expired
- `E_AZURE_THROTTLED` - Azure throttled the request
- `E_FILE_NOT_FOUND` - Local file not found
- `E_CANCELED` - Operation was canceled

## Backend Requirements

Your backend must implement two endpoints:

### 1. SAS Batch Endpoint

`POST /api/v1/upload/sas/batch`

Request:
```json
{
  "sessionId": "upload-123",
  "items": [
    {
      "blobName": "uploads/photo.jpg",
      "contentType": "image/jpeg",
      "sizeBytes": 1024000
    }
  ]
}
```

Response:
```json
{
  "grants": [
    {
      "blobName": "uploads/photo.jpg",
      "sasUrl": "https://storage.blob.core.windows.net/container/photo.jpg?sv=2023-11-03&...",
      "expiresAtMs": 1699999999999
    }
  ]
}
```

### 2. SAS Refresh Endpoint

`POST /api/v1/upload/sas/refresh`

Request:
```json
{
  "sessionId": "upload-123",
  "blobName": "uploads/photo.jpg"
}
```

Response:
```json
{
  "sasUrl": "https://storage.blob.core.windows.net/container/photo.jpg?sv=2023-11-03&...",
  "expiresAtMs": 1699999999999
}
```

## Architecture

```
┌─────────────────────────────────────────────┐
│           React Native (JS)                 │
│  ┌─────────────────────────────────────┐   │
│  │   useSkybolt() Hook                 │   │
│  └──────────────┬──────────────────────┘   │
│                 │                            │
│  ┌──────────────▼──────────────────────┐   │
│  │   SkyboltModule.ts                  │   │
│  └──────────────┬──────────────────────┘   │
└─────────────────┼──────────────────────────┘
                  │ Bridge
┌─────────────────▼──────────────────────────┐
│         Native Module (Kotlin)             │
│  ┌──────────────────────────────────────┐  │
│  │   SkyboltModule.kt                   │  │
│  └──────────────┬───────────────────────┘  │
│                 │                           │
│  ┌──────────────▼───────────────────────┐  │
│  │   SkyboltManager (Singleton)         │  │
│  └──┬────────────────────────────────┬──┘  │
│     │                                │     │
│  ┌──▼──────────────┐    ┌───────────▼───┐ │
│  │ SessionRepository│    │ BlobUploader  │ │
│  │ - DataStore      │    │ - OkHttp      │ │
│  │ - Protobuf       │    │ - Azure API   │ │
│  └──────────────────┘    └───────────────┘ │
└────────────────────────────────────────────┘
```

## Performance Tips

1. **Chunk Size**: Use 4-8MB chunks for optimal performance
2. **Concurrency**: Limit parallel uploads based on network capacity
3. **WiFi Only**: Enable for large files to save cellular data
4. **MD5 Calculation**: Pre-calculate MD5 hashes to avoid duplicate work

## Troubleshooting

### Module not found error

Make sure you've rebuilt your native app after installing:
```bash
npx expo prebuild --clean
npx expo run:android
```

### Uploads fail immediately

Check that you've called `configure()` before starting uploads.

### iOS not working

iOS implementation is not yet available. The module currently supports Android only.

## Contributing

Contributions are welcome! See CONTRIBUTING.md for guidelines.

## License

MIT License - see LICENSE file for details.

## Credits

Developed by [Your Team Name]
