import type { CloudUploadSettings } from "skybolt";
import { apiBaseUrl, oidcConfig } from "./authConfig";


export function getDefaultSkyboltUploadConfig(): CloudUploadSettings {
  return {
    version: '1.0',
    environment: 'dev',
    backend: {
      auth: {
        clientId: oidcConfig.clientId,
        scope: oidcConfig.scopes.join(' '),
        tokenEndpoint: oidcConfig.tokenEndpoint,
        clockSkewMs: 60000,
      },
      baseUrl: `${apiBaseUrl}/api/v1`,
      endpoints: {
        sasBatchPath: '/upload/sessions/{sessionId}/sas-batch',
        sasRefreshPath: '/upload/sessions/{sessionId}/sas/refresh',
      },
    },
    azure: {
      serviceVersion: '2023-11-03',
      sendBlockMd5: true,
      defaultChunkBytes: 4 * 1024 * 1024, // 4MB chunks
    },
    concurrency: {
      maxParallelFiles: 3,
      maxParallelChunks: 4,
    },
    retry: {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
    },
  };
}
