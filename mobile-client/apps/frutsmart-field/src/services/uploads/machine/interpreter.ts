/**
 * Upload Machine v2 — Interpreter
 *
 * Función pura que, dado un estado, un evento y un contexto,
 * retorna el siguiente estado + contexto mutado + lista de effects.
 *
 * Si el evento no es válido para el estado actual, retorna null.
 */

import type {
  UploadStateValue,
  UploadMachineEvent,
  UploadJobContext,
  TransitionResult,
  Effect,
  MachineConfig,
} from "../types";
import { uploadMachine } from "./config";
import { guards } from "./guards";
import { contextMutators } from "./actions";

// ---------------------------------------------------------------------------
// Interprete principal
// ---------------------------------------------------------------------------

export function transition(
  currentState: UploadStateValue,
  event: UploadMachineEvent,
  context: UploadJobContext,
  config: MachineConfig = uploadMachine.config,
): TransitionResult | null {
  const stateNode = uploadMachine.states[currentState];
  if (!stateNode?.on) return null;

  const rawTransitions = stateNode.on[event.type];
  if (!rawTransitions) return null;

  const transitions = Array.isArray(rawTransitions) ? rawTransitions : [rawTransitions];

  for (const t of transitions) {
    // 1) Evaluar guard
    if (t.guard) {
      const guardFn = guards[t.guard];
      if (!guardFn) {
        console.warn(`[UploadMachine] Guard desconocido: ${t.guard}`);
        continue;
      }
      if (!guardFn(context, event, config)) {
        continue; // guard rechazó, probar siguiente transición
      }
    }

    // 2) Aplicar mutaciones de contexto
    let newContext = context;
    for (const actionRef of t.actions ?? []) {
      const mutator = contextMutators[actionRef];
      if (mutator) {
        const delta = mutator(newContext, event);
        if (delta) {
          newContext = { ...newContext, ...delta };
        }
      }
    }

    // 3) Generar effects
    const effects = buildEffects(t.actions ?? [], newContext, event, currentState, t.target);

    return {
      state: t.target,
      context: newContext,
      effects,
    };
  }

  // Ninguna transición pasó el guard
  return null;
}

// ---------------------------------------------------------------------------
// Effect builder
// ---------------------------------------------------------------------------

function buildEffects(
  actionRefs: string[],
  ctx: UploadJobContext,
  event: UploadMachineEvent,
  currentState: UploadStateValue,
  targetState: UploadStateValue,
): Effect[] {
  const effects: Effect[] = [];

  for (const ref of actionRefs) {
    switch (ref) {
      case "createUploadSession": {
        effects.push({
          type: "createUploadSession",
          jobId: ctx.jobId,
          analysisId: ctx.analysisId,
          domain: ctx.domain,
          clientBatchId: ctx.clientBatchId,
        });
        break;
      }

      case "startNativeUpload": {
        if (ctx.backendSessionId) {
          effects.push({
            type: "startNativeUpload",
            jobId: ctx.jobId,
            backendSessionId: ctx.backendSessionId,
          });
        }
        break;
      }

      case "completeUploadSession": {
        if (ctx.backendSessionId) {
          effects.push({
            type: "completeUploadSession",
            jobId: ctx.jobId,
            backendSessionId: ctx.backendSessionId,
          });
        }
        break;
      }

      case "createEvaluation": {
        if (ctx.analysisId && ctx.backendSessionId) {
          effects.push({
            type: "createEvaluation",
            jobId: ctx.jobId,
            analysisId: ctx.analysisId,
            backendSessionId: ctx.backendSessionId,
          });
        }
        break;
      }

      case "persistStep": {
        const { pipelineStep, stepStatus, resetAttempts } = mapStateToDb(targetState);
        effects.push({
          type: "persistStep",
          jobId: ctx.jobId,
          pipelineStep,
          stepStatus,
          resetAttempts,
        });
        break;
      }

      case "persistError": {
        let errorMsg = "";
        if ("message" in event && event.message) {
          errorMsg = event.message;
        } else if ("error" in event && event.error) {
          errorMsg = event.error;
        }
        effects.push({
          type: "persistError",
          jobId: ctx.jobId,
          error: errorMsg,
        });
        break;
      }

      case "persistDone": {
        effects.push({ type: "persistDone", jobId: ctx.jobId });
        break;
      }

      case "updateMetrics": {
        effects.push({
          type: "persistMetrics",
          jobId: ctx.jobId,
          totalFiles: ctx.totalFiles,
          completedFiles: ctx.completedFiles,
          totalBytes: ctx.totalBytes,
          uploadedBytes: ctx.uploadedBytes,
        });
        break;
      }

      case "persistSessionIds": {
        effects.push({
          type: "persistSessionIds",
          jobId: ctx.jobId,
          backendSessionId: ctx.backendSessionId ?? undefined,
          skyboltSessionId: ctx.skyboltSessionId ?? undefined,
        });
        break;
      }

      case "startPolling": {
        if (ctx.skyboltSessionId) {
          effects.push({
            type: "startPolling",
            jobId: ctx.jobId,
            skyboltSessionId: ctx.skyboltSessionId,
          });
        }
        break;
      }

      case "stopPolling": {
        effects.push({ type: "stopPolling", jobId: ctx.jobId });
        break;
      }

      case "cancelNative": {
        if (ctx.skyboltSessionId) {
          effects.push({ type: "cancelNative", skyboltSessionId: ctx.skyboltSessionId });
        }
        break;
      }

      case "pauseNative": {
        if (ctx.skyboltSessionId) {
          effects.push({ type: "pauseNative", skyboltSessionId: ctx.skyboltSessionId });
        }
        break;
      }

      case "resumeNative": {
        if (ctx.skyboltSessionId) {
          effects.push({ type: "resumeNative", skyboltSessionId: ctx.skyboltSessionId });
        }
        break;
      }

      case "syncFinalMetrics": {
        if (ctx.skyboltSessionId) {
          effects.push({ type: "syncFinalMetrics", jobId: ctx.jobId, skyboltSessionId: ctx.skyboltSessionId });
        }
        break;
      }

      case "logInfo": {
        effects.push({
          type: "log",
          level: "info",
          message: `Transition ${ctx.jobId}: ${ref}`,
          meta: { from: currentState, event: event.type, to: targetState },
        });
        break;
      }

      case "logWarn": {
        effects.push({
          type: "log",
          level: "warn",
          message: `Transition ${ctx.jobId}: ${ref}`,
          meta: { from: currentState, event: event.type, to: targetState },
        });
        break;
      }

      case "logError": {
        effects.push({
          type: "log",
          level: "error",
          message: `Transition ${ctx.jobId}: ${ref}`,
          meta: { from: currentState, event: event.type, to: targetState },
        });
        break;
      }

      default:
        // Mutadores de contexto ya fueron aplicados arriba; no generan effects
        break;
    }
  }

  return effects;
}

// ---------------------------------------------------------------------------
// Mapeo estado máquina → DB schema
// ---------------------------------------------------------------------------

function mapStateToDb(state: UploadStateValue): {
  pipelineStep: "create_session" | "upload" | "complete_session" | "evaluation" | "done";
  stepStatus: "pending" | "running" | "success" | "failed";
  resetAttempts?: boolean;
} {
  if (state.startsWith("done.success")) {
    return { pipelineStep: "done", stepStatus: "success", resetAttempts: true };
  }
  if (state.startsWith("done.permanently_failed")) {
    return { pipelineStep: "done", stepStatus: "failed" };
  }

  const [step, sub] = state.split(".") as [string, string];

  const pipelineStep = step as "create_session" | "upload" | "complete_session" | "evaluation" | "done";

  let stepStatus: "pending" | "running" | "success" | "failed";
  switch (sub) {
    case "idle":
      stepStatus = "pending";
      break;
    case "running":
    case "uploading":
      stepStatus = "running";
      break;
    case "paused":
      stepStatus = "pending";
      break;
    case "failed":
      stepStatus = "failed";
      break;
    default:
      stepStatus = "pending";
  }

  return { pipelineStep, stepStatus, resetAttempts: sub === "idle" };
}
