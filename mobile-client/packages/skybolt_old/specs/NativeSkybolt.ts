import type {CodegenTypes, TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export type KeyValuePair = {
  key: string;
  value: string;
};

export type NativeBackendAuth = {
  tokenEndpoint: string;
  clientId: string;
  scope: string;
  clockSkewMs?: number;
};

export type NativeBackendEndpoints = {
  sasBatchPath: string;
  sasRefreshPath: string;
};

export type NativeBackendConfig = {
  baseUrl: string;
  defaultHeaders?: Array<KeyValuePair>;
  endpoints: NativeBackendEndpoints;
  auth: NativeBackendAuth;
};

export type NativeAzureConfig = {
  serviceVersion: string;
  sendBlockMd5: boolean;
  defaultChunkBytes: number;
};

export type NativeConcurrencyConfig = {
  maxParallelFiles?: number;
  maxParallelChunks?: number;
};

export type NativeRetryConfig = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

export type NativeCloudUploadSettings = {
  version: string;
  environment: 'dev' | 'stage' | 'prod';
  backend: NativeBackendConfig;
  azure: NativeAzureConfig;
  concurrency?: NativeConcurrencyConfig;
  retry?: NativeRetryConfig;
};

export type NativeUploadItem = {
  clientItemId: string;
  localUri: string;
  blobName: string;
  contentType: string;
  sizeBytes: number;
  md5Hex?: string;
  blockMd5B64?: Array<string>;
  metadata?: Array<KeyValuePair>;
};

export type NativeStartOptions = {
  maxParallelFiles?: number;
  maxParallelChunks?: number;
  chunkSizeBytes?: number;
  enableBackground?: boolean;
  requiresWiFi?: boolean;
  allowsCellular?: boolean;
  lowPowerModeOkay?: boolean;
};

export type NativeSessionConfig = {
  sessionId: string;
  items: Array<NativeUploadItem>;
  options?: NativeStartOptions;
};

export type NativeSessionProgress = {
  sessionId: string;
  status: string;
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  transferRateBps?: number;
  estimatedCompletionMs?: number;
};

export type NativePendingSession = {
  sessionId: string;
  status: string;
  uploadedBytes: number;
  totalBytes: number;
  itemCount: number;
  startedAt: number;
  endedAt: number;
};

export type NativeAuthTokens = {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  accessExpiresAtMs: number;
  refreshExpiresAtMs: number;
};

export type NativeMd5HexResult = {
  uri: string;
  md5Hex: string;
  sizeBytes: number;
  contentType?: string;
  lastModifiedMs?: number;
};

export type NativeUploadEvent = {
  type: string;
  sessionId?: string;
  clientItemId?: string;
  bytesUploaded?: number;
  totalBytes?: number;
  blockIndex?: number;
  blockSize?: number;
  retries?: number;
  retryAfterMs?: number;
  attempt?: number;
  pendingSessions?: Array<string>;
  blobNames?: Array<string>;
  errorCode?: string;
  errorMessage?: string;
  message?: string;
  reason?: string;
  stack?: string;
  newState?: string;
  oldState?: string;
  totalScanned?: number;
  pendingCount?: number;
  totalPending?: number;
  resumed?: number;
  failed?: number;
};

export interface Spec extends TurboModule {
  configure(settings: NativeCloudUploadSettings): Promise<void>;
  initializeSession(config: NativeSessionConfig): Promise<void>;
  startSession(sessionId: string): Promise<void>;
  pauseSession(sessionId: string): Promise<void>;
  resumeSession(sessionId: string): Promise<void>;
  cancelSession(sessionId: string): Promise<void>;
  getSessionProgress(sessionId: string): Promise<NativeSessionProgress | null>;
  listActiveSessions(): Promise<Array<string>>;
  listPendingSessions(): Promise<Array<NativePendingSession>>;
  resumeAllPending(): Promise<number>;
  notifyAuthRefreshed(): Promise<void>;
  setAuthTokens(tokens: NativeAuthTokens): Promise<void>;
  getValidAccessToken(): Promise<string | null>;
  clearAuthTokens(): Promise<void>;
  purgeCompletedSessions(olderThanMs: number): Promise<number>;
  cleanupTempFiles(): Promise<number>;
  extractMD5FromFiles(fileUris: Array<string>): Promise<Array<NativeMd5HexResult>>;
  readonly onUploadEvent: CodegenTypes.EventEmitter<NativeUploadEvent>;
}

export default TurboModuleRegistry.get<Spec>('NativeSkybolt');
