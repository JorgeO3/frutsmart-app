/**
 * Upload System v2 — Upload Orchestrator
 *
 * Responsabilidades:
 * 1. Bootstrap: rehidrata jobs desde SQLite al store.
 * 2. Effect runner: ejecuta effects generados por la máquina de estados.
 * 3. Scheduler: envía SCHEDULER_TICK periódicamente.
 * 4. Polling: envía POLL_TICK durante upload.uploading.
 * 5. Event bridge: recibe eventos del nativo y los despacha al store.
 *
 * Único lugar donde se cruzan side effects con la máquina pura.
 */

import { database } from "@adapters/repository/Database";
import type { UploadJobRow } from "@adapters/repository/types";
import { useUploadStore } from "../store/uploadStore";
import { transition } from "../machine/interpreter";
import type {
  UploadJobContext,
  UploadStateValue,
  UploadMachineEvent,
  Effect,
  TransitionResult,
  NativeMetricsSnapshot,
} from "../types";
import {
  createUploadSession,
  completeUploadSession,
  createEvaluation,
  prepareSkyboltItems,
} from "./BackendUploadAdapter";
import {
  initNativeAdapter,
  initializeAndStartSession,
  resumeNativeSession,
  pauseNativeSession,
  cancelNativeSession,
  getNativeProgress,
} from "./NativeUploadAdapter";
import type { AnalysisUploadFile, PreparedSkyboltItem } from "./BackendUploadAdapter";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as Skybolt from "skybolt";
import { getDefaultSkyboltUploadConfig } from "@src/config/skyboltConfig";

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

class UploadOrchestrator {
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private pollingTimers = new Map<string, ReturnType<typeof setInterval>>();
  private isBootstrapped = false;

  // Caches para reconstruir manifests
  private analysisFilesCache = new Map<string, AnalysisUploadFile[]>();
  private preparedItemsCache = new Map<string, PreparedSkyboltItem[]>();

  // -------------------------------------------------------------------------
  // Bootstrap
  // -------------------------------------------------------------------------

  async bootstrap(): Promise<void> {
    if (this.isBootstrapped) return;
    this.isBootstrapped = true;

    console.log("[DIAG] bootstrap — before Skybolt.configure");

    // 0) Configurar Skybolt (inicializa AuthEnvironment, necesario para setAuthTokens)
    await Skybolt.configure(getDefaultSkyboltUploadConfig());

    console.log("[DIAG] bootstrap — before initNativeAdapter");

    // 1) Registrar listener nativo único
    initNativeAdapter((jobId, event) => {
      this.dispatch(jobId, event);
    });

    console.log("[DIAG] bootstrap — after initNativeAdapter, before DB query");

    // 2) Cargar jobs desde SQLite y resetear cualquier "running" a "pending"
    const rows = await database.uploadJobs.getAllJobs();
    console.log("[DIAG] bootstrap — DB query returned", rows.length, "rows");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const { ctx, state } = this.rowToMachine(row);
      const safeState = this.sanitizeStateOnBoot(state);
      useUploadStore.getState().loadJob(ctx, safeState);
      if (i < 3 || i === rows.length - 1) {
        console.log(`[DIAG] bootstrap — loadJob ${i + 1}/${rows.length}: jobId=${ctx.jobId}, state=${safeState}`);
      }
    }

    // 3) Iniciar scheduler
    this.startScheduler();

    // 4) Disparar un tick inmediato para jobs rehidratados.
    // Si no hacemos esto, los jobs que quedaron en *.idle esperan hasta 30s
    // a que dispare el primer interval del scheduler.
    this.dispatchSchedulerTickToRunnableJobs();

    console.log("[UploadOrchestrator] bootstrap complete, jobs:", rows.length);
  }

  // -------------------------------------------------------------------------
  // Creación de job (desde UI)
  // -------------------------------------------------------------------------

  async createJob(analysisId: string, domain: "plant" | "field" = "plant"): Promise<string> {
    const jobId = Crypto.randomUUID();
    const now = new Date().toISOString();

    const files = await this.buildAnalysisFiles(analysisId);
    this.analysisFilesCache.set(jobId, files);

    const totalBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);

    const row: UploadJobRow = {
      id: jobId,
      quality_analysis_id: analysisId,
      domain,
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

    await database.uploadJobs.createJob(row);

    const ctx = this.rowToContext(row);
    useUploadStore.getState().loadJob(ctx, "create_session.idle");

    // Disparar inmediatamente un tick para que empiece
    this.dispatch(jobId, { type: "SCHEDULER_TICK", nowMs: Date.now() });

    return jobId;
  }

  // -------------------------------------------------------------------------
  // Acciones de usuario
  // -------------------------------------------------------------------------

  async retryJob(jobId: string): Promise<void> {
    this.dispatch(jobId, { type: "USER_RETRY" });
  }

  async cancelJob(jobId: string): Promise<void> {
    this.dispatch(jobId, { type: "USER_CANCEL" });
  }

  async pauseJob(jobId: string): Promise<void> {
    this.dispatch(jobId, { type: "USER_PAUSE" });
  }

  async resumeJob(jobId: string): Promise<void> {
    this.dispatch(jobId, { type: "USER_RESUME" });
  }

  async startJob(jobId: string): Promise<void> {
    const entry = useUploadStore.getState().jobs.get(jobId);
    if (!entry) return;
    const state = entry.state;
    if (state === "upload.paused") {
      this.dispatch(jobId, { type: "USER_RESUME" });
    } else if (state.endsWith(".failed") || state.startsWith("done.permanently_failed")) {
      this.dispatch(jobId, { type: "USER_RETRY" });
    } else {
      // idle, running, uploading, pending — forzar scheduler tick
      this.dispatch(jobId, { type: "SCHEDULER_TICK", nowMs: Date.now() });
    }
  }

  async removeJob(jobId: string): Promise<void> {
    const entry = useUploadStore.getState().jobs.get(jobId);
    if (!entry) return;

    // Cancelar sesión nativa si existe
    if (entry.context.skyboltSessionId) {
      try {
        await cancelNativeSession(entry.context.skyboltSessionId);
      } catch (err) {
        console.warn("[UploadOrchestrator] removeJob: cancelNativeSession failed:", err);
      }
    }

    // Limpiar polling activo
    this.stopPolling(jobId);

    // Borrar de SQLite
    await database.uploadJobs.deleteJob(jobId);

    // Limpiar caches
    this.analysisFilesCache.delete(jobId);
    this.preparedItemsCache.delete(jobId);

    // Descargar del store
    useUploadStore.getState().unloadJob(jobId);

    console.log("[UploadOrchestrator] removeJob: job deleted:", jobId);
  }

  // -------------------------------------------------------------------------
  // Dispatch central
  // -------------------------------------------------------------------------

  private dispatch(jobId: string, event: UploadMachineEvent): void {
    const store = useUploadStore.getState();
    const entry = store.getEntry(jobId);
    const currentState = entry?.state ?? "unknown";
    const result = store.dispatch(jobId, event);
    if (!result) {
      console.log(`[DIAG] UploadOrchestrator dispatch DROPPED — jobId=${jobId}, event=${event.type}, currentState=${currentState}, reason=no_transition_defined`);
      return;
    }

    // Ejecutar effects
    void this.runEffects(jobId, result.effects, result.context).then(() => {
      this.maybeDispatchImmediateFollowUp(jobId);
    });
  }

  // -------------------------------------------------------------------------
  // Effect runner
  // -------------------------------------------------------------------------

  private async runEffects(
    jobId: string,
    effects: Effect[],
    context: UploadJobContext,
  ): Promise<void> {
    for (const effect of effects) {
      try {
        await this.runSingleEffect(jobId, effect, context);
      } catch (err) {
        // Usar warn en lugar de error para evitar el modal rojo de RN que bloquea la splash
        console.warn("[UploadOrchestrator] effect failed:", effect.type, err);
        // Algunos effects generan events de error automáticamente (ej. HTTP)
        // Si falla un effect crítico, tenemos que notificar a la máquina
        if (effect.type === "createUploadSession") {
          this.dispatch(jobId, {
            type: "SESSION_ERROR",
            statusCode: err instanceof Error && "statusCode" in err ? (err as { statusCode: number }).statusCode : 0,
            message: err instanceof Error ? err.message : String(err),
          });
        } else if (effect.type === "completeUploadSession") {
          this.dispatch(jobId, {
            type: "COMPLETE_ERROR",
            statusCode: err instanceof Error && "statusCode" in err ? (err as { statusCode: number }).statusCode : 0,
            message: err instanceof Error ? err.message : String(err),
          });
        } else if (effect.type === "createEvaluation") {
          this.dispatch(jobId, {
            type: "EVALUATION_ERROR",
            statusCode: err instanceof Error && "statusCode" in err ? (err as { statusCode: number }).statusCode : 0,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  private async runSingleEffect(
    _jobId: string,
    effect: Effect,
    context: UploadJobContext,
  ): Promise<void> {
    const ts = Date.now();
    console.log(`[DIAG] UploadOrchestrator effect start — type=${effect.type}, jobId=${_jobId}`);
    switch (effect.type) {
      case "createUploadSession": {
        const files = this.analysisFilesCache.get(context.clientBatchId) ?? [];
        const result = await createUploadSession({
          domain: context.domain,
          clientBatchId: context.clientBatchId,
          qualityAnalysisId: context.analysisId,
          files,
        });
        const prepared = prepareSkyboltItems(files, result.sessionId, result.items);
        this.preparedItemsCache.set(context.clientBatchId, prepared);
        this.dispatch(context.jobId, { type: "SESSION_CREATED", sessionId: result.sessionId });
        break;
      }

      case "startNativeUpload": {
        const items = this.preparedItemsCache.get(context.clientBatchId);
        if (!items || items.length === 0) {
          // Fallback: reconstruir desde cache de archivos
          const files = this.analysisFilesCache.get(context.clientBatchId);
          if (!files) {
            // Si ya tenemos un skyboltSessionId, intentamos resumir la sesión existente
            if (context.skyboltSessionId) {
              console.log(
                `[UploadOrchestrator] startNativeUpload: resuming existing session ${context.skyboltSessionId} ` +
                `for job ${context.jobId}`
              );
              await resumeNativeSession(context.skyboltSessionId);
              this.dispatch(context.jobId, { type: "NATIVE_RESUMED" });
              return;
            }
            // Job creado en sesión anterior: no tenemos los archivos en memoria.
            // No iniciamos upload nativo; el job se queda en idle y el scheduler
            // lo reintentará más tarde, o el usuario puede cancelarlo.
            console.warn(
              `[UploadOrchestrator] startNativeUpload: no cache for job ${context.jobId}, ` +
              `session=${context.backendSessionId}. Skipping (will retry on next tick).`
            );
            return;
          }
          const rebuilt: PreparedSkyboltItem[] = files.map((f) => ({
            clientItemId: f.clientItemId,
            localUri: f.localUri,
            blobName: `uploads/${context.backendSessionId}/${f.fileName}`,
            contentType: f.contentType,
            sizeBytes: f.sizeBytes,
            md5Hex: f.md5,
          }));
          this.preparedItemsCache.set(context.clientBatchId, rebuilt);
          await initializeAndStartSession(context.backendSessionId!, rebuilt);
        } else {
          await initializeAndStartSession(context.backendSessionId!, items);
        }
        // Fallback: si el evento nativo se pierde, dispatch manual
        console.log(`[DIAG] startNativeUpload — dispatching NATIVE_STARTED job=${context.jobId}, skyboltSessionId=${context.backendSessionId}, currentState=upload.uploading`);
        useUploadStore.getState().dumpJobContext(context.jobId);
        this.dispatch(context.jobId, { type: "NATIVE_STARTED", skyboltSessionId: context.backendSessionId! });
        useUploadStore.getState().dumpJobContext(context.jobId);
        break;
      }

      case "completeUploadSession": {
        await completeUploadSession(context.backendSessionId!);
        this.dispatch(context.jobId, { type: "COMPLETE_OK" });
        break;
      }

      case "createEvaluation": {
        await createEvaluation({
          qualityAnalysisId: context.analysisId,
          backendSessionId: context.backendSessionId!,
        });
        this.dispatch(context.jobId, { type: "EVALUATION_OK" });
        break;
      }

      case "persistStep": {
        await database.uploadJobs.updateJobStep(
          effect.jobId,
          effect.pipelineStep,
          effect.stepStatus,
          { resetAttempts: effect.resetAttempts },
        );
        break;
      }

      case "persistError": {
        await database.uploadJobs.markJobFailed(effect.jobId, effect.error);
        break;
      }

      case "persistDone": {
        await database.uploadJobs.markJobDone(effect.jobId);
        this.analysisFilesCache.delete(effect.jobId);
        this.preparedItemsCache.delete(effect.jobId);
        break;
      }

      case "persistSessionIds": {
        if (effect.backendSessionId) {
          await database.uploadJobs.setBackendSessionId(effect.jobId, effect.backendSessionId);
        }
        if (effect.skyboltSessionId) {
          await database.uploadJobs.setSkyboltSessionId(effect.jobId, effect.skyboltSessionId);
        }
        break;
      }

      case "persistMetrics": {
        await database.uploadJobs.updateJobMetrics(effect.jobId, {
          totalFiles: effect.totalFiles,
          completedFiles: effect.completedFiles,
          totalBytes: effect.totalBytes,
          uploadedBytes: effect.uploadedBytes,
        });
        break;
      }

      case "startPolling": {
        this.startPolling(effect.jobId, effect.skyboltSessionId);
        break;
      }

      case "stopPolling": {
        this.stopPolling(effect.jobId);
        break;
      }

      case "cancelNative": {
        await cancelNativeSession(effect.skyboltSessionId);
        break;
      }

      case "pauseNative": {
        await pauseNativeSession(effect.skyboltSessionId);
        break;
      }

      case "resumeNative": {
        await resumeNativeSession(effect.skyboltSessionId);
        break;
      }

      case "syncFinalMetrics": {
        const finalProgress = await getNativeProgress(effect.skyboltSessionId);
        if (finalProgress) {
          this.dispatch(effect.jobId, {
            type: "POLL_TICK",
            status: finalProgress.status === "completed" ? "completed" :
                    finalProgress.status === "failed" ? "failed" : "uploading",
            metrics: {
              totalFiles: finalProgress.totalFiles,
              completedFiles: finalProgress.completedFiles,
              totalBytes: finalProgress.totalBytes,
              uploadedBytes: finalProgress.uploadedBytes,
            },
          });
        }
        break;
      }

      case "log": {
        const fn = console[effect.level] ?? console.log;
        fn(`[UploadMachine] ${effect.message}`, effect.meta ?? "");
        break;
      }

      default:
        break;
    }
    console.log(`[DIAG] UploadOrchestrator effect done — type=${effect.type}, jobId=${_jobId}, elapsed=${Date.now() - ts}ms`);
  }

  // -------------------------------------------------------------------------
  // Scheduler
  // -------------------------------------------------------------------------

  private startScheduler(): void {
    if (this.schedulerTimer) return;
    this.schedulerTimer = setInterval(() => {
      this.dispatchSchedulerTickToRunnableJobs();
    }, 30_000);
  }

  private dispatchSchedulerTickToRunnableJobs(): void {
    const ids = useUploadStore.getState().getRunnableJobIds();
    const nowMs = Date.now();
    for (const jobId of ids) {
      this.dispatch(jobId, { type: "SCHEDULER_TICK", nowMs });
    }
  }

  private maybeDispatchImmediateFollowUp(jobId: string): void {
    const entry = useUploadStore.getState().getEntry(jobId);
    if (!entry) return;

    if (
      entry.state !== "upload.idle"
      && entry.state !== "complete_session.idle"
      && entry.state !== "evaluation.idle"
    ) {
      return;
    }

    console.log(`[DIAG] UploadOrchestrator immediate follow-up tick — jobId=${jobId}, state=${entry.state}`);
    this.dispatch(jobId, { type: "SCHEDULER_TICK", nowMs: Date.now() });
  }

  stopScheduler(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Polling fallback
  // -------------------------------------------------------------------------

  private startPolling(jobId: string, skyboltSessionId: string): void {
    if (this.pollingTimers.has(jobId)) return;

    const timer = setInterval(async () => {
      try {
        const progress = await getNativeProgress(skyboltSessionId);
        if (!progress) {
          this.dispatch(jobId, { type: "POLL_TICK", status: null, metrics: null });
          return;
        }

        if (progress.status === "completed") {
          this.stopPolling(jobId);
          this.dispatch(jobId, {
            type: "POLL_TICK",
            status: "completed",
            metrics: progress,
          });
        } else if (progress.status === "failed") {
          this.stopPolling(jobId);
          this.dispatch(jobId, {
            type: "POLL_TICK",
            status: "failed",
            metrics: progress,
          });
        } else {
          this.dispatch(jobId, {
            type: "POLL_TICK",
            status: "uploading",
            metrics: progress,
          });
        }
      } catch (err) {
        console.warn("[UploadOrchestrator] polling error:", err);
      }
    }, 3_000);

    this.pollingTimers.set(jobId, timer);
  }

  private stopPolling(jobId: string): void {
    const timer = this.pollingTimers.get(jobId);
    if (timer) {
      clearInterval(timer);
      this.pollingTimers.delete(jobId);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers: mapeo DB ↔ Machine
  // -------------------------------------------------------------------------

  private rowToMachine(row: UploadJobRow): { ctx: UploadJobContext; state: UploadStateValue } {
    const ctx: UploadJobContext = {
      jobId: row.id,
      analysisId: row.quality_analysis_id ?? "",
      domain: row.domain,
      clientBatchId: row.client_batch_id,
      backendSessionId: row.backend_session_id,
      skyboltSessionId: row.skybolt_session_id,
      totalFiles: row.total_files,
      completedFiles: row.completed_files,
      totalBytes: row.total_bytes,
      uploadedBytes: row.uploaded_bytes,
      attempts: row.attempts_count,
      lastError: row.last_error,
      lastAttemptAt: row.last_attempt_at ? Date.parse(row.last_attempt_at) : null,
      createdAt: Date.parse(row.created_at),
    };

    const state = this.dbStateToMachineState(
      row.pipeline_step,
      row.step_status,
      row.last_error,
      row.skybolt_session_id,
    );

    return { ctx, state };
  }

  private rowToContext(row: UploadJobRow): UploadJobContext {
    return this.rowToMachine(row).ctx;
  }

  private dbStateToMachineState(
    step: UploadJobRow["pipeline_step"],
    status: UploadJobRow["step_status"],
    lastError: string | null,
    skyboltSessionId: string | null,
  ): UploadStateValue {
    const isPermanent = lastError?.includes("[PERMANENT]") ?? false;

    if (step === "done") {
      return status === "success" ? "done.success" : "done.permanently_failed";
    }

    if (status === "failed") {
      if (isPermanent && step !== "create_session") {
        return "done.permanently_failed";
      }
      return `${step}.failed` as UploadStateValue;
    }

    if (step === "upload" && status === "running") {
      return "upload.uploading";
    }

    if (step === "upload" && status === "pending" && lastError === null) {
      // Si tiene skybolt_session_id, probablemente fue pausado por el usuario
      // Si no lo tiene, nunca se inició el upload nativo
      return skyboltSessionId ? "upload.paused" : "upload.idle";
    }

    return `${step}.${status === "running" ? "running" : "idle"}` as UploadStateValue;
  }

  private sanitizeStateOnBoot(state: UploadStateValue): UploadStateValue {
    // Cualquier estado "running" al boot se resetea a "idle" (pending)
    // porque el proceso que lo estaba ejecutando ya no existe.
    if (state.endsWith(".running") || state.endsWith(".uploading")) {
      const base = state.split(".")[0];
      return `${base}.idle` as UploadStateValue;
    }
    return state;
  }

  // -------------------------------------------------------------------------
  // Helpers: construcción de manifest de archivos
  // -------------------------------------------------------------------------

  private async buildAnalysisFiles(analysisId: string): Promise<AnalysisUploadFile[]> {
    const analysis = await database.qualityAnalyses.findFullById(analysisId);
    if (!analysis) {
      throw new Error(`No se encontró quality_analysis_id=${analysisId}`);
    }

    const uris = new Set<string>();
    const add = (value: string | null | undefined) => {
      if (typeof value === "string" && value.trim().length > 0) {
        uris.add(value.trim());
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

    if (uris.size === 0) {
      throw new Error(`El análisis ${analysisId} no contiene archivos para subir`);
    }

    const md5Results = await Skybolt.extractMD5FromFiles(Array.from(uris));
    const md5ByUri = new Map(
      (md5Results ?? []).filter((r) => r?.uri).map((r) => [r.uri, r]),
    );

    const files: AnalysisUploadFile[] = [];
    for (const uri of uris) {
      const md5Info = md5ByUri.get(uri) ?? md5ByUri.get(uri.trim());
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        throw new Error(`Archivo no encontrado para upload: ${uri}`);
      }

      const fileName = this.sanitizeFileName(uri);
      const contentType = md5Info?.contentType ?? this.inferContentType(fileName);
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

  private sanitizeFileName(uri: string): string {
    const raw = uri.split("/").pop() ?? `file-${Date.now()}.webp`;
    return raw.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  private inferContentType(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".png")) return "image/png";
    return "application/octet-stream";
  }
}

// ---------------------------------------------------------------------------
// Export singleton
// ---------------------------------------------------------------------------

export const uploadOrchestrator = new UploadOrchestrator();
