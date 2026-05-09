/**
 * Upload System v2 — Native Upload Adapter
 *
 * Puente único con el módulo nativo Skybolt.
 * Registra UN SOLO listener global (no en useEffect) y traduce eventos nativos
 * a eventos tipados de la máquina de estados.
 */

import * as Skybolt from "skybolt";
import type { UploadEvent } from "skybolt";
import type { UploadMachineEvent } from "../types";
import { useUploadStore } from "../store/uploadStore";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type NativeEventHandler = (jobId: string, event: UploadMachineEvent) => void;

export interface PreparedSkyboltItem {
  clientItemId: string;
  localUri: string;
  blobName: string;
  contentType: string;
  sizeBytes: number;
  md5Hex: string;
}

// ---------------------------------------------------------------------------
// Registro de listener global (singleton)
// ---------------------------------------------------------------------------

let listenerRegistered = false;
let globalHandler: NativeEventHandler | null = null;

const PROGRESS_EVENT_THROTTLE_MS = 150;

type NativeProgressSnapshot = Awaited<ReturnType<typeof getNativeProgress>>;

const progressCacheBySession = new Map<string, { metrics: NativeProgressSnapshot; fetchedAtMs: number }>();
const progressFetchInFlightBySession = new Map<string, Promise<NativeProgressSnapshot>>();
const lastProgressDispatchAtBySession = new Map<string, number>();
const terminalSessions = new Set<string>();

/**
 * Inicializa el adaptador nativo. Llama una sola vez en el bootstrap de la app.
 */
export function initNativeAdapter(handler: NativeEventHandler): void {
  if (listenerRegistered) {
    console.warn("[NativeUploadAdapter] already initialized, ignoring duplicate init");
    return;
  }
  globalHandler = handler;
  listenerRegistered = true;

  console.log("[DIAG] NativeUploadAdapter — before Skybolt.addUploadListener");

  Skybolt.addUploadListener(async (nativeEvent: UploadEvent) => {
    const ts = Date.now();
    console.log(`[DIAG] NativeUploadAdapter — EVENT_IN type=${nativeEvent.type} sessionId=${(nativeEvent as { sessionId?: string }).sessionId ?? "?"} fullPayload=`, JSON.stringify(nativeEvent).slice(0, 200));

    const sessionId = (nativeEvent as { sessionId?: string }).sessionId ?? "";
    const translatedEvents = await translateNativeEvent(nativeEvent, sessionId);
    if (translatedEvents.length === 0) {
      console.log(`[DIAG] NativeUploadAdapter — EVENT_IGNORED type=${nativeEvent.type} reason=no_translation`);
      return;
    }
    if (!sessionId) return;

    const store = useUploadStore.getState();

    const jobId = store.getJobIdBySkyboltSessionId(sessionId);
    if (!jobId) {
      const knownIds = store.getAllSkyboltSessionIds();
      const allJobs = store.getAllJobIds();
      console.log(`[DIAG] NativeUploadAdapter — SESSION_MISS job for sessionId=${sessionId}`);
      console.log(`[DIAG] NativeUploadAdapter — known skyboltSessionIds=[${knownIds.join(",")}] allJobIds=[${allJobs.join(",")}]`);
      // dump del primer job para diagnóstico
      if (allJobs.length > 0) {
        store.dumpJobContext(allJobs[0]);
      }
      return;
    }

    console.log(`[DIAG] NativeUploadAdapter — SESSION_MATCH sessionId=${sessionId} → jobId=${jobId}`);

    for (const translated of translatedEvents) {
      console.log(`[DIAG] NativeUploadAdapter — translate native=${nativeEvent.type} → machine=${translated.type}`);
      globalHandler?.(jobId, translated);
    }

    console.log(`[DIAG] NativeUploadAdapter — dispatch returned, elapsed=${Date.now() - ts}ms`);
  });

  console.log("[NativeUploadAdapter] global listener registered");
}

// ---------------------------------------------------------------------------
// Operaciones nativas
// ---------------------------------------------------------------------------

export async function initializeAndStartSession(
  sessionId: string,
  items: PreparedSkyboltItem[],
): Promise<void> {
  await Skybolt.initializeSession({
    sessionId,
    items,
    options: {
      maxParallelFiles: 3,
      maxParallelChunks: 4,
      chunkSizeBytes: 4 * 1024 * 1024,
      enableBackground: true,
      allowsCellular: true,
    },
  });

  await Skybolt.startSession(sessionId);
  const progress = await Skybolt.getSessionProgress(sessionId);
  console.log("[NativeUploadAdapter] post-startSession progress:", progress ? `status=${(progress as { status?: string }).status}` : "null");
}

export async function resumeNativeSession(sessionId: string): Promise<void> {
  await Skybolt.resumeSession(sessionId);
}

export async function pauseNativeSession(sessionId: string): Promise<void> {
  await Skybolt.pauseSession(sessionId);
}

export async function cancelNativeSession(sessionId: string): Promise<void> {
  await Skybolt.cancelSession(sessionId);
}

export async function getNativeProgress(sessionId: string): Promise<{
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  status: string;
} | null> {
  const progress = await Skybolt.getSessionProgress(sessionId);
  if (!progress) return null;
  return {
    totalFiles: progress.totalFiles ?? 0,
    completedFiles: progress.completedFiles ?? 0,
    totalBytes: progress.totalBytes ?? 0,
    uploadedBytes: progress.uploadedBytes ?? 0,
    status: (progress as { status?: string }).status ?? "unknown",
  };
}

// ---------------------------------------------------------------------------
// Traducción de eventos nativos → eventos de máquina
// ---------------------------------------------------------------------------

async function translateNativeEvent(
  nativeEvent: UploadEvent,
  sessionId: string,
): Promise<UploadMachineEvent[]> {
  switch (nativeEvent.type) {
    case "session:started":
      clearSessionCoalescingState(sessionId);
      return [{ type: "NATIVE_STARTED", skyboltSessionId: sessionId }];

    case "session:completed":
      terminalSessions.add(sessionId);
      return [
        {
          type: "POLL_TICK",
          status: "completed",
          metrics: await getCoalescedNativeProgress(sessionId, { forceRefresh: true }),
        },
        { type: "NATIVE_COMPLETED" },
      ];

    case "session:failed":
      terminalSessions.add(sessionId);
      return [{ type: "NATIVE_FAILED", error: nativeEvent.error.message }];

    case "session:paused":
      terminalSessions.add(sessionId);
      return [{ type: "NATIVE_PAUSED" }];

    case "session:resumed":
      clearSessionCoalescingState(sessionId);
      return [{ type: "NATIVE_RESUMED" }];

    case "item:progress":
    case "item:completed":
    case "item:failed": {
      if (terminalSessions.has(sessionId)) return [];
      if (shouldSkipProgressEvent(sessionId)) return [];
      const metrics = await getCoalescedNativeProgress(sessionId);
      return [{
        type: "POLL_TICK",
        status: normalizeNativeStatus(metrics?.status),
        metrics,
      }];
    }

    case "auth:required":
      return [{ type: "NATIVE_FAILED", error: "auth_required" }];

    case "error:network":
    case "error:rate-limited":
    case "error:throttled":
    case "error:forbidden":
    case "error:contract":
    case "error:checksum":
    case "error:file-access": {
      const payload = (nativeEvent as { payload?: { message?: string } }).payload;
      return [{ type: "NATIVE_FAILED", error: payload?.message ?? nativeEvent.type }];
    }

    case "upload:recovery-complete":
    case "upload:resume-all-complete":
    case "debug":
    default:
      return [];
  }
}

function normalizeNativeStatus(
  status: string | undefined,
): "completed" | "failed" | "uploading" | "unknown" | null {
  if (!status) return "uploading";
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "preparing" || status === "paused") return "uploading";
  if (status === "uploading") return "uploading";
  return "unknown";
}

async function safeGetNativeProgress(sessionId: string) {
  try {
    return await getNativeProgress(sessionId);
  } catch (err) {
    console.warn(`[NativeUploadAdapter] failed to get native progress for session=${sessionId}:`, err);
    return null;
  }
}

function clearSessionCoalescingState(sessionId: string): void {
  terminalSessions.delete(sessionId);
  progressCacheBySession.delete(sessionId);
  progressFetchInFlightBySession.delete(sessionId);
  lastProgressDispatchAtBySession.delete(sessionId);
}

function shouldSkipProgressEvent(sessionId: string): boolean {
  if (progressFetchInFlightBySession.has(sessionId)) {
    return true;
  }

  const now = Date.now();
  const lastAt = lastProgressDispatchAtBySession.get(sessionId) ?? 0;
  if (now - lastAt < PROGRESS_EVENT_THROTTLE_MS) {
    return true;
  }

  lastProgressDispatchAtBySession.set(sessionId, now);
  return false;
}

async function getCoalescedNativeProgress(
  sessionId: string,
  options?: { forceRefresh?: boolean },
): Promise<NativeProgressSnapshot> {
  const forceRefresh = options?.forceRefresh ?? false;
  const now = Date.now();

  if (!forceRefresh) {
    const cached = progressCacheBySession.get(sessionId);
    if (cached && now - cached.fetchedAtMs < PROGRESS_EVENT_THROTTLE_MS) {
      return cached.metrics;
    }
  }

  const inFlight = progressFetchInFlightBySession.get(sessionId);
  if (inFlight) {
    return inFlight;
  }

  const promise = safeGetNativeProgress(sessionId)
    .then((metrics) => {
      progressCacheBySession.set(sessionId, {
        metrics,
        fetchedAtMs: Date.now(),
      });
      return metrics;
    })
    .finally(() => {
      progressFetchInFlightBySession.delete(sessionId);
    });

  progressFetchInFlightBySession.set(sessionId, promise);
  return promise;
}
