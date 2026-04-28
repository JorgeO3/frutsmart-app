import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// ============================================================================
// Types
// ============================================================================

type FileItem = {
  id: string;
  uri: string;
  name: string;
  size: number;
  progress: number;
  status: ItemStatus;
  retries?: number;
};

type StartUploadOptions = {
  withPolling?: boolean;
};

// ============================================================================
// Hook: useSkybolt
// ============================================================================

/**
 * Custom hook for managing file uploads using the Skybolt module.
 * Handles session lifecycle, progress tracking, transfer rate calculation, and file management.
 * 
 * @returns Object with upload state and control methods
 */
export function useSkybolt() {
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

  // Enhanced metrics
  const [transferRateBps, setTransferRateBps] = useState(0);
  const [estimatedTimeMs, setEstimatedTimeMs] = useState(0);

  // --------------------------------------------------------------------------
  // Refs - Prevent stale closures & track metrics
  // --------------------------------------------------------------------------

  const filesRef = useRef(files);
  const sessionRef = useRef(sessionId);
  const bytesRef = useRef<Map<string, { uploaded: number; total: number }>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingEnabledRef = useRef(false);

  // Rate calculation refs
  const lastUpdateTimeRef = useRef<number>(0);
  const lastUploadedBytesRef = useRef<number>(0);

  // Keep refs in sync with state
  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => { sessionRef.current = sessionId; }, [sessionId]);

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Initialize Skybolt with cloud upload settings.
   * Must be called before starting uploads.
   */
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
  // Progress Polling
  // --------------------------------------------------------------------------

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((sid: string) => {
    if (!pollingEnabledRef.current || pollRef.current) return;

    pollRef.current = setInterval(async () => {
      try {
        const progress = await Skybolt.getSessionProgress(sid);
        setOverall(progress ?? null);

        // Stop polling when session is complete or failed
        if (progress?.status === "completed" || progress?.status === "failed") {
          stopPolling();
        }
      } catch {
        stopPolling();
      }
    }, 1000);
  }, [stopPolling]);

  // --------------------------------------------------------------------------
  // Metrics Calculation
  // --------------------------------------------------------------------------

  const updateMetrics = useCallback((currentUploadedBytes: number, totalBytes: number) => {
    const now = Date.now();
    const lastTime = lastUpdateTimeRef.current;
    const lastBytes = lastUploadedBytesRef.current;

    if (lastTime > 0 && now > lastTime) {
      const timeDiffMs = now - lastTime;
      const bytesDiff = currentUploadedBytes - lastBytes;

      // Only update if we have progress
      if (bytesDiff >= 0) {
        const instantRate = (bytesDiff / timeDiffMs) * 1000; // bytes per second

        // Smooth the rate with exponential moving average (30% new, 70% old)
        setTransferRateBps(prevRate => {
          const newRate = prevRate === 0 ? instantRate : prevRate * 0.7 + instantRate * 0.3;

          // Calculate ETA based on new smoothed rate
          const remainingBytes = totalBytes - currentUploadedBytes;
          const newEta = newRate > 0 ? (remainingBytes / newRate) * 1000 : 0;
          setEstimatedTimeMs(newEta);

          return newRate;
        });
      }
    }

    lastUpdateTimeRef.current = now;
    lastUploadedBytesRef.current = currentUploadedBytes;
  }, []);

  // --------------------------------------------------------------------------
  // Progress Updates
  // --------------------------------------------------------------------------

  /**
   * Update progress for individual file and aggregate session progress.
   */
  const updateProgressForItem = useCallback((progress: ItemProgress) => {
    // Track bytes for this item
    bytesRef.current.set(progress.clientItemId, {
      uploaded: progress.bytesUploaded,
      total: progress.totalBytes,
    });

    // Update individual file progress
    setFiles(prev =>
      prev.map(file =>
        file.id === progress.clientItemId
          ? {
            ...file,
            status: progress.status || "uploading",
            progress: progress.totalBytes
              ? (progress.bytesUploaded / progress.totalBytes) * 100
              : 0,
            retries: progress.retries,
          }
          : file
      )
    );

    // Calculate aggregate progress across all files
    const totals = [...bytesRef.current.values()].reduce(
      (acc, val) => ({
        uploaded: acc.uploaded + (val.uploaded || 0),
        total: acc.total + (val.total || 0),
      }),
      { uploaded: 0, total: 0 }
    );

    // Update metrics (Rate & ETA)
    updateMetrics(totals.uploaded, totals.total);

    // Update overall session progress
    setOverall(prev =>
      prev
        ? {
          ...prev,
          status: "uploading",
          uploadedBytes: totals.uploaded,
          totalBytes: prev.totalBytes || totals.total,
        }
        : prev
    );
  }, [updateMetrics]);

  // --------------------------------------------------------------------------
  // Session Control
  // --------------------------------------------------------------------------

  /**
   * Initialize and start upload session for queued files.
   * @param opts - Optional configuration (e.g., enable progress polling)
   */
  const startUpload = useCallback(
    async (opts: StartUploadOptions = {}) => {
      if (!filesRef.current.length) {
        setError("No files to upload");
        return;
      }

      try {
        pollingEnabledRef.current = !!opts.withPolling;
        const sid = `upload-${Date.now()}`;

        setSessionId(sid);
        setStatus("uploading");
        setError(null);
        stopPolling();
        bytesRef.current.clear();

        // Reset metrics
        setTransferRateBps(0);
        setEstimatedTimeMs(0);
        lastUpdateTimeRef.current = Date.now();
        lastUploadedBytesRef.current = 0;

        // Map files to upload items
        const items = filesRef.current.map(file => ({
          clientItemId: file.id,
          localUri: file.uri,
          blobName: `uploads/${Date.now()}-${file.name}`,
          contentType: "application/octet-stream",
          sizeBytes: file.size,
          metadata: { originalName: file.name },
        }));

        // Initialize session with upload configuration
        await Skybolt.initializeSession({
          sessionId: sid,
          items,
          options: {
            maxParallelFiles: 3,
            maxParallelChunks: 4,
            chunkSizeBytes: 4 * 1024 * 1024, // 4MB chunks
            enableBackground: true,
          },
        });

        await Skybolt.startSession(sid);

        // Set initial progress state
        setOverall({
          sessionId: sid,
          status: "uploading",
          totalFiles: items.length,
          completedFiles: 0,
          totalBytes: items.reduce((acc, item) => acc + item.sizeBytes, 0),
          uploadedBytes: 0,
        });

        if (opts.withPolling) {
          startPolling(sid);
        }
      } catch (e: unknown) {
        setStatus("failed");
        setError((e as Error)?.message ?? "Upload start failed");
        stopPolling();
      }
    },
    [startPolling, stopPolling]
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
  }, []);

  const cancelUpload = useCallback(async () => {
    const sid = sessionRef.current;
    if (!sid) return;

    await Skybolt.cancelSession(sid);
    setStatus("idle");
    setSessionId(null);
    setOverall(null);
    stopPolling();
    bytesRef.current.clear();
    setTransferRateBps(0);
    setEstimatedTimeMs(0);
  }, [stopPolling]);

  // --------------------------------------------------------------------------
  // Event Handling
  // --------------------------------------------------------------------------

  /**
   * Handle upload events from native module.
   * Single subscription to prevent duplicate listeners.
   */
  const onEvent = useCallback(
    (event: UploadEvent) => {
      switch (event.type) {
        case "session:started":
          setStatus("uploading");
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
          setOverall(prev => (prev ? { ...prev, status: "completed", progress: 100 } : prev));
          setTransferRateBps(0);
          setEstimatedTimeMs(0);
          stopPolling();
          break;

        case "session:failed":
          setStatus("failed");
          setError(event.error.message);
          setOverall(prev => (prev ? { ...prev, status: "failed" } : prev));
          stopPolling();
          break;

        case "item:progress":
          updateProgressForItem(event.payload);
          break;

        case "item:completed":
          setFiles(prev =>
            prev.map(file =>
              file.id === event.payload.clientItemId
                ? { ...file, status: "completed", progress: 100 }
                : file
            )
          );
          setOverall(prev =>
            prev
              ? {
                ...prev,
                completedFiles: Math.min(
                  prev.totalFiles,
                  (prev.completedFiles ?? 0) + 1
                ),
              }
              : prev
          );
          break;

        case "item:failed":
          setFiles(prev =>
            prev.map(file =>
              file.id === event.payload.clientItemId
                ? { ...file, status: "failed" }
                : file
            )
          );
          break;

        case "auth:required":
          setStatus("paused");
          setPauseReason("auth");
          setError("Sesión expirada. Por favor inicia sesión nuevamente.");
          break;

        case "error:forbidden":
          setError(`Sin permisos: ${event.payload.message}`);
          break;

        case "error:rate-limited":
        case "error:throttled":
          setError(`Alto tráfico. Esperando ${Math.ceil(event.payload.retryAfterMs / 1000)}s...`);
          break;

        case "error:contract":
          setError("Necesita actualización. Contacta soporte o actualiza la app.");
          break;

        case "error:network":
          setError(`Error de red (intento ${event.payload.attempt}). Reintentando...`);
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
    [stopPolling, updateProgressForItem]
  );

  // Subscribe to native events once
  useEffect(() => {
    const subscription = Skybolt.addUploadListener(onEvent);
    return () => {
      subscription.remove?.();
      stopPolling();
    };
  }, [onEvent, stopPolling]);

  // --------------------------------------------------------------------------
  // File Management
  // --------------------------------------------------------------------------

  const addFiles = useCallback((newFiles: FileItem[]) => {
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
    bytesRef.current.delete(id);
  }, []);

  const reset = useCallback(() => {
    setFiles([]);
    setSessionId(null);
    setStatus("idle");
    setOverall(null);
    bytesRef.current.clear();
    stopPolling();
    setTransferRateBps(0);
    setEstimatedTimeMs(0);
  }, [stopPolling]);

  // --------------------------------------------------------------------------
  // Auth Refresh Handler
  // --------------------------------------------------------------------------

  /**
   * Notify native module that authentication has been refreshed.
   * This triggers auto-resume for sessions paused due to auth expiration.
   */
  const notifyAuthRefreshed = useCallback(async () => {
    try {
      await Skybolt.notifyAuthRefreshed();
      setPauseReason(null); // Clear pause reason since auth is resolved
    } catch (err) {
      console.error("Failed to notify auth refresh:", err);
      throw err;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Return stable API object
  // --------------------------------------------------------------------------

  return useMemo(
    () => ({
      // State
      isReady,
      status,
      files,
      sessionId,
      overall,
      error,
      pauseReason,

      // Metrics
      transferRateBps,
      estimatedTimeMs,

      // Configuration
      configure,

      // Session control
      startUpload,
      pauseUpload,
      resumeUpload,
      cancelUpload,

      // Setters for manual control if needed (e.g. from useImageUpload)
      setSessionId,
      setStatus,
      setOverall,
      setError,

      // File management
      addFiles,
      removeFile,
      reset,

      // Auth management
      notifyAuthRefreshed,

      // Global polling toggle
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
    ]
  );
}