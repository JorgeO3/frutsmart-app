/**
 * Type definitions for the Skybolt cloud upload module.
 * Provides comprehensive typing for configuration, session management,
 * progress tracking, and event handling.
 * 
 * @module Skybolt.types
 */

// ============================================================================
// Session Status
// ============================================================================

/**
 * Upload session lifecycle states.
 * - idle: No active upload
 * - preparing: Initializing session resources
 * - uploading: Active file transfer
 * - paused: Temporarily suspended by user
 * - completed: All files uploaded successfully
 * - failed: Upload terminated due to error
 * - canceled: Upload terminated by user
 */
export type UploadStatus =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'canceled';

/**
 * Reason why a session was paused.
 * - network: Paused due to network unavailability
 * - auth: Paused due to authentication expiration
 * - user: Paused by user action
 */
export type PauseReason = 'network' | 'auth' | 'user' | 'error';

/**
 * Individual item/file status within a session.
 * - pending: Item queued, not started yet
 * - uploading: Currently uploading chunks
 * - completed: Upload finished successfully
 * - failed: Upload failed with error
 * - canceled: Upload was canceled by user
 */
export type ItemStatus =
  | 'pending'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'canceled';

/**
 * Error code constants for type-safe error handling.
 * Maps to Android ErrorMapper codes.
 */
export type ErrorCode =
  // Auth errors
  | 'E_AUTH_EXPIRED'
  | 'E_AUTH_FORBIDDEN'
  | 'E_AUTH_UNAUTHORIZED'
  // Network errors
  | 'E_NETWORK_UNAVAILABLE'
  | 'E_NETWORK_TIMEOUT'
  | 'E_NETWORK_IO'
  // Backend errors
  | 'E_BACKEND_UNAVAILABLE'
  | 'E_BACKEND_TIMEOUT'
  | 'E_BACKEND_SERVER'
  | 'E_BACKEND_RATE_LIMITED'
  | 'E_BACKEND_BAD_REQUEST'
  | 'E_BACKEND_NOT_FOUND'
  | 'E_BACKEND_CONFLICT'
  | 'E_BACKEND_BAD_RESPONSE'
  // SAS errors
  | 'E_SAS_EXPIRED'
  | 'E_SAS_ACQUIRE_FAILED'
  // Azure errors
  | 'E_AZURE_THROTTLED'
  | 'E_AZURE_SERVER'
  | 'E_AZURE_BAD_MD5'
  | 'E_AZURE_PUT_BLOCK_FAILED'
  | 'E_AZURE_PUT_BLOCKLIST_FAILED'
  // File errors
  | 'E_FILE_IO'
  | 'E_FILE_NOT_FOUND'
  | 'E_FILE_TOO_LARGE'
  // State errors
  | 'E_CANCELED'
  | 'E_BAD_STATE'
  | 'E_CONTRACT_MISMATCH'
  | 'E_UNKNOWN'
  | 'E_SAS';

// ============================================================================
// File Metadata
// ============================================================================

/**
 * MD5 hash calculation result for a file.
 * Used for integrity verification during upload.
 */
export type Md5HexResult = {
  /** Local file URI */
  uri: string;
  /** MD5 hash in hexadecimal format */
  md5Hex: string;
  /** File size in bytes */
  sizeBytes: number;
  /** MIME content type (optional) */
  contentType?: string;
  /** Last modified timestamp in milliseconds (optional) */
  lastModifiedMs?: number;
};

// ============================================================================
// Configuration
// ============================================================================

/**
 * Environment configuration for deployment stages.
 */
export type Environment = 'dev' | 'stage' | 'prod';

/**
 * Backend service configuration.
 * Defines API endpoints and connection settings.
 */
export type BackendConfig = {
  /** Base URL for backend API */
  baseUrl: string;
  /** Default HTTP headers for all requests */
  defaultHeaders?: Record<string, string>;
  /** API endpoint paths */
  endpoints: {
    /** Path for batch SAS token requests */
    sasBatchPath: string;
    /** Path for SAS token refresh */
    sasRefreshPath: string;
  };
  auth: {
    /** Token endpoint URL for authentication */
    tokenEndpoint: string;
    /** Client ID for OAuth2 authentication */
    clientId: string;
    /** Scopes for OAuth2 authentication */
    scope: string;
    /** Margin in milliseconds to avoid token expiration at limit */
    clockSkewMs?: number;
  }
};

/**
 * Azure Blob Storage specific settings.
 */
export type AzureConfig = {
  /** Azure Storage API version (e.g., '2023-11-03') */
  serviceVersion: string;
  /** Include MD5 hash for each block upload */
  sendBlockMd5: boolean;
  /** Default chunk size in bytes (minimum 64KB) */
  defaultChunkBytes: number;
};

/**
 * Upload concurrency limits.
 * Controls parallel operations to balance speed and resource usage.
 */
export type ConcurrencyConfig = {
  /** Maximum files uploading simultaneously */
  maxParallelFiles?: number;
  /** Maximum chunks per file uploading simultaneously */
  maxParallelChunks?: number;
};

/**
 * Retry strategy configuration.
 * Implements exponential backoff for transient failures.
 */
export type RetryConfig = {
  /** Maximum retry attempts per operation */
  maxRetries?: number;
  /** Initial delay between retries (milliseconds) */
  baseDelayMs?: number;
  /** Maximum delay between retries (milliseconds) */
  maxDelayMs?: number;
};

/**
 * Complete cloud upload configuration.
 * Main settings object passed to configure() method.
 */
export type CloudUploadSettings = {
  /** Configuration schema version */
  version: string;
  /** Deployment environment */
  environment: Environment;
  /** Backend API configuration */
  backend: BackendConfig;
  /** Azure Storage settings */
  azure: AzureConfig;
  /** Concurrency limits (optional) */
  concurrency?: ConcurrencyConfig;
  /** Retry strategy (optional) */
  retry?: RetryConfig;
};

// ============================================================================
// Upload Items
// ============================================================================

/**
 * File descriptor for upload session.
 * Represents a single file to be uploaded.
 */
export type UploadItem = {
  /** Client-side unique identifier for this file */
  clientItemId: string;
  /** Local file system URI (file://, content://, etc.) */
  localUri: string;
  /** Destination blob name in cloud storage */
  blobName: string;
  /** MIME content type */
  contentType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** MD5 hash of entire file (optional) */
  md5Hex?: string;
  /** MD5 hashes of individual blocks in Base64 (optional) */
  blockMd5B64?: string[];
  /** Custom metadata key-value pairs (optional) */
  metadata?: Record<string, string>;
};

// ============================================================================
// Session Management
// ============================================================================

/**
 * Session initialization options.
 * Controls upload behavior and resource usage.
 */
export type StartOptions = {
  /** Maximum files uploading simultaneously */
  maxParallelFiles?: number;
  /** Maximum chunks per file uploading simultaneously */
  maxParallelChunks?: number;
  /** Chunk size in bytes for splitting files */
  chunkSizeBytes?: number;
  /** Allow uploads to continue in background (iOS/Android) */
  enableBackground?: boolean;
  /** Only upload when connected to WiFi */
  requiresWiFi?: boolean;
  /** Allow uploads on cellular connection */
  allowsCellular?: boolean;
  /** Allow uploads when device is in low power mode */
  lowPowerModeOkay?: boolean;
};

/**
 * Complete session configuration.
 * Passed to initializeSession() to create new upload session.
 */
export type SessionConfig = {
  /** Unique session identifier */
  sessionId: string;
  /** Files to upload in this session */
  items: UploadItem[];
  /** Session options (optional) */
  options?: StartOptions;
};

/**
 * Session-level progress information.
 * Provides aggregate statistics for entire upload session.
 */
export type SessionProgress = {
  /** Session identifier */
  sessionId: string;
  /** Current session status */
  status: UploadStatus;
  /** Total number of files in session */
  totalFiles: number;
  /** Number of completed files */
  completedFiles: number;
  /** Total bytes across all files */
  totalBytes: number;
  /** Total bytes uploaded so far */
  uploadedBytes: number;
  /** Current transfer rate in bytes per second (optional) */
  transferRateBps?: number;
  /** Estimated time to completion in milliseconds (optional) */
  estimatedCompletionMs?: number;
};

/**
 * Individual file progress information.
 * Tracks upload progress for a specific file.
 */
export type ItemProgress = {
  /** Parent session identifier */
  sessionId: string;
  /** Client item identifier */
  clientItemId: string;
  /** Bytes uploaded for this file */
  bytesUploaded: number;
  /** Total bytes for this file */
  totalBytes: number;
  /** Current block/chunk index being uploaded (optional) */
  blockIndex?: number;
  /** Size of current block in bytes (optional) */
  blockSize?: number;
  /** Number of retry attempts for current operation (optional) */
  retries?: number;
  /** Current item status (optional) */
  status?: ItemStatus;
};

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Upload error descriptor.
 * Provides structured error information for troubleshooting.
 */
export type UploadError = {
  /** Error code (typed constant from ErrorCode) */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
};

// ============================================================================
// Events
// ============================================================================

export const NativeEventType = {
  SessionStarted: 'session:started',
  SessionPaused: 'session:paused',
  SessionResumed: 'session:resumed',
  SessionCompleted: 'session:completed',
  SessionCanceled: 'session:canceled',
  SessionFailed: 'session:failed',

  ItemProgress: 'item:progress',
  ItemCompleted: 'item:completed',
  ItemFailed: 'item:failed',

  AuthRequired: 'auth:required',

  ErrorForbidden: 'error:forbidden',
  ErrorRateLimited: 'error:rate-limited',
  ErrorThrottled: 'error:throttled',
  ErrorContract: 'error:contract',
  ErrorNetwork: 'error:network',
  ErrorChecksum: 'error:checksum',
  ErrorFileAccess: 'error:file-access',
  ErrorFatal: 'error:fatal',

  SasRequested: 'sas:requested',
  SasReceived: 'sas:received',
  SasError: 'sas:error',

  UploadStateChange: 'upload:state-change',
  UploadRecoveryComplete: 'upload:recovery-complete',
  UploadResumeAllComplete: 'upload:resume-all-complete',

  Debug: 'debug',
} as const;

/**
 * Native event types emitted by the native module.
 * Low-level events before type conversion.
 */
export type NativeUploadEventType =
  (typeof NativeEventType)[keyof typeof NativeEventType];

/**
 * Raw native upload event from the native module.
 * Fields are optional as they vary by event type.
 */
export type NativeUploadEvent = {
  /** Event type identifier */
  type: NativeUploadEventType;
  /** Session identifier (optional) */
  sessionId?: string;
  /** Client item identifier (optional) */
  clientItemId?: string;
  /** Bytes uploaded (optional) */
  bytesUploaded?: number;
  /** Total bytes (optional) */
  totalBytes?: number;
  /** Block index (optional) */
  blockIndex?: number;
  /** Block size (optional) */
  blockSize?: number;
  /** Retry count (optional) */
  retries?: number;
  /** Retry after milliseconds (optional) */
  retryAfterMs?: number;
  /** Retry attempt number (optional) */
  attempt?: number;
  /** Pending sessions (optional, for auth:required) */
  pendingSessions?: string[];
  /** Blob names array (optional) */
  blobNames?: string[];
  /** Error code (optional) */
  errorCode?: ErrorCode;
  /** Error message (optional) */
  errorMessage?: string;
  /** Debug message (optional) */
  message?: string;
  /** Pause reason (optional) */
  reason?: PauseReason;
  /** Stack trace (optional) */
  stack?: string; // error:fatal
  /** New state (optional) */
  newState?: string; // upload:state-change
  /** Old state (optional) */
  oldState?: string; // upload:state-change
  /** Total scanned (optional) */
  totalScanned?: number; // upload:recovery-complete
  /** Pending count (optional) */
  pendingCount?: number; // upload:recovery-complete
  /** Total pending (optional) */
  totalPending?: number; // upload:resume-all-complete
  /** Resumed (optional) */
  resumed?: number; // upload:resume-all-complete
  /** Failed (optional) */
  failed?: number; // upload:resume-all-complete
};

/**
 * High-level typed upload events for application use.
 * Discriminated union for type-safe event handling.
 * 
 * @example
 * addUploadListener((event) => {
 *   switch (event.type) {
 *     case 'session:started':
 *       console.log('Session started:', event.sessionId);
 *       break;
 *     case 'item:progress':
 *       console.log('Progress:', event.payload.bytesUploaded);
 *       break;
 *   }
 * });
 */
export type UploadEvent =
  // Session lifecycle events
  | { type: 'session:started'; sessionId: string }
  | { type: 'session:paused'; sessionId: string; reason: PauseReason }
  | { type: 'session:resumed'; sessionId: string }
  | { type: 'session:completed'; sessionId: string }
  | { type: 'session:canceled'; sessionId: string }
  | { type: 'session:failed'; sessionId: string; error: UploadError }

  // Item events
  | { type: 'item:progress'; sessionId: string; payload: ItemProgress }
  | { type: 'item:completed'; sessionId: string; payload: { clientItemId: string } }
  | { type: 'item:failed'; sessionId: string; payload: { clientItemId: string; error: UploadError } }

  // Auth events
  | { type: 'auth:required'; sessionId?: string; pendingSessions: string[] }

  // Specific error events
  | { type: 'error:forbidden'; sessionId: string; payload: { clientItemId: string; message: string } }
  | { type: 'error:rate-limited'; sessionId: string; payload: { clientItemId: string; message: string; retryAfterMs: number } }
  | { type: 'error:throttled'; sessionId: string; payload: { clientItemId: string; message: string; retryAfterMs: number } }
  | { type: 'error:contract'; sessionId: string; payload: { clientItemId: string; message: string } }
  | { type: 'error:network'; sessionId: string; payload: { clientItemId: string; message: string; attempt: number } }
  | { type: 'error:checksum'; sessionId: string; payload: { clientItemId: string; message: string } }
  | { type: 'error:file-access'; sessionId: string; payload: { clientItemId: string; message: string } }
  | { type: 'error:fatal'; sessionId: string; payload: { message: string; stack?: string } }

  // SAS token events
  | { type: 'sas:requested'; sessionId: string; payload: { blobNames: string[] } }
  | { type: 'sas:received'; sessionId: string; payload: { blobNames: string[] } }
  | { type: 'sas:error'; sessionId: string; error: UploadError }

  // Upload meta-events
  | { type: 'upload:state-change'; sessionId: string; newState: string; oldState: string; reason?: string } // State type 'PAUSED' | 'RESUMED' | 'CANCELED' | etc.
  | { type: 'upload:recovery-complete'; payload: { totalScanned: number; pendingCount: number } }
  | { type: 'upload:resume-all-complete'; payload: { totalPending: number; resumed: number; failed: number } }

  // Debug events
  | { type: 'debug'; sessionId?: string; message: string };

/**
 * Event listener callback type.
 * Subscribe to upload events with this signature.
 */
export type UploadEventListener = (event: UploadEvent) => void;

/**
 * Expo Modules event map.
 * Internal type for native event bridge.
 */
export type SkyboltModuleEvents = {
  onUploadEvent: (event: NativeUploadEvent) => void;
};

/**
 * Valid event names for the Skybolt module.
 */
export type SkyboltModuleEventName = keyof SkyboltModuleEvents;

/**
 * Authentication tokens structure.
 * Used for managing session authentication.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  accessExpiresAtMs: number;
  refreshExpiresAtMs: number;
}

export interface PendingSession {
  sessionId: string;
  status: string;
  uploadedBytes: number;
  totalBytes: number;
  itemCount: number;
  startedAt: number;
  endedAt: number;
}
