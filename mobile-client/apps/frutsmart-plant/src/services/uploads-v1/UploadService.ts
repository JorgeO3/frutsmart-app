import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";

import { database } from "@adapters/repository/Database";
import type { UploadJobRow } from "@adapters/repository/types";
import {
  apiBaseUrl,
  uploadJobDeletionEnabled,
} from "@src/config/authConfig";

import type { UploadEvent } from "skybolt";
import * as Skybolt from "skybolt";
import { getValidAccessToken } from "../auth/authService";
import {
  type BackendUploadApi,
  type NativeUploadApi,
  UploadScheduler,
} from "./UploadScheduler";
import type { UploadJobViewModel } from "./types";
import { UploadApiError } from "./types";

type AnalysisUploadFile = {
  clientItemId: string;
  localUri: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  md5: string;
};

type PreparedSkyboltItem = {
  clientItemId: string;
  localUri: string;
  blobName: string;
  contentType: string;
  sizeBytes: number;
  md5Hex: string;
};

const analysisFilesCache = new Map<string, AnalysisUploadFile[]>();
const preparedSkyboltItemsCache = new Map<string, PreparedSkyboltItem[]>();

function clearUploadJobCaches(jobId: string): void {
  analysisFilesCache.delete(jobId);
  preparedSkyboltItemsCache.delete(jobId);
}

function inferContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function extractFileNameFromUri(uri: string): string {
  const raw = uri.split("/").pop() ?? `file-${Date.now()}.webp`;
  return raw.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function collectAnalysisUris(analysisId: string): Promise<string[]> {
  const analysis = await database.qualityAnalyses.findFullById(analysisId);
  if (!analysis) {
    throw new Error(`No se encontro quality_analysis_id=${analysisId}`);
  }

  const uris = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        uris.add(trimmed);
      }
    }
  };

  for (const classification of analysis.classifications) {
    add(classification.external_raw_photo_uri);
    add(classification.internal_raw_photo_uri);
    add(classification.internal_segmented_photo_uri);
    for (const segment of classification.segments) {
      add(segment.uri);
    }
  }

  return Array.from(uris);
}

async function buildAnalysisFiles(analysisId: string): Promise<AnalysisUploadFile[]> {
  const uris = await collectAnalysisUris(analysisId);
  if (uris.length === 0) {
    throw new Error(`El analisis ${analysisId} no contiene archivos para subir`);
  }

  const md5Results = await Skybolt.extractMD5FromFiles(uris);
  const md5ByUri = new Map(
    (md5Results ?? []).filter(r => r?.uri).map((r) => [r.uri, r])
  );

  const files: AnalysisUploadFile[] = [];
  for (const uri of uris) {
    const md5Info = md5ByUri.get(uri) ?? md5ByUri.get(uri.trim());
    const info = await FileSystem.getInfoAsync(uri);

    if (!info.exists) {
      throw new Error(`Archivo no encontrado para upload: ${uri}`);
    }

    const fileName = extractFileNameFromUri(uri);
    const contentType = md5Info?.contentType ?? inferContentType(fileName);
    const sizeBytes = md5Info?.sizeBytes ?? info.size ?? 0;

    if (!md5Info?.md5Hex) {
      console.warn("[UploadService] md5 lookup failed", {
        uri,
        uriTrimmed: uri.trim(),
        md5ByUriKeys: Array.from(md5ByUri.keys()).slice(0, 10),
        infoExists: info.exists,
      });
      throw new Error(`No se pudo obtener md5 para archivo ${uri}`);
    }

    files.push({
      clientItemId: Crypto.randomUUID(),
      localUri: uri,
      fileName,
      contentType,
      sizeBytes,
      md5: md5Info.md5Hex,
    });
  }

  return files;
}

async function postJson<T>(
  path: string,
  body: unknown,
  token: string,
): Promise<T> {
  const url = `${apiBaseUrl}/api/v1${path}`;
  const payloadStr = JSON.stringify(body);
  console.log("[postJson] fetch start", { url, bodyLen: payloadStr.length });
  const startMs = Date.now();
  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: payloadStr,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    console.log("[postJson] fetch threw", { url, elapsedMs: Date.now() - startMs, error: String(err) });
    const message = err instanceof Error ? err.message : String(err);
    throw new UploadApiError(message, 0);
  }
  console.log("[postJson] fetch returned", { url, status: response.status, ok: response.ok, elapsedMs: Date.now() - startMs });

  console.log("[postJson] reading body...", { status: response.status });
  const text = await response.text();
  console.log("[postJson] body read", { byteLen: text.length, preview: text.slice(0, 120) });
  const payload = text
    ? (() => {
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return text as unknown;
        }
      })()
    : null;

  if (!response.ok) {
    const friendly =
      typeof payload === "object" && payload !== null
        ? ((payload as Record<string, unknown>).message as string) ?? response.statusText
        : response.statusText;
    throw new UploadApiError(
      `Upload backend ${response.status}: ${friendly}`,
      response.status,
    );
  }

  return payload as T;
}

class BackendUploadClient implements BackendUploadApi {
  public async createUploadSession(input: {
    domain: UploadJobRow["domain"];
    clientBatchId: string;
    qualityAnalysisId: string | null;
  }): Promise<{ sessionId: string }> {
    if (!input.qualityAnalysisId) {
      throw new Error("qualityAnalysisId requerido para crear sesion de upload");
    }

    const token = await getValidAccessToken();

    const files =
      analysisFilesCache.get(input.clientBatchId) ??
      (await buildAnalysisFiles(input.qualityAnalysisId));

    analysisFilesCache.set(input.clientBatchId, files);

    const body = {
      domain: input.domain,
      clientBatchId: input.clientBatchId,
      files: files.map((file) => ({
        clientItemId: file.clientItemId,
        fileName: file.fileName,
        fileSizeBytes: file.sizeBytes,
        contentType: file.contentType,
        md5: file.md5,
      })),
    };

    const response = await postJson<{
      sessionId: string;
      items?: Array<{ clientItemId: string; blobName: string }>;
    }>("/upload/sessions", body, token);

    const blobNameByClientItem = new Map(
      (response.items ?? []).map((item) => [item.clientItemId, item.blobName]),
    );

    const prepared = files.map((file) => ({
      clientItemId: file.clientItemId,
      localUri: file.localUri,
      blobName:
        blobNameByClientItem.get(file.clientItemId) ??
        `uploads/${response.sessionId}/${file.fileName}`,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      md5Hex: file.md5,
    }));

    preparedSkyboltItemsCache.set(input.clientBatchId, prepared);

    return { sessionId: response.sessionId };
  }

  public async completeUploadSession(sessionId: string): Promise<void> {
    const token = await getValidAccessToken();
    await postJson(`/upload/sessions/${sessionId}/complete`, {
      verifyAndPromote: true,
      failOnIncomplete: false,
    }, token);
  }

  public async createEvaluation(_input: {
    qualityAnalysisId: string;
    backendSessionId: string;
  }): Promise<void> {
    console.log(
      "[UploadService] createEvaluation pendiente de endpoint definitivo; se marca done en esta fase",
    );
  }
}

class NativeUploadClient implements NativeUploadApi {
  public async startUploadForJob(input: {
    jobId: string;
    backendSessionId: string;
  }): Promise<{ skyboltSessionId: string }> {
    const job = await database.uploadJobs.findJobById(input.jobId);
    if (!job) {
      throw new Error(`No se encontro upload job id=${input.jobId}`);
    }

    if (job.skybolt_session_id) {
      await Skybolt.resumeSession(job.skybolt_session_id);
      return { skyboltSessionId: job.skybolt_session_id };
    }

    let items = preparedSkyboltItemsCache.get(input.jobId);
    if (!items || items.length === 0) {
      console.log("[NativeUploadClient] cache miss, rebuilding manifest", { jobId: input.jobId });
      const files = analysisFilesCache.get(input.jobId) ??
        (job.quality_analysis_id ? await buildAnalysisFiles(job.quality_analysis_id) : null);
      if (!files || files.length === 0) {
        throw new Error(
          "No hay manifest de upload en memoria ni es posible reconstruirlo desde quality_analysis_id.",
        );
      }
      analysisFilesCache.set(input.jobId, files);
      items = files.map((file) => ({
        clientItemId: file.clientItemId,
        localUri: file.localUri,
        blobName: `uploads/${input.backendSessionId}/${file.fileName}`,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        md5Hex: file.md5,
      }));
      preparedSkyboltItemsCache.set(input.jobId, items);
    }

    const skyboltSessionId = input.backendSessionId;

    await Skybolt.initializeSession({
      sessionId: skyboltSessionId,
      items,
      options: {
        maxParallelFiles: 3,
        maxParallelChunks: 4,
        chunkSizeBytes: 4 * 1024 * 1024,
        enableBackground: true,
        allowsCellular: true,
      },
    });

    await Skybolt.startSession(skyboltSessionId);
    console.log("[NativeUploadClient DIAG] startSession returned, verifying session exists...");

    const progress = await Skybolt.getSessionProgress(skyboltSessionId);
    console.log("[NativeUploadClient DIAG] getSessionProgress after start:", progress ? `status=${progress.status}, files=${progress.totalFiles}` : "null — session NOT FOUND in native!");

    return { skyboltSessionId };
  }
}

export class UploadService {
  private readonly scheduler: UploadScheduler;
  private readonly pollingTimers = new Map<string, ReturnType<typeof setInterval>>();

  constructor() {
    this.scheduler = new UploadScheduler(
      new BackendUploadClient(),
      new NativeUploadClient(),
      undefined, // default config
      undefined, // default repo
      (jobId, skyboltSessionId) => this.startProgressPolling(jobId, skyboltSessionId),
    );
  }

  public async createJobFromAnalysis(analysisId: string): Promise<string> {
    const jobId = Crypto.randomUUID();
    const now = new Date().toISOString();

    const files = await buildAnalysisFiles(analysisId);
    analysisFilesCache.set(jobId, files);

    const totalBytes = files.reduce((acc, file) => acc + file.sizeBytes, 0);

    const job: UploadJobRow = {
      id: jobId,
      quality_analysis_id: analysisId,
      domain: "plant",
      client_batch_id: jobId,
      backend_session_id: null,
      skybolt_session_id: null,
      pipeline_step: "create_session",
      step_status: "pending",
      total_files: files.length,
      completed_files: 0,
      total_bytes: totalBytes,
      uploaded_bytes: 0,
      last_error: null,
      attempts_count: 0,
      last_attempt_at: null,
      created_at: now,
      updated_at: now,
    };

    await database.uploadJobs.createJob(job);
    await this.runSchedulerTick();
    return jobId;
  }

  public async getAllJobsView(): Promise<UploadJobViewModel[]> {
    return database.uploadJobs.getAllJobsView();
  }

  public async recoverPendingJobs(): Promise<void> {
    await this.runSchedulerTick();
  }

  public async runSchedulerTick(): Promise<void> {
    await this.scheduler.runTick();
  }

  public async handleSkyboltEvent(event: UploadEvent): Promise<void> {
    console.log("[UploadService DIAG] handleSkyboltEvent:", event.type, "sessionId:", (event as { sessionId?: string }).sessionId);
    switch (event.type) {
      case "session:started":
      case "session:resumed":
        await this.handleUploadLifecycleRunning(event.sessionId);
        break;

      case "session:paused":
        await this.syncMetricsFromSessionId(event.sessionId);
        break;

      case "session:completed":
        await this.handleSessionCompleted(event.sessionId);
        break;

      case "session:failed":
        await this.handleSessionFailed(event.sessionId, event.error.message);
        break;

      case "item:progress":
      case "item:completed":
      case "item:failed":
        await this.syncMetricsFromSessionId(event.sessionId);
        break;

      case "auth:required":
        if (event.sessionId) {
          await this.handleSessionFailed(event.sessionId, "auth_required");
        }
        break;

      case "error:network":
      case "error:rate-limited":
      case "error:throttled":
      case "error:forbidden":
      case "error:contract":
      case "error:checksum":
      case "error:file-access":
        await this.handleSessionFailed(event.sessionId, event.payload.message);
        break;

      case "upload:recovery-complete":
      case "upload:resume-all-complete":
      case "debug":
      default:
        break;
    }
  }

  public async forceRetryJob(jobId: string): Promise<void> {
    const job = await database.uploadJobs.findJobById(jobId);
    if (!job) return;

    await database.uploadJobs.updateJobStep(job.id, job.pipeline_step, "pending", {
      clearAttemptWindow: true,
    });
    await this.runSchedulerTick();
  }

  public async removeJob(jobId: string): Promise<void> {
    if (!uploadJobDeletionEnabled) {
      throw new Error("La eliminacion de jobs solo esta habilitada en local.");
    }

    const job = await database.uploadJobs.findJobById(jobId);
    if (!job) return;

    if (job.skybolt_session_id) {
      try {
        await Skybolt.cancelSession(job.skybolt_session_id);
      } catch (error) {
        console.warn("[UploadService] cancelSession nativa fallo antes de borrar job", error);
      }
    }

    this.stopPolling(job.id);
    await database.uploadJobs.deleteJob(job.id);
    clearUploadJobCaches(job.id);
  }

  public async cancelJob(jobId: string): Promise<void> {
    const job = await database.uploadJobs.findJobById(jobId);
    if (!job) return;

    if (job.skybolt_session_id) {
      try {
        await Skybolt.cancelSession(job.skybolt_session_id);
      } catch (error) {
        console.warn("[UploadService] cancelSession nativa fallo", error);
      }
    }

    this.stopPolling(job.id);
    await database.uploadJobs.markJobFailed(job.id, "cancelled_by_user");
    clearUploadJobCaches(job.id);
  }

  public async pauseJob(jobId: string): Promise<void> {
    const job = await database.uploadJobs.findJobById(jobId);
    if (!job?.skybolt_session_id) return;
    await Skybolt.pauseSession(job.skybolt_session_id);
  }

  public async resumeJob(jobId: string): Promise<void> {
    const job = await database.uploadJobs.findJobById(jobId);
    if (!job?.skybolt_session_id) {
      await this.forceRetryJob(jobId);
      return;
    }
    await Skybolt.resumeSession(job.skybolt_session_id);
    await this.runSchedulerTick();
  }

  public async startJob(jobId: string): Promise<void> {
    await this.forceRetryJob(jobId);
  }

  private async handleUploadLifecycleRunning(sessionId: string): Promise<void> {
    const job = await database.uploadJobs.findBySkyboltSessionId(sessionId);
    if (!job) return;

    const laterSteps = ["complete_session", "evaluation", "done"];
    if (laterSteps.includes(job.pipeline_step)) {
      console.log("[UploadService] handleUploadLifecycleRunning: job already advanced past upload, skipping", { id: job.id, step: job.pipeline_step });
      return;
    }

    await database.uploadJobs.updateJobStep(job.id, "upload", "running");
    await this.syncMetricsFromSessionId(sessionId);
  }

  private async handleSessionCompleted(sessionId: string): Promise<void> {
    const existing = this.completionInFlight.get(sessionId);
    if (existing) {
      console.log("[UploadService DIAG] handleSessionCompleted: joining in-flight completion for", sessionId);
      return existing;
    }

    const promise = (async (): Promise<void> => {
      if (this.sessionAlreadyHandled.has(sessionId)) {
        console.log("[UploadService DIAG] handleSessionCompleted: already handled, skipping:", sessionId);
        return;
      }
      this.sessionAlreadyHandled.add(sessionId);

      console.log("[UploadService DIAG] handleSessionCompleted:", sessionId);
      const job = await database.uploadJobs.findBySkyboltSessionId(sessionId);
      if (!job) {
        console.log("[UploadService DIAG] handleSessionCompleted: no job found for sessionId:", sessionId);
        this.sessionAlreadyHandled.delete(sessionId);
        return;
      }

      const synced = await this.syncMetricsFromSessionId(sessionId);
      if (!synced) {
        console.warn("[UploadService] handleSessionCompleted: failed to sync metrics from native, will not advance pipeline", { sessionId });
        this.sessionAlreadyHandled.delete(sessionId);
        return;
      }

      await database.uploadJobs.updateJobStep(job.id, "complete_session", "pending", {
        resetAttempts: true,
        clearAttemptWindow: true,
      });
      console.log("[UploadService DIAG] handleSessionCompleted: job advanced to complete_session, calling runSchedulerTick");
      await this.runSchedulerTick();
    })();

    this.completionInFlight.set(sessionId, promise);
    return promise.finally(() => {
      this.completionInFlight.delete(sessionId);
    });
  }

  private async handleSessionFailed(
    sessionId: string,
    reason: string,
  ): Promise<void> {
    const existing = this.completionInFlight.get(sessionId);
    if (existing) {
      console.log("[UploadService DIAG] handleSessionFailed: joining in-flight for", sessionId);
      return existing;
    }

    const promise = (async (): Promise<void> => {
      if (this.sessionAlreadyHandled.has(sessionId)) {
        console.log("[UploadService DIAG] handleSessionFailed: already handled, skipping:", sessionId);
        return;
      }
      this.sessionAlreadyHandled.add(sessionId);

      const job = await database.uploadJobs.findBySkyboltSessionId(sessionId);
      if (!job) {
        this.sessionAlreadyHandled.delete(sessionId);
        return;
      }

      this.stopPolling(job.id);
      await database.uploadJobs.markJobFailed(job.id, reason);
    })();

    this.completionInFlight.set(sessionId, promise);
    return promise.finally(() => {
      this.completionInFlight.delete(sessionId);
    });
  }

  private async syncMetricsFromSessionId(sessionId: string): Promise<boolean> {
    const existing = this.syncInFlight.get(sessionId);
    if (existing) {
      console.log("[UploadService DIAG] syncMetricsFromSessionId: joining in-flight sync for", sessionId);
      return existing;
    }

    const promise = (async (): Promise<boolean> => {
      try {
        const job = await database.uploadJobs.findBySkyboltSessionId(sessionId);
        if (!job) {
          console.log("[UploadService DIAG] syncMetricsFromSessionId: no job found for sessionId:", sessionId);
          return false;
        }

        console.log("[UploadService DIAG] syncMetricsFromSessionId: calling getSessionProgress", { sessionId, jobId: job.id, dbTotalBytes: job.total_bytes, dbCompletedFiles: job.completed_files });

        const progress = await Skybolt.getSessionProgress(sessionId);

        console.log("[UploadService DIAG] syncMetricsFromSessionId: getSessionProgress returned", { sessionId, progress: progress ? { totalFiles: progress.totalFiles, completedFiles: progress.completedFiles, totalBytes: progress.totalBytes, uploadedBytes: progress.uploadedBytes, status: progress.status } : "null" });

        if (!progress) return false;

        if (progress.totalBytes === 0 && progress.totalFiles === 0 && (job.total_bytes > 0 || job.total_files > 0)) {
          console.warn("[UploadService] syncMetricsFromSessionId: native returned zero metrics but DB has existing data — skipping overwrite", { sessionId, dbTotalBytes: job.total_bytes, dbTotalFiles: job.total_files });
          return false;
        }

        await database.uploadJobs.updateJobMetrics(job.id, {
          totalFiles: progress.totalFiles,
          completedFiles: progress.completedFiles,
          totalBytes: progress.totalBytes,
          uploadedBytes: progress.uploadedBytes,
        });

        console.log("[UploadService DIAG] syncMetricsFromSessionId: metrics updated", { sessionId, jobId: job.id, totalFiles: progress.totalFiles, completedFiles: progress.completedFiles, totalBytes: progress.totalBytes, uploadedBytes: progress.uploadedBytes });

        return true;
      } finally {
        this.syncInFlight.delete(sessionId);
      }
    })();

    this.syncInFlight.set(sessionId, promise);
    return promise;
  }

  // ---------------------------------------------------------------------------
  // Polling fallback — safety net por si los eventos nativos no llegan a JS.
  // El polling solo se detiene cuando la sesión termina (completed/failed) o
  // cuando el evento sí llega (evita doble procesamiento con un flag).
  // ---------------------------------------------------------------------------

  private sessionAlreadyHandled = new Set<string>();
  private syncInFlight = new Map<string, Promise<boolean>>();
  private completionInFlight = new Map<string, Promise<void>>();

  public startProgressPolling(jobId: string, skyboltSessionId: string): void {
    if (this.pollingTimers.has(jobId)) return;

    console.log("[UploadService DIAG] startProgressPolling:", { jobId, skyboltSessionId });

    const timer = setInterval(async () => {
      try {
        const progress = await Skybolt.getSessionProgress(skyboltSessionId);
        console.log("[UploadService DIAG] poll result:", { jobId, progress: progress ? `status=${(progress as { status?: string }).status}` : "null" });

        if (!progress) return;

        if (progress.status === "completed") {
          console.log("[UploadService DIAG] poll detected completed:", skyboltSessionId);
          this.stopPolling(jobId);
          await this.handleSessionCompleted(skyboltSessionId);
        } else if (progress.status === "failed") {
          console.log("[UploadService DIAG] poll detected failed:", skyboltSessionId);
          this.stopPolling(jobId);
          await this.handleSessionFailed(skyboltSessionId, "native_session_failed");
        } else {
          // Still uploading — sync metrics
          await this.syncMetricsFromSessionId(skyboltSessionId);

          // Stop polling if job has moved past the upload step
          const currentJob = await database.uploadJobs.findJobById(jobId);
          if (!currentJob || currentJob.pipeline_step !== "upload" || currentJob.step_status !== "running") {
            this.stopPolling(jobId);
            clearUploadJobCaches(jobId);
          }
        }
      } catch (err) {
        console.log("[UploadService DIAG] poll error:", String(err));
      }
    }, 3000);

    this.pollingTimers.set(jobId, timer);
  }

  public stopPolling(jobId: string): void {
    const timer = this.pollingTimers.get(jobId);
    if (timer) {
      clearInterval(timer);
      this.pollingTimers.delete(jobId);
      console.log("[UploadService DIAG] stopPolling:", jobId);
    }
  }
}

export const uploadService = new UploadService();
