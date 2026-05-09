/**
 * SkyboltUploadProvider v2 Bridge
 *
 * Reemplaza al provider v1. Expone la MISMA interfaz para compatibilidad
 * con uploads.tsx y saving-classification.tsx, pero usa uploads-v2 internamente.
 *
 * Esto elimina los listeners duplicados de addUploadListener que bloqueaban el splash.
 */

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import {
  useAllUploadJobs,
  createUploadJob as v2CreateUploadJob,
  retryUploadJob as v2RetryUploadJob,
  cancelUploadJob as v2CancelUploadJob,
  pauseUploadJob as v2PauseUploadJob,
  resumeUploadJob as v2ResumeUploadJob,
  removeUploadJob as v2RemoveUploadJob,
} from "@services/uploads-v2";
import { uploadOrchestrator } from "@services/uploads-v2";
import * as Skybolt from "skybolt";

import type {
  UploadJobLiveMetrics,
  UploadJobViewModel,
} from "@src/services/uploads/types";
import { uploadJobDeletionEnabled } from "@src/config/authConfig";
import type { UploadJobSnapshot } from "@services/uploads-v2";

// ---------------------------------------------------------------------------
// Types (misma interfaz que v1)
// ---------------------------------------------------------------------------

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
  notifyAuthRefreshed: () => Promise<void>;
  uploadJobDeletionEnabled: boolean;
};

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
// Mapper: UploadJobSnapshot (v2) → UploadJobViewModel (v1 interface)
// ---------------------------------------------------------------------------

function snapshotToViewModel(snap: UploadJobSnapshot): UploadJobViewModel {
  const ctx = snap.context;
  return {
    id: snap.jobId,
    qualityAnalysisId: ctx.analysisId || null,
    domain: ctx.domain,
    skyboltSessionId: ctx.skyboltSessionId,
    pipelineStep: snap.state.split(".")[0] as UploadJobViewModel["pipelineStep"],
    status: snap.displayStatus === "permanently_failed" ? "failed" : (snap.displayStatus as UploadJobViewModel["status"]),
    totalFiles: ctx.totalFiles,
    completedFiles: ctx.completedFiles,
    totalBytes: ctx.totalBytes,
    uploadedBytes: ctx.uploadedBytes,
    lastError: ctx.lastError,
    attemptsCount: ctx.attempts,
    createdAt: new Date(ctx.createdAt).toISOString(),
    updatedAt: new Date(ctx.createdAt).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const SkyboltUploadProvider = ({ children }: Props) => {
  console.log("[DIAG] SkyboltUploadProvider — render");
  const ts = Date.now();
  const isRecovering = false;

  // Read jobs from v2 store
  const snapshots = useAllUploadJobs();
  console.log("[DIAG] SkyboltUploadProvider — snapshots:", snapshots.length > 0
    ? snapshots.map(s => ({
        jobId: s.jobId.slice(0, 8),
        state: s.state,
        skyboltSessionId: s.context.skyboltSessionId?.slice(0, 8) ?? null,
        backendSessionId: s.context.backendSessionId?.slice(0, 8) ?? null,
        progress: `${s.context.completedFiles ?? 0}/${s.context.totalFiles ?? 0}`,
      }))
    : "0 jobs", "elapsed:", Date.now() - ts);

  const jobs = useMemo(
    () => snapshots.map(snapshotToViewModel),
    [snapshots],
  );

  console.log("[DIAG] SkyboltUploadProvider — jobs count:", jobs.length);

  const activeJob = useMemo(() => jobs[0] ?? null, [jobs]);

  // Live metrics: compute transfer rate & ETA via exponential moving average
  const metricsRef = useRef<Map<string, { lastBytes: number; lastTime: number; rate: number }>>(new Map());

  const liveMetricsByJobId = useMemo<Record<string, UploadJobLiveMetrics>>(
    () => {
      const now = Date.now();
      const map: Record<string, UploadJobLiveMetrics> = {};
      for (const snap of snapshots) {
        const ctxSnap = snap.context;

        let metric = metricsRef.current.get(snap.jobId);
        if (!metric) {
          metric = { lastBytes: 0, lastTime: now, rate: 0 };
          metricsRef.current.set(snap.jobId, metric);
        }

        const updatedBytes = ctxSnap.uploadedBytes ?? 0;
        if (updatedBytes > metric.lastBytes) {
          const timeDiffMs = now - metric.lastTime;
          if (timeDiffMs > 500) {
            const instantRate = ((updatedBytes - metric.lastBytes) / timeDiffMs) * 1000;
            metric.rate = metric.rate === 0 ? instantRate : metric.rate * 0.7 + instantRate * 0.3;
            metric.lastBytes = updatedBytes;
            metric.lastTime = now;
          }
        }

        const remainingBytes = (ctxSnap.totalBytes ?? 0) - updatedBytes;
        const eta = metric.rate > 0 && remainingBytes > 0 ? remainingBytes / metric.rate : 0;

        map[snap.jobId] = {
          speedBytesPerSec: metric.rate > 0 ? metric.rate : null,
          estimatedRemainingSeconds: eta > 0 ? eta : null,
          pauseReason: null,
          nextRetryAtMs: null,
          retryAfterMs: null,
          currentItemId: null,
          lastProgressAtMs: metric.rate > 0 ? now : null,
        };
      }
      return map;
    },
    [snapshots],
  );

  // Actions bridge to v2
  const refreshJobs = async () => {
    // In v2, the store is reactive; no manual refresh needed
  };

  const enqueueUploadFromAnalysis = async (analysisId: string) => {
    await v2CreateUploadJob(analysisId);
  };

  const startJob = async (jobId: string) => {
    await uploadOrchestrator.startJob(jobId);
  };

  const pauseJob = async (jobId: string) => {
    await v2PauseUploadJob(jobId);
  };

  const resumeJob = async (jobId: string) => {
    await v2ResumeUploadJob(jobId);
  };

  const forceRetryJob = async (jobId: string) => {
    await v2RetryUploadJob(jobId);
  };

  const cancelJob = async (jobId: string) => {
    await v2CancelUploadJob(jobId);
  };

  const removeJob = async (jobId: string) => {
    await v2RemoveUploadJob(jobId);
  };

  const notifyAuthRefreshed = async () => {
    await Skybolt.notifyAuthRefreshed();
  };

  const value = useMemo<SkyboltUploadContextValue>(
    () => {
      console.log("[DIAG] SkyboltUploadProvider — value memo recalculated");
      return {
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
        notifyAuthRefreshed,
        uploadJobDeletionEnabled,
      };
    },
    [
      jobs,
      liveMetricsByJobId,
      activeJob,
      isRecovering,
    ],
  );

  return (
    <SkyboltUploadContext.Provider value={value}>
      {children}
    </SkyboltUploadContext.Provider>
  );
};
