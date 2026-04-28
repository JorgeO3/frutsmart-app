import {NativeEventEmitter} from 'react-native';
import type {EventSubscription} from 'react-native';
import NativeSkybolt from '../NativeSkybolt';
import type {
  KeyValuePair,
  NativeCloudUploadSettings,
  NativeSessionConfig,
  NativeUploadEvent as NativeUploadEventSpec,
} from '../NativeSkybolt';
import type {
  AuthTokens,
  CloudUploadSettings,
  ItemProgress,
  Md5HexResult,
  NativeUploadEvent,
  PauseReason,
  PendingSession,
  SessionConfig,
  SessionProgress,
  UploadError,
  UploadEvent,
  UploadEventListener,
} from './Skybolt.types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Native module interface for Skybolt upload functionality.
 * Uses Expo Modules API (avoids deprecated NativeModule pattern).
 */

// ============================================================================
// Module Initialization
// ============================================================================

type SkyboltModule = NonNullable<typeof NativeSkybolt>;

function toPairs(record?: Record<string, string>): KeyValuePair[] | undefined {
  if (!record) {
    return undefined;
  }
  return Object.entries(record).map(([key, value]) => ({key, value}));
}

function toNativeSettings(settings: CloudUploadSettings): NativeCloudUploadSettings {
  return {
    ...settings,
    backend: {
      ...settings.backend,
      defaultHeaders: toPairs(settings.backend.defaultHeaders),
    },
  };
}

function toNativeSessionConfig(config: SessionConfig): NativeSessionConfig {
  return {
    ...config,
    items: config.items.map(item => ({
      ...item,
      metadata: toPairs(item.metadata),
    })),
  };
}

function toNativeAuthTokens(tokens: AuthTokens): AuthTokens {
  return {
    ...tokens,
    accessExpiresAtMs: tokens.accessExpiresAtMs,
    refreshExpiresAtMs: tokens.refreshExpiresAtMs,
  };
}

function toNativeEvent(native: NativeUploadEventSpec): NativeUploadEvent {
  return native as NativeUploadEvent;
}

// Configuration
type SkyboltApi = {
  // Configuration
  configure(settings: NativeCloudUploadSettings): Promise<void>;

  // Session management
  initializeSession(config: NativeSessionConfig): Promise<void>;
  startSession(sessionId: string): Promise<void>;
  pauseSession(sessionId: string): Promise<void>;
  resumeSession(sessionId: string): Promise<void>;
  cancelSession(sessionId: string): Promise<void>;

  // Session queries
  getSessionProgress(sessionId: string): Promise<SessionProgress | null>;
  listActiveSessions(): Promise<string[]>;
  listPendingSessions(): Promise<PendingSession[]>;
  resumeAllPending(): Promise<number>;

  // Auth management
  notifyAuthRefreshed(): Promise<void>;
  setAuthTokens(tokens: AuthTokens): Promise<void>;
  getValidAccessToken(): Promise<string | null>;
  clearAuthTokens(): Promise<void>;

  // Maintenance
  purgeCompletedSessions(olderThanMs?: number): Promise<number>;
  cleanupTempFiles(): Promise<number>;

  // Utilities
  extractMD5FromFiles(fileUris: string[]): Promise<Md5HexResult[]>;
  addListener(eventType: string): void;
  removeListeners(count: number): void;
};

let skyboltModule: SkyboltModule | null;

try {
  skyboltModule = NativeSkybolt;
} catch {
  skyboltModule = null;
}

/**
 * Check if native module is available.
 * Use this before calling module functions to handle graceful degradation.
 */
export const isAvailable = !!skyboltModule;

/**
 * Assert that native module is loaded.
 * @throws Error if module is not available
 */
function assertModule(): SkyboltApi {
  if (!skyboltModule) {
    throw new Error(
      '[Skybolt] Native module not found. Did you build the app?'
    );
  }
  return skyboltModule as unknown as SkyboltApi;
}

// ============================================================================
// Event Conversion
// ============================================================================

/**
 * Ensure required field exists in native event.
 * @throws Error if value is null or undefined
 */
const mustExist = <T>(v: T | null | undefined, label: string): T => {
  if (v == null) {
    throw new Error(`[Skybolt] Missing ${label} in native event`);
  }
  return v;
};

/**
 * Convert native upload event to standardized UploadEvent format.
 * Handles all event types and normalizes error information.
 */
export function toUploadEvent(native: NativeUploadEvent): UploadEvent {
  const eventType = native.type;

  switch (eventType) {
    // Simple session events (sin payload extra)
    case 'session:started':
    case 'session:resumed':
    case 'session:completed':
    case 'session:canceled':
      return {
        type: eventType,
        sessionId: mustExist(native.sessionId, 'sessionId'),
      };

    // Session paused with reason
    case 'session:paused':
      return {
        type: eventType,
        sessionId: mustExist(native.sessionId, 'sessionId'),
        reason: (native.reason ?? 'user') as PauseReason,
      };

    // Session failure
    case 'session:failed':
      return {
        type: eventType,
        sessionId: mustExist(native.sessionId, 'sessionId'),
        error: {
          code: native.errorCode ?? 'E_UNKNOWN',
          message: native.errorMessage ?? 'Unknown error',
        },
      };

    // Item completion
    case 'item:completed':
      return {
        type: eventType,
        sessionId: mustExist(native.sessionId, 'sessionId'),
        payload: {
          clientItemId: mustExist(native.clientItemId, 'clientItemId'),
        },
      };

    // Item failure
    case 'item:failed':
      return {
        type: eventType,
        sessionId: mustExist(native.sessionId, 'sessionId'),
        payload: {
          clientItemId: mustExist(native.clientItemId, 'clientItemId'),
          error: {
            code: native.errorCode ?? 'E_UNKNOWN',
            message: native.errorMessage ?? 'Unknown error',
          },
        },
      };

    // Auth required (sessionId puede venir null)
    case 'auth:required':
      return {
        type: eventType,
        sessionId: native.sessionId ?? undefined,
        pendingSessions: native.pendingSessions ?? [],
      };

    // Specific error events (sin retry extra)
    case 'error:forbidden':
    case 'error:contract':
    case 'error:checksum':
    case 'error:file-access':
      return {
        type: eventType,
        sessionId: mustExist(native.sessionId, 'sessionId'),
        payload: {
          clientItemId: mustExist(native.clientItemId, 'clientItemId'),
          message: native.errorMessage ?? native.message ?? 'Error occurred',
        },
      };

    // Throttling / rate limiting
    case 'error:rate-limited':
    case 'error:throttled':
      return {
        type: eventType,
        sessionId: mustExist(native.sessionId, 'sessionId'),
        payload: {
          clientItemId: mustExist(native.clientItemId, 'clientItemId'),
          message: native.errorMessage ?? native.message ?? 'Throttled',
          retryAfterMs: native.retryAfterMs ?? 0,
        },
      };

    // Network error
    case 'error:network':
      return {
        type: eventType,
        sessionId: mustExist(native.sessionId, 'sessionId'),
        payload: {
          clientItemId: mustExist(native.clientItemId, 'clientItemId'),
          message: native.errorMessage ?? native.message ?? 'Network error',
          attempt: native.attempt ?? 0,
        },
      };

    // Fatal error (error:fatal)
    case 'error:fatal':
      return {
        type: 'error:fatal',
        sessionId: mustExist(native.sessionId, 'sessionId'),
        payload: {
          message: native.errorMessage ?? native.message ?? 'Fatal error',
          // necesitas stack?: string en NativeUploadEvent para esto
          stack: native.stack,
        },
      };

    // Item progress with detailed metrics
    case 'item:progress': {
      const payload: ItemProgress = {
        sessionId: mustExist(native.sessionId, 'sessionId'),
        clientItemId: mustExist(native.clientItemId, 'clientItemId'),
        bytesUploaded: native.bytesUploaded ?? 0,
        totalBytes: native.totalBytes ?? 0,
        blockIndex: native.blockIndex,
        blockSize: native.blockSize,
        retries: native.retries,
      };
      return {
        type: eventType,
        sessionId: payload.sessionId,
        payload,
      };
    }

    // SAS token events
    case 'sas:requested':
    case 'sas:received':
      return {
        type: eventType,
        sessionId: mustExist(native.sessionId, 'sessionId'),
        payload: {
          blobNames: native.blobNames ?? [],
        },
      };

    // SAS error
    case 'sas:error': {
      const error: UploadError = {
        code: native.errorCode ?? 'E_SAS',
        message: native.errorMessage ?? 'SAS error',
      };
      return {
        type: eventType,
        sessionId: mustExist(native.sessionId, 'sessionId'),
        error,
      };
    }

    // Upload state change (app restart, etc.)
    case 'upload:state-change':
      return {
        type: 'upload:state-change',
        sessionId: mustExist(native.sessionId, 'sessionId'),
        newState: mustExist(native.newState, 'newState'),
        oldState: mustExist(native.oldState, 'oldState'),
        // reason puede ser algo como "app_restart" o "network"
        reason: native.reason,
      };

    // Recovery complete
    case 'upload:recovery-complete':
      return {
        type: 'upload:recovery-complete',
        payload: {
          totalScanned: native.totalScanned ?? 0,
          pendingCount: native.pendingCount ?? 0,
        },
      };

    // Resume-all complete
    case 'upload:resume-all-complete':
      return {
        type: 'upload:resume-all-complete',
        payload: {
          totalPending: native.totalPending ?? 0,
          resumed: native.resumed ?? 0,
          failed: native.failed ?? 0,
        },
      };

    // Debug messages
    case 'debug':
      return {
        type: eventType,
        sessionId: native.sessionId ?? undefined,
        message: native.message ?? '',
      };

    // Unknown event types (dev error handling)
    default: {
      if (__DEV__) {
        throw new Error(
          `[Skybolt] Unknown native event type: ${String(eventType)}`
        );
      }
      return {
        type: 'debug',
        sessionId: native.sessionId ?? undefined,
        message: `Unknown event: ${String(eventType)}`,
      };
    }
  }
}

// ============================================================================
// Event Subscription API
// ============================================================================

export type { EventSubscription as Subscription };

/**
 * Subscribe to upload events from native module.
 * @param listener - Callback to handle upload events
 * @returns Subscription object with remove() method
 * 
 * @example
 * const subscription = addUploadListener((event) => {
 *   console.log('Upload event:', event);
 * });
 * // Later...
 * subscription.remove();
 */
export function addUploadListener(
  listener: UploadEventListener
): EventSubscription {
  const module = assertModule();
  const emitter = new NativeEventEmitter(module as never);

  return emitter.addListener('onUploadEvent', (nativeEvent: NativeUploadEventSpec) => {
    const native = toNativeEvent(nativeEvent);
    try {
      listener(toUploadEvent(native));
    } catch (error) {
      console.error('[Skybolt] Event conversion error:', error, native);
    }
  }) as EventSubscription;
}

// ============================================================================
// Configuration Utilities
// ============================================================================

/**
 * Apply default values to upload settings.
 * Validates required fields and sets sensible defaults.
 */
export async function applyDefaults(
  settings: CloudUploadSettings
): Promise<CloudUploadSettings> {
  const config = { ...settings };

  // Azure defaults
  config.azure ??= {
    serviceVersion: '2023-11-03',
    sendBlockMd5: true,
    defaultChunkBytes: 4 * 1024 * 1024, // 4MB
  };

  // Ensure minimum chunk size (64KB)
  if (config.azure.defaultChunkBytes < 64 * 1024) {
    config.azure.defaultChunkBytes = 64 * 1024;
  }

  // Concurrency defaults
  config.concurrency ??= {};
  config.concurrency.maxParallelFiles ??= 2;
  config.concurrency.maxParallelChunks ??= 4;

  // Retry defaults
  config.retry ??= {};
  config.retry.maxRetries ??= 3;
  config.retry.baseDelayMs ??= 500;
  config.retry.maxDelayMs ??= 10_000;

  // Validate required fields
  if (!config.backend?.baseUrl) {
    throw new Error('[Skybolt] backend.baseUrl is required');
  }

  const existBackendEndpoints =
    config.backend.endpoints?.sasBatchPath &&
    config.backend.endpoints?.sasRefreshPath;

  if (!existBackendEndpoints) {
    throw new Error(
      '[Skybolt] backend.endpoints.sasBatchPath and sasRefreshPath are required'
    );
  }

  return config;
}

// ============================================================================
// Configuration API
// ============================================================================

/**
 * Configure Skybolt with upload settings.
 * Must be called before starting any uploads.
 */
export async function configure(settings: CloudUploadSettings): Promise<void> {
  const configWithDefaults = await applyDefaults(settings);
  return assertModule().configure(toNativeSettings(configWithDefaults));
}

// ============================================================================
// Session Management API
// ============================================================================

/**
 * Initialize a new upload session with specified configuration.
 */
export async function initializeSession(config: SessionConfig): Promise<void> {
  return assertModule().initializeSession(toNativeSessionConfig(config));
}

/**
 * Start an initialized upload session.
 */
export async function startSession(sessionId: string): Promise<void> {
  if (!sessionId) {
    throw new Error('[Skybolt] sessionId required');
  }
  return assertModule().startSession(sessionId);
}

/**
 * Pause an active upload session.
 */
export async function pauseSession(sessionId: string): Promise<void> {
  if (!sessionId) {
    throw new Error('[Skybolt] sessionId required');
  }
  return assertModule().pauseSession(sessionId);
}

/**
 * Resume a paused upload session.
 */
export async function resumeSession(sessionId: string): Promise<void> {
  if (!sessionId) {
    throw new Error('[Skybolt] sessionId required');
  }
  return assertModule().resumeSession(sessionId);
}

/**
 * Cancel an active upload session.
 * This will stop all uploads and clean up resources.
 */
export async function cancelSession(sessionId: string): Promise<void> {
  if (!sessionId) {
    throw new Error('[Skybolt] sessionId required');
  }
  return assertModule().cancelSession(sessionId);
}

// ============================================================================
// Session Query API
// ============================================================================

/**
 * Get current progress information for a session.
 * @returns SessionProgress or null if session not found
 */
export async function getSessionProgress(
  sessionId: string
): Promise<SessionProgress | null> {
  if (!sessionId) {
    throw new Error('[Skybolt] sessionId required');
  }
  return assertModule().getSessionProgress(sessionId);
}

/**
 * List all currently active session IDs.
 */
export async function listActiveSessions(): Promise<string[]> {
  return assertModule().listActiveSessions();
}

/**
 * List all pending sessions (PAUSED or PREPARING state).
 * Useful for showing recoverable uploads in UI after app restart.
 * @returns Array of session details with progress information
 */
export async function listPendingSessions(): Promise<Array<{
  sessionId: string;
  status: string;
  uploadedBytes: number;
  totalBytes: number;
  itemCount: number;
  startedAt: number;
  endedAt: number;
}>> {
  return assertModule().listPendingSessions();
}

/**
 * Resume all pending sessions (PAUSED or PREPARING state).
 * Useful for batch resuming after app restart or user action.
 * @returns Number of sessions resumed
 */
export async function resumeAllPending(): Promise<number> {
  return assertModule().resumeAllPending();
}

// ============================================================================
// Auth Management API
// ============================================================================

/**
 * Notify native module that authentication has been refreshed.
 * Triggers auto-resume for sessions paused due to auth expiration.
 */
export async function notifyAuthRefreshed(): Promise<void> {
  return assertModule().notifyAuthRefreshed();
}

export async function setAuthTokens(tokens: AuthTokens): Promise<void> {
  return assertModule().setAuthTokens(toNativeAuthTokens(tokens));
}

export async function getValidAccessToken(): Promise<string | null> {
  return assertModule().getValidAccessToken();
}

export async function clearAuthTokens(): Promise<void> {
  return assertModule().clearAuthTokens();
}

// ============================================================================
// Maintenance API
// ============================================================================

/**
 * Remove completed sessions older than specified time.
 * @param olderThanMs - Time threshold in milliseconds (default: 0 = all completed)
 * @returns Number of sessions purged
 */
export async function purgeCompletedSessions(
  olderThanMs: number = 0
): Promise<number> {
  if (olderThanMs < 0) {
    olderThanMs = 0;
  }
  return assertModule().purgeCompletedSessions(olderThanMs);
}

/**
 * Clean up temporary files created during upload process.
 * @returns Number of files cleaned
 */
export async function cleanupTempFiles(): Promise<number> {
  return assertModule().cleanupTempFiles();
}

// ============================================================================
// Utility API
// ============================================================================

/**
 * Extract MD5 hashes from local files.
 * @param fileUris - Array of local file URIs
 * @returns Array of MD5 results (hex strings)
 */
export async function extractMD5FromFiles(
  fileUris: string[]
): Promise<Md5HexResult[]> {
  if (!Array.isArray(fileUris) || fileUris.length === 0) {
    return [];
  }
  return assertModule().extractMD5FromFiles(fileUris);
}
