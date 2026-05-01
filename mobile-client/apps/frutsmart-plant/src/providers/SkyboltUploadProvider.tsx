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

import { uploadService } from "@services/uploads/UploadService";
import type {
  UploadJobLiveMetrics,
  UploadJobViewModel,
  UploadPauseReason,
} from "@services/uploads/types";
import { uploadJobDeletionEnabled } from "@src/config/authConfig";

import type { UploadEvent } from "skybolt";
import * as Skybolt from "skybolt";
import { SkyboltNativeUploadProvider } from "skybolt";
import { getDefaultSkyboltUploadConfig } from "@src/config/skyboltConfig";

type SkyboltUploadContextValue = {
  jobs: UploadJobViewModel[];
  liveMetricsByJobId: Record<string, UploadJobLiveMetrics>;
  activeJob: UploadJobViewModel | null;
  isRecovering: boolean;
  refreshJobs: () => Promise<void>;
  enqueueUploadFromAnalysis: (analysisId: string) => Promise<void>;
  startJob: (jobId: string) => Promise<void>;
  pauseJob: (jobId: string) => Promise<void>;
  resumeJob: (jobId: string) => Promise<void>;
  forceRetryJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  removeJob: (jobId: string) => Promise<void>;
  uploadJobDeletionEnabled: boolean;
};

type JobProgressSnapshot = {
  uploadedBytes: number;
  atMs: number;
};

const RECENT_PROGRESS_STALE_MS = 8000;
const MAX_SPEED_SAMPLE_WINDOW_MS = 12000;
const MIN_SPEED_SAMPLE_WINDOW_MS = 250;

const defaultLiveMetrics = (): UploadJobLiveMetrics => ({
  speedBytesPerSec: null,
  estimatedRemainingSeconds: null,
  pauseReason: null,
  nextRetryAtMs: null,
  retryAfterMs: null,
  currentItemId: null,
  lastProgressAtMs: null,
});

const SkyboltUploadContext = createContext<SkyboltUploadContextValue | null>(
  null,
);

export function useSkyboltUploadContext(): SkyboltUploadContextValue {
  const ctx = useContext(SkyboltUploadContext);
  if (!ctx) {
    throw new Error(
      "useSkyboltUploadContext must be used within SkyboltUploadProvider",
    );
  }
  return ctx;
}

type Props = {
  children: ReactNode;
};

// ---------------------------------------------------------------------------
// Inner provider: jobs + resiliencia
// ---------------------------------------------------------------------------

const SkyboltUploadJobsInnerProvider = ({ children }: Props) => {
  const [jobs, setJobs] = useState<UploadJobViewModel[]>([]);
  const [liveMetricsByJobId, setLiveMetricsByJobId] = useState<
    Record<string, UploadJobLiveMetrics>
  >({});
  const [activeJob, setActiveJob] = useState<UploadJobViewModel | null>(null);
  const [isRecovering, setIsRecovering] = useState(true);

  const lastSnapshotsRef = useRef<Record<string, JobProgressSnapshot>>({});
  const jobIdBySessionIdRef = useRef<Record<string, string>>({});

  const resolveJobIdFromSession = useCallback((sessionId?: string): string | null => {
    if (!sessionId) return null;
    return jobIdBySessionIdRef.current[sessionId] ?? null;
  }, []);

  const patchLiveMetrics = useCallback(
    (jobId: string, patch: Partial<UploadJobLiveMetrics>) => {
      setLiveMetricsByJobId((prev) => {
        const current = prev[jobId] ?? defaultLiveMetrics();
        return {
          ...prev,
          [jobId]: {
            ...current,
            ...patch,
          },
        };
      });
    },
    [],
  );

  const refreshJobs = useCallback(async () => {
    const viewModels = await uploadService.getAllJobsView();

    const now = Date.now();
    const nextSessionMap: Record<string, string> = {};
    const nextSnapshots: Record<string, JobProgressSnapshot> = {};

    setLiveMetricsByJobId((prev) => {
      const next = { ...prev };

      for (const job of viewModels) {
        if (job.skyboltSessionId) {
          nextSessionMap[job.skyboltSessionId] = job.id;
        }

        const prevSnapshot = lastSnapshotsRef.current[job.id];
        const prevMetrics = next[job.id] ?? defaultLiveMetrics();
        const currentSnapshot: JobProgressSnapshot = {
          uploadedBytes: job.uploadedBytes,
          atMs: now,
        };

        let speedBytesPerSec = prevMetrics.speedBytesPerSec;
        let lastProgressAtMs = prevMetrics.lastProgressAtMs;

        if (prevSnapshot) {
          const deltaBytes = job.uploadedBytes - prevSnapshot.uploadedBytes;
          const rawDeltaMs = Math.max(1, now - prevSnapshot.atMs);
          const deltaMs = Math.min(rawDeltaMs, MAX_SPEED_SAMPLE_WINDOW_MS);

          if (deltaBytes < 0) {
            speedBytesPerSec = null;
            lastProgressAtMs = null;
          } else if (deltaBytes > 0 && rawDeltaMs >= MIN_SPEED_SAMPLE_WINDOW_MS) {
            const instantSpeed = (deltaBytes * 1000) / deltaMs;
            speedBytesPerSec = speedBytesPerSec
              ? speedBytesPerSec * 0.7 + instantSpeed * 0.3
              : instantSpeed;
            lastProgressAtMs = now;
          } else if (lastProgressAtMs && now - lastProgressAtMs > RECENT_PROGRESS_STALE_MS) {
            speedBytesPerSec = null;
          }
        }

        const remainingBytes = Math.max(0, job.totalBytes - job.uploadedBytes);
        const estimatedRemainingSeconds =
          speedBytesPerSec && speedBytesPerSec > 1024 && remainingBytes > 0
            ? Math.round(remainingBytes / speedBytesPerSec)
            : null;

        const pauseReason: UploadPauseReason | null =
          job.pipelineStep === "upload" && job.status === "pending"
            ? (prevMetrics.pauseReason ?? "manual")
            : null;

        if (job.pipelineStep !== "upload" || job.status !== "running") {
          speedBytesPerSec = null;
        }

        next[job.id] = {
          ...prevMetrics,
          speedBytesPerSec,
          estimatedRemainingSeconds,
          pauseReason,
          lastProgressAtMs,
        };

        nextSnapshots[job.id] = currentSnapshot;
      }

      const aliveJobIds = new Set(viewModels.map((job) => job.id));
      for (const jobId of Object.keys(next)) {
        if (!aliveJobIds.has(jobId)) {
          delete next[jobId];
        }
      }

      return next;
    });

    lastSnapshotsRef.current = nextSnapshots;
    jobIdBySessionIdRef.current = nextSessionMap;

    setJobs(viewModels);
    setActiveJob(viewModels[0] ?? null);
  }, []);

  const handleUploadEvent = useCallback(
    async (event: UploadEvent) => {
      console.log("[SkyboltUploadProvider DIAG] handleUploadEvent received:", event.type, "sessionId:", (event as { sessionId?: string }).sessionId);

      if (event.type === "item:progress") {
        const jobId = resolveJobIdFromSession(event.sessionId);
        if (jobId) {
          patchLiveMetrics(jobId, {
            currentItemId: event.payload.clientItemId,
          });
        }
      }

      if (event.type === "session:paused") {
        const jobId = resolveJobIdFromSession(event.sessionId);
        if (jobId) {
          patchLiveMetrics(jobId, {
            pauseReason: event.reason,
          });
        }
      }

      if (event.type === "session:resumed" || event.type === "session:started") {
        const jobId = resolveJobIdFromSession(event.sessionId);
        if (jobId) {
          patchLiveMetrics(jobId, {
            pauseReason: null,
            retryAfterMs: null,
            nextRetryAtMs: null,
          });
        }
      }

      if (event.type === "auth:required") {
        for (const sessionId of event.pendingSessions) {
          const jobId = resolveJobIdFromSession(sessionId);
          if (jobId) {
            patchLiveMetrics(jobId, {
              pauseReason: "auth",
            });
          }
        }
      }

      if (event.type === "error:rate-limited" || event.type === "error:throttled") {
        const jobId = resolveJobIdFromSession(event.sessionId);
        if (jobId) {
          const retryAfterMs = Math.max(0, event.payload.retryAfterMs || 0);
          patchLiveMetrics(jobId, {
            retryAfterMs,
            nextRetryAtMs: Date.now() + retryAfterMs,
          });
        }
      }

      if (event.type === "error:network") {
        const jobId = resolveJobIdFromSession(event.sessionId);
        if (jobId) {
          patchLiveMetrics(jobId, {
            pauseReason: "network",
          });
        }
      }

      // aquí entra la resiliencia, sin importar en qué pantalla estés
      console.log("[SkyboltUploadProvider DIAG] forwarding event to uploadService.handleSkyboltEvent:", event.type);
      await uploadService.handleSkyboltEvent(event);
      await refreshJobs();
    },
    [patchLiveMetrics, refreshJobs, resolveJobIdFromSession],
  );

  const enqueueUploadFromAnalysis = useCallback(
    async (analysisId: string) => {
      const jobId = await uploadService.createJobFromAnalysis(analysisId);
      console.log("Created upload job from analysis", { jobId });
      await refreshJobs();
    },
    [refreshJobs],
  );

  const startJob = useCallback(
    async (jobId: string) => {
      await uploadService.startJob(jobId);
      await refreshJobs();
    },
    [refreshJobs],
  );

  const pauseJob = useCallback(
    async (jobId: string) => {
      await uploadService.pauseJob(jobId);
      await refreshJobs();
    },
    [refreshJobs],
  );

  const resumeJob = useCallback(
    async (jobId: string) => {
      await uploadService.resumeJob(jobId);
      await refreshJobs();
    },
    [refreshJobs],
  );

  const forceRetryJob = useCallback(
    async (jobId: string) => {
      await uploadService.forceRetryJob(jobId);
      await refreshJobs();
    },
    [refreshJobs],
  );

  const cancelJob = useCallback(
    async (jobId: string) => {
      await uploadService.cancelJob(jobId);
      await refreshJobs();
    },
    [refreshJobs],
  );

  const removeJob = useCallback(
    async (jobId: string) => {
      await uploadService.removeJob(jobId);
      await refreshJobs();
    },
    [refreshJobs],
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await uploadService.recoverPendingJobs();
        if (!mounted) return;
        await refreshJobs();
      } finally {
        if (mounted) setIsRecovering(false);
      }
    })();

    const subscription = Skybolt.addUploadListener((evt: UploadEvent) => {
      void handleUploadEvent(evt);
    });
    console.log("[SkyboltUploadProvider DIAG] addUploadListener registered");

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [handleUploadEvent, refreshJobs]);

  const value = useMemo<SkyboltUploadContextValue>(
    () => ({
      jobs,
      liveMetricsByJobId,
      activeJob,
      isRecovering,
      refreshJobs,
      enqueueUploadFromAnalysis,
      startJob,
      pauseJob,
      resumeJob,
      forceRetryJob,
      cancelJob,
      removeJob,
      uploadJobDeletionEnabled,
    }),
    [
      jobs,
      liveMetricsByJobId,
      activeJob,
      isRecovering,
      refreshJobs,
      enqueueUploadFromAnalysis,
      startJob,
      pauseJob,
      resumeJob,
      forceRetryJob,
      cancelJob,
      removeJob,
      uploadJobDeletionEnabled,
    ],
  );

  return (
    <SkyboltUploadContext.Provider value={value}>
      {children}
    </SkyboltUploadContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Provider principal: configura Skybolt al arrancar y monta los providers
// ---------------------------------------------------------------------------

export const SkyboltUploadProvider = ({ children }: Props) => {
  useEffect(() => {
    (async () => {
      try {
        const settings = getDefaultSkyboltUploadConfig();
        console.log(
          "[SkyboltUploadProvider] Configuring Skybolt with settings:",
          settings,
        );
        await Skybolt.configure(settings);
        console.log("[SkyboltUploadProvider] Skybolt configured OK");
      } catch (err) {
        console.error(
          "[SkyboltUploadProvider] Failed to configure Skybolt:",
          err,
        );
      }
    })();
  }, []);

  return (
    <SkyboltNativeUploadProvider>
      <SkyboltUploadJobsInnerProvider>
        {children}
      </SkyboltUploadJobsInnerProvider>
    </SkyboltNativeUploadProvider>
  );
};
