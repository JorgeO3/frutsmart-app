/**
 * Upload Machine v2 — Guards
 *
 * Funciones puras y testeables. No tocan side effects.
 */

import type { UploadJobContext, UploadMachineEvent, MachineConfig } from "../types";
import { UploadApiError } from "../types";

export type GuardFn = (ctx: UploadJobContext, event: UploadMachineEvent, config: MachineConfig) => boolean;

export const guards: Record<string, GuardFn> = {
  /**
   * Puede ejecutar este paso ahora?
   * - No está marcado como permanente
   * - No se superó el máximo de intentos
   * - El backoff (con jitter) ya pasó desde el último intento
   */
  canRun: (ctx, _event, config) => {
    if (ctx.lastError?.includes("[PERMANENT]")) return false;
    if (ctx.attempts >= config.maxAttemptsPerStep) return false;

    // Si nunca se intentó, puede correr inmediatamente
    if (!ctx.lastAttemptAt) return true;

    const elapsed = Date.now() - ctx.lastAttemptAt;
    const backoff = computeBackoffMs(ctx.attempts, config);
    return elapsed >= backoff;
  },

  /**
   * El error HTTP es permanente (no reintentable)?
   */
  isPermanentError: (_ctx, event) => {
    if (event.type !== "SESSION_ERROR" && event.type !== "COMPLETE_ERROR" && event.type !== "EVALUATION_ERROR") {
      return false;
    }
    const permanentCodes = new Set([400, 401, 403, 404, 409, 422]);
    if (event.statusCode && permanentCodes.has(event.statusCode)) return true;

    // También detectar si el mensaje ya tiene prefijo PERMANENT
    if (event.message?.startsWith("[PERMANENT]")) return true;

    return false;
  },

  /**
   * Tenemos métricas válidas para marcar done?
   */
  hasMetrics: (ctx) => {
    return ctx.totalFiles > 0 || ctx.totalBytes > 0;
  },

  /**
   * El polling detectó que la sesión nativa completó.
   */
  pollDetectedCompleted: (_ctx, event) => {
    return event.type === "POLL_TICK" && event.status === "completed";
  },

  /**
   * El polling detectó que la sesión nativa falló.
   */
  pollDetectedFailed: (_ctx, event) => {
    return event.type === "POLL_TICK" && event.status === "failed";
  },
};

// ---------------------------------------------------------------------------
// Backoff computation (puramente funcional)
// ---------------------------------------------------------------------------

function computeBackoffMs(attempts: number, config: MachineConfig): number {
  const exp = Math.min(attempts, 10);
  const raw = config.baseBackoffMs * 2 ** exp;
  const capped = Math.min(raw, config.maxBackoffMs);
  const jitterRange = capped * config.jitterFraction;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  return Math.max(0, capped + jitter);
}
