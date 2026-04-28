import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";

import { database } from "@adapters/repository/Database";
import type { UploadJobRow } from "@adapters/repository/types";
import { apiBaseUrl } from "@src/config/authConfig";

import type { UploadEvent } from "skybolt";
import * as Skybolt from "skybolt";
import { getValidAccessToken } from "../auth/authService";
import {
  type BackendUploadApi,
  type NativeUploadApi,
  UploadScheduler,
} from "./UploadScheduler";
import type { UploadJobViewModel } from "./types";

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
    if (typeof value === "string" && value.length > 0) {
      uris.add(value);
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
  const md5ByUri = new Map(md5Results.map((result) => [result.uri, result]));

  const files: AnalysisUploadFile[] = [];
  for (const uri of uris) {
    const md5Info = md5ByUri.get(uri);
    const info = await FileSystem.getInfoAsync(uri);

    if (!info.exists) {
      throw new Error(`Archivo no encontrado para upload: ${uri}`);
    }

    const fileName = extractFileNameFromUri(uri);
    const contentType = md5Info?.contentType ?? inferContentType(fileName);
    const sizeBytes = md5Info?.sizeBytes ?? info.size ?? 0;

    if (!md5Info?.md5Hex) {
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
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
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
    throw new Error(
      `Upload backend ${response.status} ${response.statusText}: ${text || "sin cuerpo"}`,
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

    const items = preparedSkyboltItemsCache.get(input.jobId);
    if (!items || items.length === 0) {
      throw new Error(
        "No hay manifest de upload en memoria para iniciar sesion nativa. Reintenta desde create_session.",
      );
    }

    const skyboltSessionId = `skybolt-${input.backendSessionId}`;

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
    return { skyboltSessionId };
  }
}

export class UploadService {
  private readonly scheduler: UploadScheduler;

  constructor() {
    this.scheduler = new UploadScheduler(
      new BackendUploadClient(),
      new NativeUploadClient(),
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

    await database.uploadJobs.updateJobStep(job.id, job.pipeline_step, "pending");
    await this.runSchedulerTick();
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

    await database.uploadJobs.markJobFailed(job.id, "cancelled_by_user");
    analysisFilesCache.delete(job.id);
    preparedSkyboltItemsCache.delete(job.id);
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
    await database.uploadJobs.updateJobStep(job.id, "upload", "running");
    await this.syncMetricsFromSessionId(sessionId);
  }

  private async handleSessionCompleted(sessionId: string): Promise<void> {
    const job = await database.uploadJobs.findBySkyboltSessionId(sessionId);
    if (!job) return;

    await this.syncMetricsFromSessionId(sessionId);
    await database.uploadJobs.updateJobStep(job.id, "complete_session", "pending");
    await this.runSchedulerTick();
  }

  private async handleSessionFailed(
    sessionId: string,
    reason: string,
  ): Promise<void> {
    const job = await database.uploadJobs.findBySkyboltSessionId(sessionId);
    if (!job) return;

    await database.uploadJobs.markJobFailed(job.id, reason);
  }

  private async syncMetricsFromSessionId(sessionId: string): Promise<void> {
    const job = await database.uploadJobs.findBySkyboltSessionId(sessionId);
    if (!job) return;

    const progress = await Skybolt.getSessionProgress(sessionId);
    if (!progress) return;

    await database.uploadJobs.updateJobMetrics(job.id, {
      totalFiles: progress.totalFiles,
      completedFiles: progress.completedFiles,
      totalBytes: progress.totalBytes,
      uploadedBytes: progress.uploadedBytes,
    });
  }
}

export const uploadService = new UploadService();
