import type { UploadJobViewModel } from "@services/uploads/types";
import type { DatabaseConnection } from "../database/DatabaseConnection";
import type {
  UploadJobPipelineStep,
  UploadJobRow,
  UploadJobStatus,
} from "../types";

const SQL = {
  INSERT: `
    INSERT INTO upload_jobs (
      id,
      quality_analysis_id,
      domain,
      client_batch_id,
      backend_session_id,
      skybolt_session_id,
      pipeline_step,
      step_status,
      total_files,
      completed_files,
      total_bytes,
      uploaded_bytes,
      last_error,
      attempts_count,
      last_attempt_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
  FIND_BY_ID: `
    SELECT *
    FROM upload_jobs
    WHERE id = ?;
  `,
  /**
   * Jobs “runnable” para el scheduler:
   *  - pipeline_step != 'done'
   *  - step_status en ('pending', 'failed')
   */
  FIND_RUNNABLE: `
    SELECT *
    FROM upload_jobs
    WHERE pipeline_step <> 'done'
      AND step_status IN ('pending', 'failed')
    ORDER BY created_at ASC;
  `,
  UPDATE_STEP: `
    UPDATE upload_jobs
    SET pipeline_step = ?,
        step_status   = ?,
        attempts_count = CASE WHEN ? THEN 0 ELSE attempts_count END,
        last_attempt_at = CASE WHEN ? THEN NULL ELSE last_attempt_at END,
        updated_at    = ?
    WHERE id = ?;
  `,
  DELETE_BY_ID: `
    DELETE FROM upload_jobs
    WHERE id = ?;
  `,
  SET_BACKEND_SESSION_ID: `
    UPDATE upload_jobs
    SET backend_session_id = ?,
        updated_at = ?
    WHERE id = ?;
  `,
  SET_SKYBOLT_SESSION_ID: `
    UPDATE upload_jobs
    SET skybolt_session_id = ?,
        updated_at = ?
    WHERE id = ?;
  `,
  UPDATE_METRICS: `
    UPDATE upload_jobs
    SET total_files     = ?,
        completed_files = ?,
        total_bytes     = ?,
        uploaded_bytes  = ?,
        updated_at      = ?
    WHERE id = ?;
  `,
  MARK_FAILED: `
    UPDATE upload_jobs
    SET step_status    = 'failed',
        last_error     = ?,
        last_attempt_at = ?,
        updated_at     = ?
    WHERE id = ?;
  `,
  MARK_DONE: `
    UPDATE upload_jobs
    SET pipeline_step  = 'done',
        step_status    = 'success',
        updated_at     = ?
    WHERE id = ?;
  `,
  INCREMENT_ATTEMPTS: `
    UPDATE upload_jobs
    SET attempts_count = attempts_count + 1,
        last_attempt_at = ?,
        updated_at     = ?
    WHERE id = ?;
  `,
  /**
   * Proyección para la UI.
   * Si luego quieres enriquecer con info de quality_analyses, puedes
   * hacer un JOIN aquí.
   */
  FIND_ALL_VIEW: `
    SELECT
      id,
      quality_analysis_id,
      domain,
      skybolt_session_id,
      pipeline_step,
      step_status,
      total_files,
      completed_files,
      total_bytes,
      uploaded_bytes,
      last_error,
      attempts_count,
      created_at,
      updated_at
    FROM upload_jobs
    ORDER BY created_at DESC;
  `,
  FIND_ALL: `
    SELECT *
    FROM upload_jobs
    ORDER BY created_at DESC;
  `,
  FIND_BY_SKYBOLT_SESSION_ID: `
    SELECT *
    FROM upload_jobs
    WHERE skybolt_session_id = ?
    LIMIT 1;
  `,
};

export class UploadJobsRepository {
  constructor(private readonly db: DatabaseConnection) { }

  // ---------------------------------------------------------------------------
  // Creación
  // ---------------------------------------------------------------------------
  public async createJob(job: UploadJobRow): Promise<void> {
    await this.db.execute(SQL.INSERT, [
      job.id,
      job.quality_analysis_id ?? null,
      job.domain,
      job.client_batch_id,
      job.backend_session_id ?? null,
      job.skybolt_session_id ?? null,
      job.pipeline_step,
      job.step_status,
      job.total_files,
      job.completed_files,
      job.total_bytes,
      job.uploaded_bytes,
      job.last_error ?? null,
      job.attempts_count ?? 0,
      job.last_attempt_at ?? null,
      job.created_at,
      job.updated_at,
    ]);
  }

  // ---------------------------------------------------------------------------
  // Lectura
  // ---------------------------------------------------------------------------
  public findJobById(id: string): Promise<UploadJobRow | null> {
    return this.db.get<UploadJobRow>(SQL.FIND_BY_ID, [id]);
  }

  public findBySkyboltSessionId(
    skyboltSessionId: string,
  ): Promise<UploadJobRow | null> {
    return this.db.get<UploadJobRow>(SQL.FIND_BY_SKYBOLT_SESSION_ID, [
      skyboltSessionId,
    ]);
  }

  /**
   * Jobs candidatos a ejecución / reintento por el scheduler.
   */
  public getRunnableJobs(): Promise<UploadJobRow[]> {
    return this.db.getAll<UploadJobRow>(SQL.FIND_RUNNABLE);
  }

  // ---------------------------------------------------------------------------
  // Actualizaciones de estado / pipeline
  // ---------------------------------------------------------------------------
  public async updateJobStep(
    jobId: string,
    pipelineStep: UploadJobPipelineStep,
    stepStatus: UploadJobStatus,
    options: { resetAttempts?: boolean; clearAttemptWindow?: boolean } = {},
  ): Promise<void> {
    const now = new Date().toISOString();
    const resetAttempts = options.resetAttempts ?? false;
    const clearAttemptWindow = resetAttempts || options.clearAttemptWindow === true;
    await this.db.execute(SQL.UPDATE_STEP, [
      pipelineStep,
      stepStatus,
      resetAttempts ? 1 : 0,
      clearAttemptWindow ? 1 : 0,
      now,
      jobId,
    ]);
  }

  public async deleteJob(jobId: string): Promise<void> {
    await this.db.execute(SQL.DELETE_BY_ID, [jobId]);
  }

  public async setBackendSessionId(
    jobId: string,
    backendSessionId: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(SQL.SET_BACKEND_SESSION_ID, [backendSessionId, now, jobId]);
  }

  public async setSkyboltSessionId(
    jobId: string,
    skyboltSessionId: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(SQL.SET_SKYBOLT_SESSION_ID, [skyboltSessionId, now, jobId]);
  }

  public async updateJobMetrics(
    jobId: string,
    params: {
      totalFiles: number;
      completedFiles: number;
      totalBytes: number;
      uploadedBytes: number;
    },
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(SQL.UPDATE_METRICS, [
      params.totalFiles,
      params.completedFiles,
      params.totalBytes,
      params.uploadedBytes,
      now,
      jobId,
    ]);
  }

  public async markJobFailed(
    jobId: string,
    lastError: string | null,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(SQL.MARK_FAILED, [
      lastError,
      now,
      now,
      jobId,
    ]);
  }

  public async markJobDone(jobId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(SQL.MARK_DONE, [
      now,
      jobId,
    ]);
  }

  public async incrementAttempts(jobId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(SQL.INCREMENT_ATTEMPTS, [
      now,
      now,
      jobId,
    ]);
  }

  // ---------------------------------------------------------------------------
  // Proyección para UI
  // ---------------------------------------------------------------------------
  public async getAllJobs(): Promise<UploadJobRow[]> {
    return this.db.getAll<UploadJobRow>(SQL.FIND_ALL);
  }

  public async getAllJobsView(): Promise<UploadJobViewModel[]> {
    const rows = await this.db.getAll<{
      id: string;
      quality_analysis_id: string | null;
      domain: "plant" | "field";
      skybolt_session_id: string | null;
      pipeline_step: UploadJobPipelineStep;
      step_status: UploadJobStatus;
      total_files: number;
      completed_files: number;
      total_bytes: number;
      uploaded_bytes: number;
      last_error: string | null;
      attempts_count: number;
      created_at: string;
      updated_at: string;
    }>(SQL.FIND_ALL_VIEW);

    return rows.map((r) => ({
      id: r.id,
      qualityAnalysisId: r.quality_analysis_id,
      domain: r.domain,
      skyboltSessionId: r.skybolt_session_id,
      pipelineStep: r.pipeline_step,
      status: r.step_status,
      totalFiles: r.total_files,
      completedFiles: r.completed_files,
      totalBytes: r.total_bytes,
      uploadedBytes: r.uploaded_bytes,
      lastError: r.last_error,
      attemptsCount: r.attempts_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }
}
