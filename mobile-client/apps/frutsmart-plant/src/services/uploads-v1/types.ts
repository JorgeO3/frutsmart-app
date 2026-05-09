import type {
  UploadJobPipelineStep,
  UploadJobStatus
} from "@adapters/repository/types";

export type UploadDomain = "plant" | "field";

export type UploadJobViewModel = {
  id: string;
  qualityAnalysisId: string | null;
  domain: "plant" | "field";
  skyboltSessionId: string | null;
  pipelineStep: UploadJobPipelineStep;
  status: UploadJobStatus;
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  lastError: string | null;
  attemptsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type UploadPauseReason =
  | "manual"
  | "user"
  | "network"
  | "auth"
  | "error";

export class UploadApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "UploadApiError";
  }
}

export type UploadJobLiveMetrics = {
  speedBytesPerSec: number | null;
  estimatedRemainingSeconds: number | null;
  pauseReason: UploadPauseReason | null;
  nextRetryAtMs: number | null;
  retryAfterMs: number | null;
  currentItemId: string | null;
  lastProgressAtMs: number | null;
};
