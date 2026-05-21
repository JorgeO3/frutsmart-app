/**
 * Upload System v2 — UploadService (fachada para UI)
 *
 * Única interfaz que los componentes React deben usar.
 * No contiene lógica de negocio; solo delega al orquestador y al store.
 */

import { useShallow } from "zustand/shallow";
import { uploadOrchestrator } from "./UploadOrchestrator";
import { useUploadStore } from "../store/uploadStore";
import type { UploadJobSnapshot, UploadJobViewModel } from "../types";

// ---------------------------------------------------------------------------
// Creación y gestión de jobs
// ---------------------------------------------------------------------------

export async function createUploadJob(analysisId: string): Promise<string> {
  return uploadOrchestrator.createJob(analysisId, "field");
}

export async function retryUploadJob(jobId: string): Promise<void> {
  return uploadOrchestrator.retryJob(jobId);
}

export async function cancelUploadJob(jobId: string): Promise<void> {
  return uploadOrchestrator.cancelJob(jobId);
}

export async function pauseUploadJob(jobId: string): Promise<void> {
  return uploadOrchestrator.pauseJob(jobId);
}

export async function resumeUploadJob(jobId: string): Promise<void> {
  return uploadOrchestrator.resumeJob(jobId);
}

export async function startUploadJob(jobId: string): Promise<void> {
  return uploadOrchestrator.startJob(jobId);
}

export async function removeUploadJob(jobId: string): Promise<void> {
  return uploadOrchestrator.removeJob(jobId);
}

// ---------------------------------------------------------------------------
// Queries para UI (hooks-friendly)
// ---------------------------------------------------------------------------

export function useUploadJob(jobId: string): UploadJobSnapshot | null {
  return useUploadStore((s) => s.getSnapshot(jobId));
}

export function useAllUploadJobs(): UploadJobSnapshot[] {
  return useUploadStore(useShallow((s) => s.getAllSnapshots()));
}

// ---------------------------------------------------------------------------
// Compatibilidad con view model existente
// ---------------------------------------------------------------------------

export function getAllJobsView(): UploadJobViewModel[] {
  const snapshots = useUploadStore.getState().getAllSnapshots();
  return snapshots.map((snap) => ({
    id: snap.jobId,
    qualityAnalysisId: snap.context.analysisId || null,
    domain: snap.context.domain,
    skyboltSessionId: snap.context.skyboltSessionId,
    pipelineStep: snap.state.split(".")[0] as UploadJobViewModel["pipelineStep"],
    status: snap.displayStatus === "permanently_failed" ? "failed" : (snap.displayStatus as UploadJobViewModel["status"]),
    totalFiles: snap.context.totalFiles,
    completedFiles: snap.context.completedFiles,
    totalBytes: snap.context.totalBytes,
    uploadedBytes: snap.context.uploadedBytes,
    lastError: snap.context.lastError,
    attemptsCount: snap.context.attempts,
    createdAt: new Date(snap.context.createdAt).toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Bootstrap (llamar una vez en root layout)
// ---------------------------------------------------------------------------

export function initUploadSystem(): Promise<void> {
  return uploadOrchestrator.bootstrap();
}
