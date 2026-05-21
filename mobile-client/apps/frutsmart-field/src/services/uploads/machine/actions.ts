/**
 * Upload Machine v2 — Actions (mutaciones de contexto)
 *
 * Funciones puras: (context, event) => Partial<UploadJobContext>
 * Solo mutan el contexto in-memory. No tocan DB, ni nativo, ni red.
 */

import type { UploadJobContext, UploadMachineEvent } from "../types";

export type ContextMutator = (
  ctx: UploadJobContext,
  event: UploadMachineEvent,
) => Partial<UploadJobContext> | undefined;

export const contextMutators: Record<string, ContextMutator> = {
  incrementAttempts: (ctx) => ({
    attempts: ctx.attempts + 1,
    lastAttemptAt: Date.now(),
  }),

  resetAttempts: () => ({
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
  }),

  setBackendSessionId: (_ctx, event) => {
    if (event.type === "SESSION_CREATED") {
      return { backendSessionId: event.sessionId };
    }
    return undefined;
  },

  setSkyboltSessionId: (_ctx, event) => {
    if (event.type === "NATIVE_STARTED") {
      return { skyboltSessionId: event.skyboltSessionId };
    }
    return undefined;
  },

  updateMetrics: (_ctx, event) => {
    if (event.type === "NATIVE_PROGRESS" || event.type === "POLL_TICK") {
      const m = event.type === "NATIVE_PROGRESS" ? event : event.metrics;
      if (!m) return undefined;
      const transferRateBps = "transferRateBps" in m ? m.transferRateBps ?? null : null;
      const estimatedRemainingSeconds =
        "estimatedRemainingSeconds" in m ? m.estimatedRemainingSeconds ?? null : null;
      return {
        totalFiles: m.totalFiles,
        completedFiles: m.completedFiles,
        totalBytes: m.totalBytes,
        uploadedBytes: Math.min(m.uploadedBytes, m.totalBytes),
        transferRateBps,
        estimatedRemainingSeconds,
      };
    }
    // Para NATIVE_COMPLETED y NATIVE_STARTED: mantener métricas existentes
    // (las métricas vienen del syncFinalMetrics effect o de POLL_TICK previo)
    return undefined;
  },
};
