/**
 * Tests de la máquina pura: transiciones básicas entre estados
 */

import { transition } from "./interpreter";
import type { UploadJobContext, UploadMachineEvent } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<UploadJobContext> = {}): UploadJobContext {
  return {
    jobId: "job-1",
    analysisId: "analysis-1",
    domain: "plant",
    clientBatchId: "batch-1",
    backendSessionId: null,
    skyboltSessionId: null,
    totalFiles: 10,
    completedFiles: 0,
    totalBytes: 10_000,
    uploadedBytes: 0,
    attempts: 0,
    lastError: null,
    lastAttemptAt: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeEvent(type: UploadMachineEvent["type"], extra: Partial<UploadMachineEvent> = {}): UploadMachineEvent {
  return { type, ...extra } as UploadMachineEvent;
}

// ---------------------------------------------------------------------------
// Estado inicial: create_session.idle
// ---------------------------------------------------------------------------

describe("create_session.idle", () => {
  const ctx = makeCtx();

  it("SCHEDULER_TICK → create_session.running", () => {
    const result = transition("create_session.idle", makeEvent("SCHEDULER_TICK", { nowMs: Date.now() }), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("create_session.running");
    expect(result!.context.attempts).toBe(1);
    expect(result!.context.lastAttemptAt).not.toBeNull();
    expect(result!.effects.some((e) => e.type === "createUploadSession")).toBe(true);
  });

  it("ignora USER_RETRY", () => {
    const result = transition("create_session.idle", makeEvent("USER_RETRY"), ctx);
    expect(result).toBeNull();
  });

  it("ignora NATIVE_COMPLETED", () => {
    const result = transition("create_session.idle", makeEvent("NATIVE_COMPLETED"), ctx);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Estado: create_session.running
// ---------------------------------------------------------------------------

describe("create_session.running", () => {
  const ctx = makeCtx();

  it("SESSION_CREATED → upload.idle + setBackendSessionId", () => {
    const result = transition(
      "create_session.running",
      makeEvent("SESSION_CREATED", { sessionId: "session-123" }),
      ctx,
    );
    expect(result).not.toBeNull();
    expect(result!.state).toBe("upload.idle");
    expect(result!.context.backendSessionId).toBe("session-123");
    expect(result!.context.attempts).toBe(0); // resetAttempts
    expect(result!.effects.some((e) => e.type === "persistSessionIds")).toBe(true);
    expect(result!.effects.some((e) => e.type === "persistStep")).toBe(true);
  });

  it("SESSION_ERROR 400 → done.permanently_failed", () => {
    const result = transition(
      "create_session.running",
      makeEvent("SESSION_ERROR", { statusCode: 400, message: "Bad request" }),
      ctx,
    );
    expect(result).not.toBeNull();
    expect(result!.state).toBe("done.permanently_failed");
    expect(result!.effects.some((e) => e.type === "persistError")).toBe(true);
  });

  it("SESSION_ERROR 500 → create_session.failed", () => {
    const result = transition(
      "create_session.running",
      makeEvent("SESSION_ERROR", { statusCode: 500, message: "Server error" }),
      ctx,
    );
    expect(result).not.toBeNull();
    expect(result!.state).toBe("create_session.failed");
  });
});

// ---------------------------------------------------------------------------
// Estado: upload.idle
// ---------------------------------------------------------------------------

describe("upload.idle", () => {
  const ctx = makeCtx({ backendSessionId: "session-123" });

  it("SCHEDULER_TICK → upload.uploading + startNativeUpload", () => {
    const result = transition("upload.idle", makeEvent("SCHEDULER_TICK", { nowMs: Date.now() }), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("upload.uploading");
    expect(result!.effects.some((e) => e.type === "startNativeUpload")).toBe(true);
  });

  it("NATIVE_STARTED → upload.uploading + setSkyboltSessionId", () => {
    const result = transition(
      "upload.idle",
      makeEvent("NATIVE_STARTED", { skyboltSessionId: "skybolt-456" }),
      ctx,
    );
    expect(result).not.toBeNull();
    expect(result!.state).toBe("upload.uploading");
    expect(result!.context.skyboltSessionId).toBe("skybolt-456");
    expect(result!.effects.some((e) => e.type === "persistSessionIds")).toBe(true);
  });

  it("USER_CANCEL → done.permanently_failed", () => {
    const result = transition("upload.idle", makeEvent("USER_CANCEL"), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("done.permanently_failed");
  });
});

// ---------------------------------------------------------------------------
// Estado: upload.uploading
// ---------------------------------------------------------------------------

describe("upload.uploading", () => {
  const ctx = makeCtx({ backendSessionId: "session-123", skyboltSessionId: "skybolt-456" });

  it("NATIVE_STARTED → stays upload.uploading + persists session id", () => {
    const result = transition(
      "upload.uploading",
      makeEvent("NATIVE_STARTED", { skyboltSessionId: "skybolt-789" }),
      ctx,
    );
    expect(result).not.toBeNull();
    expect(result!.state).toBe("upload.uploading");
    expect(result!.context.skyboltSessionId).toBe("skybolt-789");
    expect(result!.effects.some((e) => e.type === "persistSessionIds")).toBe(true);
  });

  it("NATIVE_COMPLETED → complete_session.idle + stopPolling", () => {
    const result = transition("upload.uploading", makeEvent("NATIVE_COMPLETED"), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("complete_session.idle");
    expect(result!.effects.some((e) => e.type === "stopPolling")).toBe(true);
    expect(result!.effects.some((e) => e.type === "persistStep")).toBe(true);
  });

  it("NATIVE_FAILED → upload.failed + stopPolling", () => {
    const result = transition("upload.uploading", makeEvent("NATIVE_FAILED", { error: "network timeout" }), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("upload.failed");
    expect(result!.effects.some((e) => e.type === "stopPolling")).toBe(true);
  });

  it("NATIVE_PROGRESS → upload.uploading + updateMetrics", () => {
    const result = transition(
      "upload.uploading",
      makeEvent("NATIVE_PROGRESS", { totalFiles: 10, completedFiles: 5, totalBytes: 10_000, uploadedBytes: 5_000 }),
      ctx,
    );
    expect(result).not.toBeNull();
    expect(result!.state).toBe("upload.uploading");
    expect(result!.context.uploadedBytes).toBe(5_000);
    expect(result!.context.completedFiles).toBe(5);
    expect(result!.effects.some((e) => e.type === "persistMetrics")).toBe(true);
  });

  it("USER_PAUSE → upload.paused", () => {
    const result = transition("upload.uploading", makeEvent("USER_PAUSE"), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("upload.paused");
    expect(result!.effects.some((e) => e.type === "stopPolling")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Estado: complete_session.idle
// ---------------------------------------------------------------------------

describe("complete_session.idle", () => {
  const ctx = makeCtx({ backendSessionId: "session-123" });

  it("SCHEDULER_TICK → complete_session.running", () => {
    const result = transition("complete_session.idle", makeEvent("SCHEDULER_TICK", { nowMs: Date.now() }), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("complete_session.running");
    expect(result!.effects.some((e) => e.type === "completeUploadSession")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Estado: complete_session.running
// ---------------------------------------------------------------------------

describe("complete_session.running", () => {
  const ctx = makeCtx({ backendSessionId: "session-123" });

  it("COMPLETE_OK → evaluation.idle", () => {
    const result = transition("complete_session.running", makeEvent("COMPLETE_OK"), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("evaluation.idle");
    expect(result!.context.attempts).toBe(0); // resetAttempts
  });

  it("COMPLETE_ERROR 400 → done.permanently_failed", () => {
    const result = transition(
      "complete_session.running",
      makeEvent("COMPLETE_ERROR", { statusCode: 400, message: "Bad request" }),
      ctx,
    );
    expect(result).not.toBeNull();
    expect(result!.state).toBe("done.permanently_failed");
  });

  it("COMPLETE_ERROR 500 → complete_session.failed", () => {
    const result = transition(
      "complete_session.running",
      makeEvent("COMPLETE_ERROR", { statusCode: 500, message: "Server error" }),
      ctx,
    );
    expect(result).not.toBeNull();
    expect(result!.state).toBe("complete_session.failed");
  });
});

// ---------------------------------------------------------------------------
// Estado: evaluation.running
// ---------------------------------------------------------------------------

describe("evaluation.running", () => {
  it("EVALUATION_OK + metrics → done.success", () => {
    const ctx = makeCtx({ totalBytes: 10_000, backendSessionId: "session-123" });
    const result = transition("evaluation.running", makeEvent("EVALUATION_OK"), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("done.success");
    expect(result!.effects.some((e) => e.type === "persistDone")).toBe(true);
  });

  it("EVALUATION_OK + zero metrics → evaluation.failed", () => {
    const ctx = makeCtx({ totalBytes: 0, totalFiles: 0, backendSessionId: "session-123" });
    const result = transition("evaluation.running", makeEvent("EVALUATION_OK"), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("evaluation.failed");
  });

  it("EVALUATION_ERROR 401 → done.permanently_failed", () => {
    const ctx = makeCtx({ backendSessionId: "session-123" });
    const result = transition(
      "evaluation.running",
      makeEvent("EVALUATION_ERROR", { statusCode: 401, message: "Unauthorized" }),
      ctx,
    );
    expect(result).not.toBeNull();
    expect(result!.state).toBe("done.permanently_failed");
  });
});

// ---------------------------------------------------------------------------
// Estados terminales: done
// ---------------------------------------------------------------------------

describe("terminal states", () => {
  const ctx = makeCtx();

  it("done.success ignora SCHEDULER_TICK", () => {
    const result = transition("done.success", makeEvent("SCHEDULER_TICK", { nowMs: Date.now() }), ctx);
    expect(result).toBeNull();
  });

  it("done.success ignora NATIVE_COMPLETED", () => {
    const result = transition("done.success", makeEvent("NATIVE_COMPLETED"), ctx);
    expect(result).toBeNull();
  });

  it("done.permanently_failed permite USER_RETRY", () => {
    const result = transition("done.permanently_failed", makeEvent("USER_RETRY"), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("create_session.idle");
    expect(result!.context.attempts).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Retry / backoff behavior
// ---------------------------------------------------------------------------

describe("retry guards", () => {
  it("no permite SCHEDULER_TICK si ya se superó maxAttempts", () => {
    const ctx = makeCtx({ attempts: 5, lastError: null });
    const result = transition("create_session.idle", makeEvent("SCHEDULER_TICK", { nowMs: Date.now() }), ctx);
    expect(result).toBeNull();
  });

  it("no permite SCHEDULER_TICK si está marcado PERMANENT", () => {
    const ctx = makeCtx({ attempts: 0, lastError: "[PERMANENT] something" });
    const result = transition("create_session.idle", makeEvent("SCHEDULER_TICK", { nowMs: Date.now() }), ctx);
    expect(result).toBeNull();
  });

  it("permite retry manual (USER_RETRY) incluso con attempts agotados", () => {
    const ctx = makeCtx({ attempts: 10, lastError: "something" });
    const result = transition("upload.failed", makeEvent("USER_RETRY"), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("upload.uploading");
  });
});

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

describe("polling", () => {
  const ctx = makeCtx({ backendSessionId: "session-123", skyboltSessionId: "skybolt-456" });

  it("POLL_TICK completed → complete_session.idle", () => {
    const result = transition(
      "upload.uploading",
      makeEvent("POLL_TICK", { status: "completed", metrics: { totalFiles: 10, completedFiles: 10, totalBytes: 10_000, uploadedBytes: 10_000 } }),
      ctx,
    );
    expect(result).not.toBeNull();
    expect(result!.state).toBe("complete_session.idle");
    expect(result!.effects.some((e) => e.type === "stopPolling")).toBe(true);
    expect(result!.context.completedFiles).toBe(10);
    expect(result!.effects.some((e) => e.type === "persistMetrics")).toBe(true);
  });

  it("POLL_TICK failed → upload.failed", () => {
    const result = transition(
      "upload.uploading",
      makeEvent("POLL_TICK", { status: "failed", metrics: null }),
      ctx,
    );
    expect(result).not.toBeNull();
    expect(result!.state).toBe("upload.failed");
  });

  it("POLL_TICK uploading → se mantiene en upload.uploading", () => {
    const result = transition(
      "upload.uploading",
      makeEvent("POLL_TICK", { status: "uploading", metrics: { totalFiles: 10, completedFiles: 5, totalBytes: 10_000, uploadedBytes: 5_000 } }),
      ctx,
    );
    expect(result).not.toBeNull();
    expect(result!.state).toBe("upload.uploading");
    expect(result!.context.uploadedBytes).toBe(5_000);
    expect(result!.context.completedFiles).toBe(5);
    expect(result!.effects.some((e) => e.type === "persistMetrics")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Flujo completo: happy path
// ---------------------------------------------------------------------------

describe("happy path full flow", () => {
  it("create_session.idle → done.success en secuencia", () => {
    let ctx = makeCtx();

    // 1) create
    let r = transition("create_session.idle", makeEvent("SCHEDULER_TICK", { nowMs: Date.now() }), ctx)!;
    expect(r.state).toBe("create_session.running");
    ctx = r.context;

    // 2) backend responde
    r = transition(r.state, makeEvent("SESSION_CREATED", { sessionId: "s-1" }), ctx)!;
    expect(r.state).toBe("upload.idle");
    ctx = r.context;

    // 3) scheduler arranca upload
    r = transition(r.state, makeEvent("SCHEDULER_TICK", { nowMs: Date.now() }), ctx)!;
    expect(r.state).toBe("upload.uploading");
    ctx = r.context;

    // 4) nativo completa
    r = transition(r.state, makeEvent("NATIVE_COMPLETED"), ctx)!;
    expect(r.state).toBe("complete_session.idle");
    ctx = r.context;

    // 5) scheduler completa sesión
    r = transition(r.state, makeEvent("SCHEDULER_TICK", { nowMs: Date.now() }), ctx)!;
    expect(r.state).toBe("complete_session.running");
    ctx = r.context;

    // 6) backend confirma complete
    r = transition(r.state, makeEvent("COMPLETE_OK"), ctx)!;
    expect(r.state).toBe("evaluation.idle");
    ctx = r.context;

    // 7) scheduler evalúa
    r = transition(r.state, makeEvent("SCHEDULER_TICK", { nowMs: Date.now() }), ctx)!;
    expect(r.state).toBe("evaluation.running");
    ctx = r.context;

    // 8) backend evalúa OK
    r = transition(r.state, makeEvent("EVALUATION_OK"), ctx)!;
    expect(r.state).toBe("done.success");
  });
});
