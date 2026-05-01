import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  CloudUploadSettings,
  ItemProgress,
  ItemStatus,
  PauseReason,
  SessionProgress,
  UploadEvent,
  UploadStatus,
} from "./Skybolt.types";
import * as Skybolt from "./SkyboltModule";

const PauseReasons = {
  Auth: "auth",
  Error: "error",
} as const satisfies Record<string, PauseReason>;

// ============================================================================
// Types públicos
// ============================================================================

export type FileItem = {
  id: string;
  uri: string;
  name: string;
  size: number;
  progress: number;
  status: ItemStatus;
  retries?: number;
};

export type StartUploadOptions = {
  withPolling?: boolean;
};

type SkyboltContextValue = {
  // State
  isReady: boolean;
  status: UploadStatus;
  files: FileItem[];
  sessionId: string | null;
  overall: SessionProgress | null;
  error: string | null;
  pauseReason: PauseReason | null;

  // Métricas
  transferRateBps: number;
  estimatedTimeMs: number;

  // Config
  configure: (config: CloudUploadSettings) => Promise<void>;

  // Control de sesión
  startUpload: (opts?: StartUploadOptions) => Promise<void>;
  pauseUpload: () => Promise<void>;
  resumeUpload: () => Promise<void>;
  cancelUpload: () => Promise<void>;

  // Gestión de archivos
  addFiles: (newFiles: FileItem[]) => void;
  removeFile: (id: string) => void;
  reset: () => void;

  // Auth
  notifyAuthRefreshed: () => Promise<void>;

  // Polling
  setPollingEnabled: (enabled: boolean) => void;

  // Setters avanzados (por si los necesitas desde fuera)
  setSessionId: (id: string | null) => void;
  setStatus: (s: UploadStatus) => void;
  setOverall: (o: SessionProgress | null) => void;
  setError: (e: string | null) => void;
};

// ============================================================================
// Context
// ============================================================================

const SkyboltNativeUploadContext = createContext<SkyboltContextValue | null>(
  null,
);

type Props = {
  children: ReactNode;
};

export function SkyboltNativeUploadProvider({ children }: Props) {
  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------

  const [isReady, setIsReady] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [overall, setOverall] = useState<SessionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pauseReason, setPauseReason] = useState<PauseReason | null>(null);

  const [transferRateBps, setTransferRateBps] = useState(0);
  const [estimatedTimeMs, setEstimatedTimeMs] = useState(0);

  // --------------------------------------------------------------------------
  // Refs - estado que no dispara renders
  // --------------------------------------------------------------------------

  const sessionRef = useRef(sessionId);
  const bytesRef = useRef<Map<string, { uploaded: number; total: number }>>(
    new Map(),
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingEnabledRef = useRef(false);

  const progressBufferRef = useRef<Map<string, ItemProgress>>(new Map());
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastUpdateTimeRef = useRef<number>(0);
  const lastUploadedBytesRef = useRef<number>(0);

  const sessionTotalBytesRef = useRef<number>(0);
  const uploadedTotalRef = useRef<number>(0);

  useEffect(() => {
    sessionRef.current = sessionId;
  }, [sessionId]);

  // --------------------------------------------------------------------------
  // Configuración
  // --------------------------------------------------------------------------

  const configure = useCallback(async (config: CloudUploadSettings) => {
    try {
      await Skybolt.configure(config);
      setIsReady(true);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Configuration failed");
    }
  }, []);

  // --------------------------------------------------------------------------
  // Polling
  // --------------------------------------------------------------------------

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (sid: string) => {
      if (!pollingEnabledRef.current || pollRef.current) return;

      pollRef.current = setInterval(async () => {
        try {
          const progress = await Skybolt.getSessionProgress(sid);
          setOverall(progress ?? null);

          if (
            progress?.status === "completed" ||
            progress?.status === "failed"
          ) {
            stopPolling();
          }
        } catch {
          stopPolling();
        }
      }, 1000);
    },
    [stopPolling],
  );

  // --------------------------------------------------------------------------
  // Métricas agregadas
  // --------------------------------------------------------------------------

  const updateMetrics = useCallback(
    (currentUploadedBytes: number, totalBytes: number) => {
      const now = Date.now();
      const lastTime = lastUpdateTimeRef.current;
      const lastBytes = lastUploadedBytesRef.current;

      if (lastTime > 0 && now > lastTime) {
        const timeDiffMs = now - lastTime;
        const bytesDiff = currentUploadedBytes - lastBytes;

        if (bytesDiff >= 0) {
          const instantRate = (bytesDiff / timeDiffMs) * 1000;

          setTransferRateBps((prevRate) => {
            const newRate =
              prevRate === 0 ? instantRate : prevRate * 0.7 + instantRate * 0.3;

            const remainingBytes = totalBytes - currentUploadedBytes;
            const newEta = newRate > 0 ? (remainingBytes / newRate) * 1000 : 0;
            setEstimatedTimeMs(newEta);

            return newRate;
          });
        }
      }

      lastUpdateTimeRef.current = now;
      lastUploadedBytesRef.current = currentUploadedBytes;
    },
    [],
  );

  // --------------------------------------------------------------------------
  // Flush de progreso (throttling)
  // --------------------------------------------------------------------------

  const flushProgressUpdates = useCallback(() => {
    const updates = progressBufferRef.current;
    flushTimeoutRef.current = null;

    if (updates.size === 0) {
      return;
    }

    progressBufferRef.current = new Map();

    const updatedIds = new Set<string>();

    updates.forEach((progress) => {
      const prev = bytesRef.current.get(progress.clientItemId);
      const prevUploaded = prev?.uploaded ?? 0;
      const delta = progress.bytesUploaded - prevUploaded;

      if (delta > 0) {
        uploadedTotalRef.current += delta;
      }

      bytesRef.current.set(progress.clientItemId, {
        uploaded: progress.bytesUploaded,
        total: progress.totalBytes,
      });

      updatedIds.add(progress.clientItemId);
    });

    if (updatedIds.size === 0) {
      return;
    }

    setFiles((prev) =>
      prev.map((file) => {
        if (!updatedIds.has(file.id)) return file;

        const update = updates.get(file.id);
        if (!update) return file;

        return {
          ...file,
          status: update.status || "uploading",
          progress: update.totalBytes
            ? (update.bytesUploaded / update.totalBytes) * 100
            : 0,
          retries: update.retries,
        };
      }),
    );

    const totalBytes =
      sessionTotalBytesRef.current > 0
        ? sessionTotalBytesRef.current
        : uploadedTotalRef.current;

    updateMetrics(uploadedTotalRef.current, totalBytes);

    setOverall((prev) =>
      prev
        ? {
            ...prev,
            status: "uploading",
            uploadedBytes: uploadedTotalRef.current,
            totalBytes: prev.totalBytes || totalBytes,
          }
        : prev,
    );
  }, [updateMetrics]);

  const queueProgressUpdate = useCallback(
    (progress: ItemProgress) => {
      progressBufferRef.current.set(progress.clientItemId, progress);

      if (!flushTimeoutRef.current) {
        flushTimeoutRef.current = setTimeout(flushProgressUpdates, 200);
      }
    },
    [flushProgressUpdates],
  );

  // --------------------------------------------------------------------------
  // Control de sesión
  // --------------------------------------------------------------------------

  const startUpload = useCallback(
    async (opts: StartUploadOptions = {}) => {
      if (!files.length) {
        setError("No files to upload");
        return;
      }

      try {
        pollingEnabledRef.current = !!opts.withPolling;
        const sid = `upload-${Date.now()}`;

        setSessionId(sid);
        setStatus("uploading");
        setError(null);
        setPauseReason(null);
        stopPolling();
        bytesRef.current.clear();
        uploadedTotalRef.current = 0;
        sessionTotalBytesRef.current = 0;

        setTransferRateBps(0);
        setEstimatedTimeMs(0);
        lastUpdateTimeRef.current = Date.now();
        lastUploadedBytesRef.current = 0;

        const now = Date.now();

        const items = files.map((file) => ({
          clientItemId: file.id,
          localUri: file.uri,
          blobName: `uploads/${now}-${file.name}`,
          contentType: "application/octet-stream",
          sizeBytes: file.size,
          metadata: { originalName: file.name },
        }));

        const totalBytes = items.reduce((acc, item) => acc + item.sizeBytes, 0);
        sessionTotalBytesRef.current = totalBytes;
        uploadedTotalRef.current = 0;

        await Skybolt.initializeSession({
          sessionId: sid,
          items,
          options: {
            maxParallelFiles: 3,
            maxParallelChunks: 4,
            chunkSizeBytes: 4 * 1024 * 1024,
            enableBackground: true,
          },
        });

        await Skybolt.startSession(sid);

        setOverall({
          sessionId: sid,
          status: "uploading",
          totalFiles: items.length,
          completedFiles: 0,
          totalBytes,
          uploadedBytes: 0,
        });

        if (opts.withPolling) {
          startPolling(sid);
        }
      } catch (e: unknown) {
        setStatus("failed");
        setPauseReason(PauseReasons.Error);
        setError((e as Error)?.message ?? "Upload start failed");
        stopPolling();
      }
    },
    [files, startPolling, stopPolling],
  );

  const pauseUpload = useCallback(async () => {
    const sid = sessionRef.current;
    if (!sid) return;

    await Skybolt.pauseSession(sid);
    setStatus("paused");
  }, []);

  const resumeUpload = useCallback(async () => {
    const sid = sessionRef.current;
    if (!sid) return;

    await Skybolt.resumeSession(sid);
    setStatus("uploading");
    setPauseReason(null);
  }, []);

  const cancelUpload = useCallback(async () => {
    const sid = sessionRef.current;
    if (!sid) return;

    await Skybolt.cancelSession(sid);
    setStatus("idle");
    setSessionId(null);
    setOverall(null);
    setError(null);
    setPauseReason(null);
    stopPolling();
    bytesRef.current.clear();
    uploadedTotalRef.current = 0;
    sessionTotalBytesRef.current = 0;
    setTransferRateBps(0);
    setEstimatedTimeMs(0);
    progressBufferRef.current = new Map();
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
  }, [stopPolling]);

  // --------------------------------------------------------------------------
  // Manejo de eventos nativos (global)
  // --------------------------------------------------------------------------

  const onEvent = useCallback(
    (event: UploadEvent) => {
      console.log("[SkyboltNativeUploadProvider DIAG] onEvent received:", event.type, "sessionId:", (event as { sessionId?: string }).sessionId);
      const currentSessionId = sessionRef.current;

      const isGlobalEvent =
        event.type === "auth:required" ||
        event.type === "upload:recovery-complete" ||
        event.type === "upload:resume-all-complete" ||
        event.type === "debug";

      const eventHasSession =
        "sessionId" in event &&
        typeof event.sessionId === "string" &&
        !!event.sessionId;

      if (!isGlobalEvent) {
        if (!currentSessionId) {
          return;
        }
        if (!eventHasSession || event.sessionId !== currentSessionId) {
          return;
        }
      }

      switch (event.type) {
        case "session:started":
          setStatus("uploading");
          setPauseReason(null);
          break;

        case "session:paused":
          setStatus("paused");
          setPauseReason(event.reason);
          break;

        case "session:resumed":
          setStatus("uploading");
          setPauseReason(null);
          break;

        case "session:completed":
          setStatus("completed");
          setPauseReason(null);
          setOverall((prev) =>
            prev
              ? {
                  ...prev,
                  status: "completed",
                  uploadedBytes: prev.totalBytes,
                }
              : prev,
          );
          setTransferRateBps(0);
          setEstimatedTimeMs(0);
          stopPolling();
          break;

        case "session:failed":
          setStatus("failed");
          setPauseReason(PauseReasons.Error);
          setError(event.error.message);
          setOverall((prev) => (prev ? { ...prev, status: "failed" } : prev));
          stopPolling();
          break;

        case "item:progress":
          queueProgressUpdate(event.payload);
          break;

        case "item:completed":
          setFiles((prev) =>
            prev.map((file) =>
              file.id === event.payload.clientItemId
                ? { ...file, status: "completed", progress: 100 }
                : file,
            ),
          );
          setOverall((prev) =>
            prev
              ? {
                  ...prev,
                  completedFiles: Math.min(
                    prev.totalFiles,
                    (prev.completedFiles ?? 0) + 1,
                  ),
                }
              : prev,
          );
          break;

        case "item:failed":
          setFiles((prev) =>
            prev.map((file) =>
              file.id === event.payload.clientItemId
                ? { ...file, status: "failed" }
                : file,
            ),
          );
          break;

        case "auth:required":
          setStatus("paused");
          setPauseReason(PauseReasons.Auth);
          setError("Sesión expirada. Por favor inicia sesión nuevamente.");
          break;

        case "error:forbidden":
          setError(`Sin permisos: ${event.payload.message}`);
          break;

        case "error:rate-limited":
        case "error:throttled":
          setError(
            `Alto tráfico. Esperando ${Math.ceil(
              event.payload.retryAfterMs / 1000,
            )}s...`,
          );
          break;

        case "error:contract":
          setError(
            "Necesita actualización. Contacta soporte o actualiza la app.",
          );
          break;

        case "error:network":
          setError(
            `Error de red (intento ${event.payload.attempt}). Reintentando...`,
          );
          break;

        case "error:checksum":
          setError("Error de integridad. Si persiste, contacta soporte.");
          break;

        case "error:file-access":
          setError(`No se pudo acceder al archivo: ${event.payload.message}`);
          break;

        default:
          break;
      }
    },
    [stopPolling, queueProgressUpdate],
  );

  useEffect(() => {
    const subscription = Skybolt.addUploadListener(onEvent);

    return () => {
      subscription.remove?.();
      stopPolling();
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      progressBufferRef.current = new Map();
    };
  }, [onEvent, stopPolling]);

  // --------------------------------------------------------------------------
  // Gestión de archivos
  // --------------------------------------------------------------------------

  const addFiles = useCallback((newFiles: FileItem[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
    bytesRef.current.delete(id);
  }, []);

  const reset = useCallback(() => {
    setFiles([]);
    setSessionId(null);
    setStatus("idle");
    setOverall(null);
    setError(null);
    setPauseReason(null);
    bytesRef.current.clear();
    uploadedTotalRef.current = 0;
    sessionTotalBytesRef.current = 0;
    stopPolling();
    setTransferRateBps(0);
    setEstimatedTimeMs(0);
    progressBufferRef.current = new Map();
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
  }, [stopPolling]);

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  const notifyAuthRefreshed = useCallback(async () => {
    try {
      await Skybolt.notifyAuthRefreshed();
      setPauseReason(null);
    } catch (err) {
      console.error("Failed to notify auth refresh:", err);
      throw err;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Value de contexto
  // --------------------------------------------------------------------------

  const value = useMemo<SkyboltContextValue>(
    () => ({
      isReady,
      status,
      files,
      sessionId,
      overall,
      error,
      pauseReason,
      transferRateBps,
      estimatedTimeMs,
      configure,
      startUpload,
      pauseUpload,
      resumeUpload,
      cancelUpload,
      setSessionId,
      setStatus,
      setOverall,
      setError,
      addFiles,
      removeFile,
      reset,
      notifyAuthRefreshed,
      setPollingEnabled: (enabled: boolean) => {
        pollingEnabledRef.current = enabled;
      },
    }),
    [
      isReady,
      status,
      files,
      sessionId,
      overall,
      error,
      pauseReason,
      transferRateBps,
      estimatedTimeMs,
      configure,
      startUpload,
      pauseUpload,
      resumeUpload,
      cancelUpload,
      addFiles,
      removeFile,
      reset,
      notifyAuthRefreshed,
    ],
  );

  return (
    <SkyboltNativeUploadContext.Provider value={value}>
      {children}
    </SkyboltNativeUploadContext.Provider>
  );
}

// ============================================================================
// Hook público
// ============================================================================

export function useSkyboltNativeUpload() {
  const ctx = useContext(SkyboltNativeUploadContext);
  if (!ctx) {
    throw new Error(
      "useSkyboltNativeUpload must be used within a SkyboltNativeUploadProvider",
    );
  }
  return ctx;
}
