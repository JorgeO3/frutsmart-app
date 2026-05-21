/**
 * Upload System v2 — Zustand Store
 *
 * Único punto de verdad para el estado de upload en memoria.
 * La UI y los servicios leen/escriben a través de este store.
 *
 * Reglas:
 * - Ningún componente muta directamente. Solo dispatch(event).
 * - El store aplica la máquina de estados y persiste effects.
 */

import { create } from "zustand";
import { transition } from "../machine/interpreter";
import type {
  UploadStateValue,
  UploadMachineEvent,
  UploadJobContext,
  UploadJobSnapshot,
  TransitionResult,
} from "../types";

// ---------------------------------------------------------------------------
// Estado interno del store
// ---------------------------------------------------------------------------

interface JobEntry {
  state: UploadStateValue;
  context: UploadJobContext;
}

// ---------------------------------------------------------------------------
// Snapshot caches ( WeakMap → auto-GC when old Map/entry is dropped )
// ---------------------------------------------------------------------------

const allSnapshotsCache = new WeakMap<Map<string, JobEntry>, UploadJobSnapshot[]>();
const singleSnapshotCache = new WeakMap<JobEntry, UploadJobSnapshot>();

interface UploadStoreState {
  jobs: Map<string, JobEntry>;
}

interface UploadStoreActions {
  /**
   * Carga un job desde la DB al store (rehidratación).
   */
  loadJob: (ctx: UploadJobContext, state: UploadStateValue) => void;

  /**
   * Descarga un job del store (cuando se elimina de la DB).
   */
  unloadJob: (jobId: string) => void;

  /**
   * Único punto de entrada para mutar estado.
   * Aplica la máquina de estados y retorna el resultado de la transición.
   */
  dispatch: (jobId: string, event: UploadMachineEvent) => TransitionResult | null;

  /**
   * Snapshot de un job para la UI (derivado, no almacenado).
   */
  getSnapshot: (jobId: string) => UploadJobSnapshot | null;

  /**
   * Lista de todos los snapshots.
   */
  getAllSnapshots: () => UploadJobSnapshot[];

  /**
   * Jobs que están en estados terminales.
   */
  getTerminalJobIds: () => string[];

  /**
   * Jobs que necesitan un SCHEDULER_TICK (no terminales, no pausados).
   */
  getRunnableJobIds: () => string[];

  /**
   * Busca el jobId asociado a un skyboltSessionId (para mapear eventos nativos).
   */
  getJobIdBySkyboltSessionId: (skyboltSessionId: string) => string | null;

  /**
   * Retorna el entry completo de un job (estado + contexto).
   */
  getEntry: (jobId: string) => JobEntry | undefined;

  /**
   * Retorna todos los skyboltSessionId activos.
   */
  getAllSkyboltSessionIds: () => string[];

  /**
   * Retorna todos los jobIds.
   */
  getAllJobIds: () => string[];

  /**
   * Log de diagnóstico con el estado completo de un job.
   */
  dumpJobContext: (jobId: string) => void;
}

export type UploadStore = UploadStoreState & UploadStoreActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUploadStore = create<UploadStore>((set, get) => ({
  jobs: new Map(),

  loadJob: (ctx, state) => {
    console.log(`[DIAG] UploadStore loadJob — jobId=${ctx.jobId}, state=${state}`);
    const ts = Date.now();
    set((s) => {
      const next = new Map(s.jobs);
      next.set(ctx.jobId, { state, context: ctx });
      return { jobs: next };
    });
    console.log(`[DIAG] UploadStore loadJob done — jobId=${ctx.jobId}, elapsed=${Date.now() - ts}ms`);
  },

  unloadJob: (jobId) => {
    set((s) => {
      const next = new Map(s.jobs);
      next.delete(jobId);
      return { jobs: next };
    });
  },

  dispatch: (jobId, event) => {
    const ts = Date.now();
    const entry = get().jobs.get(jobId);
    if (!entry) {
      console.warn(`[UploadStore] dispatch: job ${jobId} no encontrado`);
      return null;
    }

    const result = transition(entry.state, event, entry.context);
    if (!result) {
      console.log(`[DIAG] uploadStore dispatch NOOP — jobId=${jobId}, event=${event.type}, state=${entry.state}, reason=no_matching_transition`);
      return null;
    }

    set((s) => {
      const next = new Map(s.jobs);
      next.set(jobId, { state: result.state, context: result.context });
      return { jobs: next };
    });

    console.log(`[DIAG] UploadStore dispatch — jobId=${jobId}, event=${event.type}, transition: ${entry.state} → ${result.state} (${result.effects.length} effects), elapsed=${Date.now() - ts}ms`);

    return result;
  },

  getSnapshot: (jobId) => {
    const entry = get().jobs.get(jobId);
    if (!entry) return null;
    const cached = singleSnapshotCache.get(entry);
    if (cached) return cached;
    const snap = toSnapshot(entry.state, entry.context);
    singleSnapshotCache.set(entry, snap);
    return snap;
  },

  getAllSnapshots: () => {
    const jobs = get().jobs;
    const cached = allSnapshotsCache.get(jobs);
    if (cached) return cached;
    const snapshots: UploadJobSnapshot[] = [];
    for (const [, entry] of jobs) {
      const snap = singleSnapshotCache.get(entry);
      if (snap) {
        snapshots.push(snap);
      } else {
        const fresh = toSnapshot(entry.state, entry.context);
        singleSnapshotCache.set(entry, fresh);
        snapshots.push(fresh);
      }
    }
    const result = snapshots.sort((a, b) => b.context.createdAt - a.context.createdAt);
    allSnapshotsCache.set(jobs, result);
    return result;
  },

  getTerminalJobIds: () => {
    const ids: string[] = [];
    for (const [jobId, entry] of get().jobs) {
      if (entry.state.startsWith("done.")) {
        ids.push(jobId);
      }
    }
    return ids;
  },

  getRunnableJobIds: () => {
    const ids: string[] = [];
    for (const [jobId, entry] of get().jobs) {
      const state = entry.state;
      if (state.startsWith("done.")) continue;
      if (state === "upload.paused") continue;
      ids.push(jobId);
    }
    return ids;
  },

  getJobIdBySkyboltSessionId: (skyboltSessionId) => {
    for (const [jobId, entry] of get().jobs) {
      if (entry.context.skyboltSessionId === skyboltSessionId) return jobId;
    }
    return null;
  },

  getEntry: (jobId) => {
    return get().jobs.get(jobId);
  },

  getAllSkyboltSessionIds: () => {
    const ids: string[] = [];
    for (const [, entry] of get().jobs) {
      if (entry.context.skyboltSessionId) {
        ids.push(entry.context.skyboltSessionId);
      }
    }
    return ids;
  },

  getAllJobIds: () => {
    return Array.from(get().jobs.keys());
  },

  dumpJobContext: (jobId) => {
    const entry = get().jobs.get(jobId);
    if (!entry) {
      console.log(`[DIAG] dumpJob — ${jobId} NOT_FOUND`);
      return;
    }
    const ctx = entry.context;
    console.log(
      `[DIAG] dumpJob — jobId=${jobId} | state=${entry.state} | ` +
      `backendSessionId=${ctx.backendSessionId} | ` +
      `skyboltSessionId=${ctx.skyboltSessionId} | ` +
      `files=${ctx.completedFiles}/${ctx.totalFiles} | ` +
      `bytes=${ctx.uploadedBytes}/${ctx.totalBytes} | ` +
      `lastError=${ctx.lastError} | attempts=${ctx.attempts}`
    );
  },
}));

// ---------------------------------------------------------------------------
// Helper: derivar snapshot para UI
// ---------------------------------------------------------------------------

function toSnapshot(state: UploadStateValue, ctx: UploadJobContext): UploadJobSnapshot {
  const isTerminal = state.startsWith("done.");

  const progressPercent =
    ctx.totalBytes > 0
      ? Math.min(100, Math.round((ctx.uploadedBytes / ctx.totalBytes) * 100))
      : ctx.totalFiles > 0
        ? Math.min(100, Math.round((ctx.completedFiles / ctx.totalFiles) * 100))
        : 0;

  let displayStatus: UploadJobSnapshot["displayStatus"];
  if (state.startsWith("done.success")) displayStatus = "completed";
  else if (state.startsWith("done.permanently_failed")) displayStatus = "permanently_failed";
  else if (state.endsWith(".failed")) displayStatus = "failed";
  else if (state === "upload.paused") displayStatus = "paused";
  else if (state.endsWith(".running") || state.endsWith(".uploading")) displayStatus = "running";
  else displayStatus = "pending";

  return {
    jobId: ctx.jobId,
    state,
    context: ctx,
    progressPercent,
    isTerminal,
    canRetry: state.endsWith(".failed") || state.startsWith("done.permanently_failed"),
    canCancel: !isTerminal,
    canPause: state === "upload.uploading",
    displayStatus,
  };
}
