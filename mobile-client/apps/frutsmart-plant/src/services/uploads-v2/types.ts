/**
 * Upload System v2 — Types
 *
 * Tipos compartidos entre la máquina de estados, el store, los adaptadores
 * y la UI. Ninguna lógica de negocio aquí.
 */

import type { UploadJobRow, UploadJobPipelineStep, UploadJobStatus } from "@adapters/repository/types";

// ---------------------------------------------------------------------------
// Dominio
// ---------------------------------------------------------------------------

export type UploadDomain = "plant" | "field";

// ---------------------------------------------------------------------------
// Estados de la máquina (StateValue = "step.substate")
// ---------------------------------------------------------------------------

export type UploadStateValue =
  | "create_session.idle"
  | "create_session.running"
  | "create_session.failed"
  | "upload.idle"
  | "upload.uploading"
  | "upload.paused"
  | "upload.failed"
  | "complete_session.idle"
  | "complete_session.running"
  | "complete_session.failed"
  | "evaluation.idle"
  | "evaluation.running"
  | "evaluation.failed"
  | "done.success"
  | "done.permanently_failed";

// ---------------------------------------------------------------------------
// Contexto extendido (datos asociados a cada job)
// ---------------------------------------------------------------------------

export interface UploadJobContext {
  jobId: string;
  analysisId: string;
  domain: UploadDomain;
  clientBatchId: string;
  backendSessionId: string | null;
  skyboltSessionId: string | null;
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  transferRateBps?: number | null;
  estimatedRemainingSeconds?: number | null;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: number | null; // epoch ms
  createdAt: number;            // epoch ms
}

// ---------------------------------------------------------------------------
// Eventos que la máquina acepta
// ---------------------------------------------------------------------------

export type UploadMachineEvent =
  // Scheduler / orquestador
  | { type: "SCHEDULER_TICK"; nowMs: number }

  // Backend HTTP
  | { type: "SESSION_CREATED"; sessionId: string }
  | { type: "SESSION_ERROR"; statusCode: number; message: string }
  | { type: "COMPLETE_OK" }
  | { type: "COMPLETE_ERROR"; statusCode: number; message: string }
  | { type: "EVALUATION_OK" }
  | { type: "EVALUATION_ERROR"; statusCode: number; message: string }

  // Nativo (Skybolt)
  | { type: "NATIVE_STARTED"; skyboltSessionId: string }
  | { type: "NATIVE_COMPLETED" }
  | { type: "NATIVE_FAILED"; error: string }
  | { type: "NATIVE_PROGRESS"; totalFiles: number; completedFiles: number; totalBytes: number; uploadedBytes: number }
  | { type: "NATIVE_PAUSED" }
  | { type: "NATIVE_RESUMED" }

  // Polling fallback
  | { type: "POLL_TICK"; status: "completed" | "failed" | "uploading" | "unknown" | null; metrics: NativeMetricsSnapshot | null }

  // Usuario
  | { type: "USER_RETRY" }
  | { type: "USER_CANCEL" }
  | { type: "USER_PAUSE" }
  | { type: "USER_RESUME" };

export interface NativeMetricsSnapshot {
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  transferRateBps?: number | null;
  estimatedRemainingSeconds?: number | null;
}

// ---------------------------------------------------------------------------
// Configuración de la máquina
// ---------------------------------------------------------------------------

export interface MachineConfig {
  maxAttemptsPerStep: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  jitterFraction: number;
}

export const DEFAULT_MACHINE_CONFIG: MachineConfig = {
  maxAttemptsPerStep: 5,
  baseBackoffMs: 30_000,
  maxBackoffMs: 30 * 60_000,
  jitterFraction: 0.25,
};

// ---------------------------------------------------------------------------
// Transición resultante del intérprete
// ---------------------------------------------------------------------------

export interface TransitionResult {
  state: UploadStateValue;
  context: UploadJobContext;
  effects: Effect[];
}

export type Effect =
  | { type: "createUploadSession"; jobId: string; analysisId: string; domain: UploadDomain; clientBatchId: string }
  | { type: "startNativeUpload"; jobId: string; backendSessionId: string }
  | { type: "completeUploadSession"; jobId: string; backendSessionId: string }
  | { type: "createEvaluation"; jobId: string; analysisId: string; backendSessionId: string }
  | { type: "persistStep"; jobId: string; pipelineStep: UploadJobPipelineStep; stepStatus: UploadJobStatus; resetAttempts?: boolean }
  | { type: "persistError"; jobId: string; error: string }
  | { type: "persistMetrics"; jobId: string; totalFiles: number; completedFiles: number; totalBytes: number; uploadedBytes: number }
  | { type: "persistDone"; jobId: string }
  | { type: "persistSessionIds"; jobId: string; backendSessionId?: string; skyboltSessionId?: string }
  | { type: "startPolling"; jobId: string; skyboltSessionId: string }
  | { type: "stopPolling"; jobId: string }
  | { type: "cancelNative"; skyboltSessionId: string }
  | { type: "pauseNative"; skyboltSessionId: string }
  | { type: "resumeNative"; skyboltSessionId: string }
  | { type: "syncFinalMetrics"; jobId: string; skyboltSessionId: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string; meta?: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Snapshot que expone el store (para UI y debugging)
// ---------------------------------------------------------------------------

export interface UploadJobSnapshot {
  jobId: string;
  state: UploadStateValue;
  context: UploadJobContext;
  progressPercent: number;
  isTerminal: boolean;
  canRetry: boolean;
  canCancel: boolean;
  canPause: boolean;
  displayStatus: "pending" | "running" | "paused" | "completed" | "failed" | "permanently_failed";
}

// ---------------------------------------------------------------------------
// Errores de API
// ---------------------------------------------------------------------------

export class UploadApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "UploadApiError";
  }
}

// ---------------------------------------------------------------------------
// ViewModel (compatibilidad con UI existente)
// ---------------------------------------------------------------------------

export interface UploadJobViewModel {
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
}
