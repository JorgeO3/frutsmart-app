/**
 * Upload Machine v2 — Configuración declarativa
 *
 * La máquina como objeto de configuración pura. Sin lógica de ejecución.
 * TypeScript valida que states, events y actions sean referencias válidas.
 */

import type { UploadStateValue, UploadMachineEvent, UploadJobContext, MachineConfig } from "../types";

// ---------------------------------------------------------------------------
// Referencias tipadas (no implementaciones)
// ---------------------------------------------------------------------------

export type GuardRef =
  | "canRun"
  | "isPermanentError"
  | "hasMetrics"
  | "pollDetectedCompleted"
  | "pollDetectedFailed";

export type ActionRef =
  | "incrementAttempts"
  | "resetAttempts"
  | "setBackendSessionId"
  | "setSkyboltSessionId"
  | "updateMetrics"
  | "persistStep"
  | "persistError"
  | "persistDone"
  | "persistSessionIds"
  | "createUploadSession"
  | "startNativeUpload"
  | "completeUploadSession"
  | "createEvaluation"
  | "startPolling"
  | "stopPolling"
  | "cancelNative"
  | "pauseNative"
  | "resumeNative"
  | "syncFinalMetrics"
  | "logInfo"
  | "logWarn"
  | "logError";

export interface TransitionDef {
  target: UploadStateValue;
  guard?: GuardRef;
  actions?: ActionRef[];
}

export type OnEvents = Partial<Record<UploadMachineEvent["type"], TransitionDef | TransitionDef[]>>;

export interface StateNode {
  on?: OnEvents;
}

export interface MachineDefinition {
  id: string;
  initial: UploadStateValue;
  states: Record<UploadStateValue, StateNode>;
  config: MachineConfig;
}

// ---------------------------------------------------------------------------
// Definición
// ---------------------------------------------------------------------------

export const uploadMachine: MachineDefinition = {
  id: "upload",
  initial: "create_session.idle",
  config: {
    maxAttemptsPerStep: 5,
    baseBackoffMs: 30_000,
    maxBackoffMs: 30 * 60_000,
    jitterFraction: 0.25,
  },
  states: {
    // =====================================================================
    // CREATE_SESSION
    // =====================================================================
    "create_session.idle": {
      on: {
        SCHEDULER_TICK: {
          target: "create_session.running",
          guard: "canRun",
          actions: ["incrementAttempts", "createUploadSession", "logInfo"],
        },
      },
    },

    "create_session.running": {
      on: {
        SESSION_CREATED: {
          target: "upload.idle",
          actions: ["setBackendSessionId", "resetAttempts", "persistSessionIds", "persistStep", "logInfo"],
        },
        USER_CANCEL: {
          target: "done.permanently_failed",
          actions: ["persistError", "logInfo"],
        },
        SESSION_ERROR: [
          {
            target: "done.permanently_failed",
            guard: "isPermanentError",
            actions: ["persistError", "logError"],
          },
          {
            target: "create_session.failed",
            actions: ["persistError", "logWarn"],
          },
        ],
      },
    },

    "create_session.failed": {
      on: {
        SCHEDULER_TICK: {
          target: "create_session.running",
          guard: "canRun",
          actions: ["incrementAttempts", "logInfo"],
        },
        USER_RETRY: {
          target: "create_session.running",
          actions: ["resetAttempts", "logInfo"],
        },
        USER_CANCEL: {
          target: "done.permanently_failed",
          actions: ["persistError", "logInfo"],
        },
      },
    },

    // =====================================================================
    // UPLOAD
    // =====================================================================
    "upload.idle": {
      on: {
        SCHEDULER_TICK: {
          target: "upload.uploading",
          guard: "canRun",
          actions: ["incrementAttempts", "startNativeUpload", "persistStep", "logInfo"],
        },
        NATIVE_STARTED: {
          target: "upload.uploading",
          actions: ["setSkyboltSessionId", "persistSessionIds", "persistStep", "startPolling", "logInfo"],
        },
        USER_RETRY: {
          target: "upload.uploading",
          actions: ["resetAttempts", "logInfo"],
        },
        USER_CANCEL: {
          target: "done.permanently_failed",
          actions: ["persistError", "logInfo"],
        },
      },
    },

    "upload.uploading": {
      on: {
        NATIVE_STARTED: {
          target: "upload.uploading",
          actions: ["setSkyboltSessionId", "persistSessionIds", "startPolling", "logInfo"],
        },
        NATIVE_COMPLETED: {
          target: "complete_session.idle",
          actions: ["stopPolling", "syncFinalMetrics", "updateMetrics", "persistStep", "resetAttempts", "logInfo"],
        },
        NATIVE_FAILED: {
          target: "upload.failed",
          actions: ["stopPolling", "persistError", "logError"],
        },
        NATIVE_PROGRESS: {
          target: "upload.uploading",
          actions: ["updateMetrics", "logInfo"],
        },
        NATIVE_PAUSED: {
          target: "upload.paused",
          actions: ["stopPolling", "persistStep", "logInfo"],
        },
        POLL_TICK: [
          {
            target: "complete_session.idle",
            guard: "pollDetectedCompleted",
            actions: ["stopPolling", "syncFinalMetrics", "updateMetrics", "persistStep", "resetAttempts", "logInfo"],
          },
          {
            target: "upload.failed",
            guard: "pollDetectedFailed",
            actions: ["stopPolling", "persistError", "logError"],
          },
          {
            target: "upload.uploading",
            actions: ["updateMetrics", "logInfo"],
          },
        ],
        USER_PAUSE: {
          target: "upload.paused",
          actions: ["stopPolling", "pauseNative", "persistStep", "logInfo"],
        },
        USER_CANCEL: {
          target: "done.permanently_failed",
          actions: ["stopPolling", "cancelNative", "persistError", "logInfo"],
        },
      },
    },

    "upload.paused": {
      on: {
        USER_RESUME: {
          target: "upload.uploading",
          actions: ["resumeNative", "persistStep", "logInfo"],
        },
        USER_RETRY: {
          target: "upload.uploading",
          actions: ["resetAttempts", "persistStep", "logInfo"],
        },
        NATIVE_FAILED: {
          target: "upload.failed",
          actions: ["persistError", "logError"],
        },
        NATIVE_RESUMED: {
          target: "upload.uploading",
          actions: ["startPolling", "persistStep", "logInfo"],
        },
        USER_CANCEL: {
          target: "done.permanently_failed",
          actions: ["cancelNative", "persistError", "logInfo"],
        },
      },
    },

    "upload.failed": {
      on: {
        SCHEDULER_TICK: {
          target: "upload.uploading",
          guard: "canRun",
          actions: ["incrementAttempts", "persistStep", "logInfo"],
        },
        USER_RETRY: {
          target: "upload.uploading",
          actions: ["resetAttempts", "persistStep", "logInfo"],
        },
        USER_CANCEL: {
          target: "done.permanently_failed",
          actions: ["persistError", "logInfo"],
        },
      },
    },

    // =====================================================================
    // COMPLETE_SESSION
    // =====================================================================
    "complete_session.idle": {
      on: {
        SCHEDULER_TICK: {
          target: "complete_session.running",
          guard: "canRun",
          actions: ["incrementAttempts", "completeUploadSession", "persistStep", "logInfo"],
        },
        USER_CANCEL: {
          target: "done.permanently_failed",
          actions: ["persistError", "logInfo"],
        },
      },
    },

    "complete_session.running": {
      on: {
        COMPLETE_OK: {
          target: "evaluation.idle",
          actions: ["resetAttempts", "persistStep", "logInfo"],
        },
        USER_CANCEL: {
          target: "done.permanently_failed",
          actions: ["persistError", "logInfo"],
        },
        COMPLETE_ERROR: [
          {
            target: "done.permanently_failed",
            guard: "isPermanentError",
            actions: ["persistError", "logError"],
          },
          {
            target: "complete_session.failed",
            actions: ["persistError", "logWarn"],
          },
        ],
      },
    },

    "complete_session.failed": {
      on: {
        SCHEDULER_TICK: {
          target: "complete_session.running",
          guard: "canRun",
          actions: ["incrementAttempts", "persistStep", "logInfo"],
        },
        USER_RETRY: {
          target: "complete_session.running",
          actions: ["resetAttempts", "persistStep", "logInfo"],
        },
        USER_CANCEL: {
          target: "done.permanently_failed",
          actions: ["persistError", "logInfo"],
        },
      },
    },

    // =====================================================================
    // EVALUATION
    // =====================================================================
    "evaluation.idle": {
      on: {
        SCHEDULER_TICK: {
          target: "evaluation.running",
          guard: "canRun",
          actions: ["incrementAttempts", "createEvaluation", "persistStep", "logInfo"],
        },
        USER_CANCEL: {
          target: "done.permanently_failed",
          actions: ["persistError", "logInfo"],
        },
      },
    },

    "evaluation.running": {
      on: {
        USER_CANCEL: {
          target: "done.permanently_failed",
          actions: ["persistError", "logInfo"],
        },
        EVALUATION_OK: [
          {
            target: "done.success",
            guard: "hasMetrics",
            actions: ["persistDone", "logInfo"],
          },
          {
            target: "evaluation.failed",
            actions: ["persistError", "logWarn"],
          },
        ],
        EVALUATION_ERROR: [
          {
            target: "done.permanently_failed",
            guard: "isPermanentError",
            actions: ["persistError", "logError"],
          },
          {
            target: "evaluation.failed",
            actions: ["persistError", "logWarn"],
          },
        ],
      },
    },

    "evaluation.failed": {
      on: {
        SCHEDULER_TICK: {
          target: "evaluation.running",
          guard: "canRun",
          actions: ["incrementAttempts", "persistStep", "logInfo"],
        },
        USER_RETRY: {
          target: "evaluation.running",
          actions: ["resetAttempts", "persistStep", "logInfo"],
        },
        USER_CANCEL: {
          target: "done.permanently_failed",
          actions: ["persistError", "logInfo"],
        },
      },
    },

    // =====================================================================
    // DONE (terminal)
    // =====================================================================
    "done.success": {
      // Estados terminales: no aceptan ningún evento
    },

    "done.permanently_failed": {
      on: {
        USER_RETRY: {
          target: "create_session.idle",
          actions: ["resetAttempts", "persistStep", "logInfo"],
        },
      },
    },
  },
};
