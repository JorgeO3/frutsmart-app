import { database } from "@adapters/repository/Database";
import type { UploadJobRow, UploadJobStatus } from "@adapters/repository/types";
import { UploadApiError } from "./types";

// Estas interfaces son la “capa de puertos” que el scheduler necesita.
// Puedes implementar estos puertos usando tu cliente real (Nest.js) y SkyVault.
export interface BackendUploadApi {
  createUploadSession(input: {
    domain: UploadJobRow["domain"];
    clientBatchId: string;
    qualityAnalysisId: string | null;
  }): Promise<{
    sessionId: string; // core.upload_sessions.id
  }>;

  completeUploadSession(sessionId: string): Promise<void>;

  createEvaluation(input: {
    qualityAnalysisId: string;
    backendSessionId: string;
  }): Promise<void>;
}

export interface NativeUploadApi {
  /**
   * Inicia (o reanuda) la subida nativa para un job concreto.
   *
   * - Si aún no existe skybolt_session_id, debería crearla y devolverla.
   * - Si ya existe, puede simplemente reanudarla.
   *
   * El detalle fino (URIs, SAS, etc.) vive dentro del módulo nativo.
   */
  startUploadForJob(input: {
    jobId: string;
    backendSessionId: string;
  }): Promise<{
    skyboltSessionId: string;
  }>;
}

// ---------------------------------------------------------------------------
// Configuración del scheduler (backoff, límites, etc.)
// ---------------------------------------------------------------------------

export type PipelineStep = UploadJobRow["pipeline_step"];
export type StepStatus = UploadJobRow["step_status"];

type SchedulerConfig = {
  /** Intentos máximos por paso antes de dar el job por definitivamente fallido */
  maxAttemptsPerStep: number;
  /** Backoff base en ms (se aplica exponencial con attempts_count) */
  baseBackoffMs: number;
  /** Límite superior del backoff (ms) */
  maxBackoffMs: number;
  /** Fracción de jitter aleatorio (0.0–1.0) */
  jitterFraction: number;
  /** Máximo de jobs a procesar por tick (para evitar quemar la batería) */
  maxJobsPerTick: number;
};

const DEFAULT_CONFIG: SchedulerConfig = {
  maxAttemptsPerStep: 5,
  baseBackoffMs: 30_000,   // 30s
  maxBackoffMs: 30 * 60_000, // 30 min
  jitterFraction: 0.25,
  maxJobsPerTick: 5,
};

// ---------------------------------------------------------------------------
// Repositorio mínimo que el scheduler espera de uploadJobs
// ---------------------------------------------------------------------------

interface UploadJobsRepository {
  findJobById(id: string): Promise<UploadJobRow | null>;
  getRunnableJobs(): Promise<UploadJobRow[]>;

  updateJobStep(
    jobId: string,
    pipelineStep: PipelineStep,
    stepStatus: UploadJobStatus,
    options?: { resetAttempts?: boolean; clearAttemptWindow?: boolean },
  ): Promise<void>;

  markJobFailed(jobId: string, lastError: string | null): Promise<void>;

  markJobDone(jobId: string): Promise<void>;

  incrementAttempts(jobId: string): Promise<void>;

  setBackendSessionId(jobId: string, backendSessionId: string): Promise<void>;
  setSkyboltSessionId(jobId: string, skyboltSessionId: string): Promise<void>;
}

// Adaptador fino sobre database.uploadJobs (opcional, pero ayuda a tipar)

const uploadJobsRepo: UploadJobsRepository = {
  async findJobById(id) {
    return database.uploadJobs.findJobById(id);
  },

  async getRunnableJobs() {
    // Usa directamente tu método ya definido en el repositorio real
    return database.uploadJobs.getRunnableJobs();
  },

  async updateJobStep(jobId, pipelineStep, stepStatus, options) {
    // Firma real: updateJobStep(jobId, pipelineStep, stepStatus)
    return database.uploadJobs.updateJobStep(jobId, pipelineStep, stepStatus, options);
  },

  async markJobFailed(jobId, error) {
    // Firma real: markJobFailed(jobId, lastError)
    return database.uploadJobs.markJobFailed(jobId, error ?? null);
  },

  async markJobDone(jobId) {
    // Firma real: markJobDone(jobId)
    return database.uploadJobs.markJobDone(jobId);
  },

  async incrementAttempts(jobId) {
    // Firma real: incrementAttempts(jobId)
    return database.uploadJobs.incrementAttempts(jobId);
  },

  async setBackendSessionId(jobId, backendSessionId) {
    return database.uploadJobs.setBackendSessionId(jobId, backendSessionId);
  },

  async setSkyboltSessionId(jobId, skyboltSessionId) {
    return database.uploadJobs.setSkyboltSessionId(jobId, skyboltSessionId);
  },
};

// ---------------------------------------------------------------------------
// Implementación del Scheduler
// ---------------------------------------------------------------------------

export class UploadScheduler {
  private running = false;

  constructor(
    private readonly backend: BackendUploadApi,
    private readonly nativeUpload: NativeUploadApi,
    private readonly config: SchedulerConfig = DEFAULT_CONFIG,
    private readonly jobs: UploadJobsRepository = uploadJobsRepo,
    private readonly onUploadStarted?: (jobId: string, skyboltSessionId: string) => void,
  ) { }

  /**
   * Punto de entrada principal.
   *
   * Llamar desde:
   *  - Al iniciar la app (root layout / bootstrap).
   *  - Desde una tarea de segundo plano (Expo TaskManager / WorkManager).
   */
  public async runTick(): Promise<void> {
    if (this.running) {
      console.log("[UploadScheduler] runTick(): ya hay una ejecución en curso; se omite este tick.");
      return;
    }

    this.running = true;
    try {
      const nowMs = Date.now();
      const candidates = await this.jobs.getRunnableJobs();

      // Filtro por backoff + jitter
      const runnable = candidates
        .filter((job) => this.canRunJob(job, nowMs))
        .slice(0, this.config.maxJobsPerTick);

      if (runnable.length === 0) {
        console.log("[UploadScheduler] runTick(): no hay jobs elegibles.");
        return;
      }

      console.log("[UploadScheduler] runTick(): procesando jobs", {
        totalCandidates: candidates.length,
        runnable: runnable.map((j) => ({ id: j.id, step: j.pipeline_step, status: j.step_status })),
      });

      // Procesamos de manera SECUENCIAL para mantener el sistema más determinista.
      // Si un job avanza de paso exitosamente, lo reprocesamos en el mismo tick
      // para encadenar create_session → upload → (evento) → complete_session → evaluation.
      for (const job of runnable) {
        let currentJob: UploadJobRow | null = job;
        while (currentJob) {
          const advanced = await this.processJob(currentJob);
          if (!advanced) break;
          currentJob = await this.jobs.findJobById(currentJob.id);
          if (!currentJob || !this.canProcessNextStep(currentJob)) break;
        }
      }
    } finally {
      this.running = false;
    }
  }

  // -------------------------------------------------------------------------
  // Lógica de elegibilidad (backoff exponencial + jitter)
  // -------------------------------------------------------------------------

  private canRunJob(job: UploadJobRow, nowMs: number): boolean {
    if (job.pipeline_step === "done") return false;

    // Si el último error fue clasificado como permanente, no reintentar.
    if (job.last_error?.startsWith("[PERMANENT]")) {
      return false;
    }

    // Si ya se superó el máximo de intentos para este paso y está en failed,
    // lo marcamos como permanente para que la UI lo refleje y no se reintente.
    if (job.step_status === "failed" && job.attempts_count >= this.config.maxAttemptsPerStep) {
      if (!job.last_error?.startsWith("[PERMANENT]")) {
        void this.markJobPermanentlyFailed(job.id, job.last_error ?? "max_attempts_exceeded");
      }
      return false;
    }

    // Si nunca se ha intentado, se puede ejecutar inmediatamente.
    if (!job.last_attempt_at) return true;

    const lastAttemptMs = Date.parse(job.last_attempt_at);
    if (Number.isNaN(lastAttemptMs)) return true;

    const backoffMs = this.computeBackoffMs(job.attempts_count);
    const eligibleAt = lastAttemptMs + backoffMs;

    return nowMs >= eligibleAt;
  }

  private computeBackoffMs(attempts: number): number {
    const base = this.config.baseBackoffMs;
    const max = this.config.maxBackoffMs;

    // backoff exponencial simple: base * 2^attempts, capado en max
    const exp = Math.min(attempts, 10);
    const raw = base * 2 ** exp;
    const capped = Math.min(raw, max);

    // jitter uniforme [ -jitter, +jitter ]
    const jitterRange = capped * this.config.jitterFraction;
    const jitter = (Math.random() * 2 - 1) * jitterRange;

    return Math.max(0, capped + jitter);
  }

  private canProcessNextStep(job: UploadJobRow): boolean {
    return job.step_status === "pending" && job.pipeline_step !== "done";
  }

  // -------------------------------------------------------------------------
  // Máquina de estados del pipeline
  // -------------------------------------------------------------------------

  private async processJob(job: UploadJobRow): Promise<boolean> {
    switch (job.pipeline_step) {
      case "create_session":
        return this.handleCreateSession(job);

      case "upload":
        return this.handleUpload(job);

      case "complete_session":
        return this.handleCompleteSession(job);

      case "evaluation":
        return this.handleEvaluation(job);

      case "done":
      default:
        console.log("[UploadScheduler] processJob(): job ya está en 'done'", { id: job.id });
        return false;
    }
  }

  // Paso 1: create_session -> POST /upload/sessions
  private async handleCreateSession(job: UploadJobRow): Promise<boolean> {
    console.log("[UploadScheduler] handleCreateSession()", { id: job.id });

    await this.jobs.updateJobStep(job.id, "create_session", "running");
    await this.jobs.incrementAttempts(job.id);

    try {
      const t0 = Date.now();
      const response = await this.backend.createUploadSession({
        domain: job.domain,
        clientBatchId: job.client_batch_id,
        qualityAnalysisId: job.quality_analysis_id ?? null,
      });
      console.log("[UploadScheduler] handleCreateSession() OK", { id: job.id, sessionId: response.sessionId, elapsedMs: Date.now() - t0 });

      await this.jobs.setBackendSessionId(job.id, response.sessionId);
      await this.jobs.updateJobStep(job.id, "upload", "pending", {
        resetAttempts: true,
        clearAttemptWindow: true,
      });

      return true;
    } catch (err) {
      const errorMessage = this.normalizeError(err);
      console.warn("[UploadScheduler] handleCreateSession() failed", {
        id: job.id,
        error: errorMessage,
      });

      if (this.isPermanentError(err)) {
        await this.markJobPermanentlyFailed(job.id, errorMessage);
      } else {
        await this.jobs.markJobFailed(job.id, errorMessage);
      }
      return false;
    }
  }

  // Paso 2: upload -> SkyVault (módulo nativo)
  //
  // Notas:
  // - Aquí sólo disparamos la subida nativa.
  // - La transición a 'complete_session' se hará cuando el módulo nativo
  //   emita `session:completed` y el UploadService actualice el job.
  // - Retorna false para detener el loop: el worker nativo emitirá
  //   session:completed que disparará runSchedulerTick() fuera de este tick.
  private async handleUpload(job: UploadJobRow): Promise<boolean> {
    console.log("[UploadScheduler] handleUpload()", { id: job.id });

    if (!job.backend_session_id) {
      const msg = "Invariant: backend_session_id is null in 'upload' step";
      console.error(`[UploadScheduler] ${msg}`, { id: job.id });
      await this.jobs.markJobFailed(job.id, msg);
      return false;
    }

    await this.jobs.updateJobStep(job.id, "upload", "running");
    await this.jobs.incrementAttempts(job.id);

    try {
      const result = await this.nativeUpload.startUploadForJob({
        jobId: job.id,
        backendSessionId: job.backend_session_id,
      });

      await this.jobs.setSkyboltSessionId(job.id, result.skyboltSessionId);
      console.log("[UploadScheduler DIAG] handleUpload: native upload started, skyboltSessionId:", result.skyboltSessionId, "jobId:", job.id);
      try {
        this.onUploadStarted?.(job.id, result.skyboltSessionId);
      } catch (err) {
        console.warn("[UploadScheduler] onUploadStarted callback failed", { jobId: job.id, error: this.normalizeError(err) });
      }

      // No movemos el pipeline_step aquí.
      // Cuando SkyVault termine, emitirá 'session:completed'.
      // El UploadService, al manejar ese evento, deberá:
      //   updateJobStep(jobId, 'complete_session', 'pending', { ... })

      return false;
    } catch (err) {
      const errorMessage = this.normalizeError(err);
      console.warn("[UploadScheduler] handleUpload() failed", {
        id: job.id,
        error: errorMessage,
      });

      await this.jobs.markJobFailed(job.id, errorMessage);
      return false;
    }
  }

  // Paso 3: complete_session -> POST /upload/sessions/:id/complete
  private async handleCompleteSession(job: UploadJobRow): Promise<boolean> {
    console.log("[UploadScheduler] handleCompleteSession()", { id: job.id });

    if (!job.backend_session_id) {
      const msg = "Invariant: backend_session_id is null in 'complete_session' step";
      console.error(`[UploadScheduler] ${msg}`, { id: job.id });
      await this.jobs.markJobFailed(job.id, msg);
      return false;
    }

    await this.jobs.updateJobStep(job.id, "complete_session", "running");
    await this.jobs.incrementAttempts(job.id);

    try {
      await this.backend.completeUploadSession(job.backend_session_id);

      await this.jobs.updateJobStep(job.id, "evaluation", "pending", {
        resetAttempts: true,
        clearAttemptWindow: true,
      });

      return true;
    } catch (err) {
      const errorMessage = this.normalizeError(err);
      console.warn("[UploadScheduler] handleCompleteSession() failed", {
        id: job.id,
        error: errorMessage,
      });

      if (this.isPermanentError(err)) {
        await this.markJobPermanentlyFailed(job.id, errorMessage);
      } else {
        await this.jobs.markJobFailed(job.id, errorMessage);
      }
      return false;
    }
  }

  // Paso 4: evaluation -> POST /evaluations
  private async handleEvaluation(job: UploadJobRow): Promise<boolean> {
    console.log("[UploadScheduler] handleEvaluation()", { id: job.id });

    if (!job.quality_analysis_id || !job.backend_session_id) {
      const msg = "Invariant: quality_analysis_id or backend_session_id is null in 'evaluation' step";
      console.error(`[UploadScheduler] ${msg}`, { id: job.id });
      await this.jobs.markJobFailed(job.id, msg);
      return false;
    }

    await this.jobs.updateJobStep(job.id, "evaluation", "running");
    await this.jobs.incrementAttempts(job.id);

    try {
      await this.backend.createEvaluation({
        qualityAnalysisId: job.quality_analysis_id,
        backendSessionId: job.backend_session_id,
      });

      if (job.total_files === 0 && job.total_bytes === 0) {
        console.warn("[UploadScheduler] handleEvaluation: skipping markJobDone — zero metrics indicate sync failure", { id: job.id });
        await this.jobs.markJobFailed(job.id, "No se pudieron verificar las metricas del analisis.");
        return false;
      }

      await this.jobs.markJobDone(job.id);
      return false;
    } catch (err) {
      const errorMessage = this.normalizeError(err);
      console.warn("[UploadScheduler] handleEvaluation() failed", {
        id: job.id,
        error: errorMessage,
      });

      if (this.isPermanentError(err)) {
        await this.markJobPermanentlyFailed(job.id, errorMessage);
      } else {
        await this.jobs.markJobFailed(job.id, errorMessage);
      }
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Clasificación de errores HTTP
  // -------------------------------------------------------------------------

  private isPermanentError(err: unknown): boolean {
    if (err instanceof UploadApiError) {
      return (
        err.statusCode === 400 ||
        err.statusCode === 401 ||
        err.statusCode === 403 ||
        err.statusCode === 404 ||
        err.statusCode === 409 ||
        err.statusCode === 422
      );
    }
    return false;
  }

  private async markJobPermanentlyFailed(jobId: string, error: string): Promise<void> {
    await this.jobs.markJobFailed(jobId, `[PERMANENT] ${error}`);
  }

  // -------------------------------------------------------------------------
  // Utilidades
  // -------------------------------------------------------------------------

  private normalizeError(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
}
