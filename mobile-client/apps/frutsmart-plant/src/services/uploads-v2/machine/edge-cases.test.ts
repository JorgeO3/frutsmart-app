/**
 * Edge-case tests for the upload state machine.
 *
 * These tests document bugs found during audit.
 * They are expected to FAIL with the current implementation.
 * After fixing the code, these tests should PASS.
 */

import { transition } from "./interpreter";
import { guards } from "./guards";
import type { UploadJobContext, UploadMachineEvent, MachineConfig } from "../types";

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

const CONFIG: MachineConfig = {
  maxAttemptsPerStep: 3,
  baseBackoffMs: 1_000,
  maxBackoffMs: 10_000,
  jitterFraction: 0,
};

// ============================================================================
// BUG 3: lastAttemptAt = NaN makes job a zombie (never runs again)
// ============================================================================

describe("BUG 3: lastAttemptAt = NaN", () => {
  it("should allow SCHEDULER_TICK when lastAttemptAt is NaN", () => {
    const ctx = makeCtx({ attempts: 1, lastAttemptAt: NaN });
    const result = transition("create_session.idle", makeEvent("SCHEDULER_TICK", { nowMs: Date.now() }), ctx, CONFIG);
    // EXPECTED: should transition because NaN is invalid and should be treated as "never attempted"
    expect(result).not.toBeNull();
    expect(result!.state).toBe("create_session.running");
  });
});

// ============================================================================
// BUG 5: polling with status "unknown" can loop forever
// ============================================================================

describe("BUG 5: POLL_TICK with status 'unknown'", () => {
  it("should NOT stay in upload.uploading for status 'unknown'", () => {
    const ctx = makeCtx({ backendSessionId: "s-1", skyboltSessionId: "sky-1" });
    const result = transition(
      "upload.uploading",
      makeEvent("POLL_TICK", { status: "unknown", metrics: null }),
      ctx,
    );
    // EXPECTED: should NOT remain in upload.uploading; either fail or stay but with a limit.
    // Current implementation returns null (no transition matches "unknown").
    // This means the poll event is silently dropped and polling continues forever.
    // We want the machine to handle "unknown" explicitly.
    expect(result).not.toBeNull();
  });
});

// ============================================================================
// BUG 9: duplicate native event should be idempotent
// ============================================================================

describe("BUG 9: duplicate native events", () => {
  it("second NATIVE_COMPLETED should be ignored", () => {
    const ctx = makeCtx({ backendSessionId: "s-1", skyboltSessionId: "sky-1" });

    // First event transitions to complete_session.idle
    const first = transition("upload.uploading", makeEvent("NATIVE_COMPLETED"), ctx);
    expect(first).not.toBeNull();
    expect(first!.state).toBe("complete_session.idle");

    // Second identical event should be ignored (machine returns null)
    const second = transition("complete_session.idle", makeEvent("NATIVE_COMPLETED"), first!.context);
    expect(second).toBeNull();
  });

  it("duplicate SESSION_CREATED should be ignored", () => {
    const ctx = makeCtx();
    const first = transition("create_session.running", makeEvent("SESSION_CREATED", { sessionId: "s-1" }), ctx);
    expect(first!.state).toBe("upload.idle");

    const second = transition("upload.idle", makeEvent("SESSION_CREATED", { sessionId: "s-1" }), first!.context);
    expect(second).toBeNull();
  });
});

// ============================================================================
// BUG 10: canRun guard with PERMANENT error from non-prefix sources
// ============================================================================

describe("BUG 10: canRun with various permanent error formats", () => {
  it("should block retry when lastError contains '[PERMANENT]' anywhere", () => {
    const ctx = makeCtx({ lastError: "Something failed [PERMANENT]", attempts: 0 });
    expect(guards.canRun(ctx, makeEvent("SCHEDULER_TICK", { nowMs: Date.now() }), CONFIG)).toBe(false);
  });

  it("should allow retry when lastError is a regular transient error", () => {
    const ctx = makeCtx({ lastError: "Network timeout", attempts: 0 });
    expect(guards.canRun(ctx, makeEvent("SCHEDULER_TICK", { nowMs: Date.now() }), CONFIG)).toBe(true);
  });
});

// ============================================================================
// BUG 11: progress overflow (uploadedBytes > totalBytes)
// ============================================================================

describe("BUG 11: progress metrics overflow", () => {
  it("should clamp uploadedBytes to totalBytes in updateMetrics", () => {
    const ctx = makeCtx({ totalBytes: 1000 });
    const result = transition(
      "upload.uploading",
      makeEvent("NATIVE_PROGRESS", { totalFiles: 10, completedFiles: 5, totalBytes: 1000, uploadedBytes: 5000 }),
      ctx,
    );
    // EXPECTED: uploadedBytes should be clamped to totalBytes
    expect(result).not.toBeNull();
    expect(result!.context.uploadedBytes).toBeLessThanOrEqual(result!.context.totalBytes);
  });
});

// ============================================================================
// BUG 12: evaluation.ok without metrics should fail, not silently succeed
// ============================================================================

describe("BUG 12: evaluation without metrics", () => {
  it("EVALUATION_OK with zero metrics should go to evaluation.failed", () => {
    const ctx = makeCtx({ totalBytes: 0, totalFiles: 0, backendSessionId: "s-1" });
    const result = transition("evaluation.running", makeEvent("EVALUATION_OK"), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("evaluation.failed");
  });

  it("EVALUATION_OK with metrics should go to done.success", () => {
    const ctx = makeCtx({ totalBytes: 1000, totalFiles: 10, backendSessionId: "s-1" });
    const result = transition("evaluation.running", makeEvent("EVALUATION_OK"), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("done.success");
  });
});

// ============================================================================
// BUG 13: USER_CANCEL during running states
// ============================================================================

describe("BUG 13: cancel during active operations", () => {
  it("USER_CANCEL from create_session.running should cancel and go to permanently_failed", () => {
    const ctx = makeCtx();
    const result = transition("create_session.running", makeEvent("USER_CANCEL"), ctx);
    // EXPECTED: should transition to done.permanently_failed
    expect(result).not.toBeNull();
    expect(result!.state).toBe("done.permanently_failed");
  });

  it("USER_CANCEL from upload.uploading should cancel and go to permanently_failed", () => {
    const ctx = makeCtx({ backendSessionId: "s-1", skyboltSessionId: "sky-1" });
    const result = transition("upload.uploading", makeEvent("USER_CANCEL"), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("done.permanently_failed");
    expect(result!.effects.some((e) => e.type === "stopPolling")).toBe(true);
  });

  it("USER_CANCEL from complete_session.running should cancel and go to permanently_failed", () => {
    const ctx = makeCtx({ backendSessionId: "s-1" });
    const result = transition("complete_session.running", makeEvent("USER_CANCEL"), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("done.permanently_failed");
  });
});

// ============================================================================
// BUG 14: machine accepts events for wrong job (sessionId mismatch)
// ============================================================================

describe("BUG 14: cross-job event contamination", () => {
  it("should not allow NATIVE_STARTED for a job already in complete_session", () => {
    const ctx = makeCtx({ backendSessionId: "s-1", skyboltSessionId: "sky-1" });
    // Job is already past upload
    const result = transition("complete_session.idle", makeEvent("NATIVE_STARTED", { skyboltSessionId: "sky-1" }), ctx);
    expect(result).toBeNull();
  });
});

// ============================================================================
// BUG 15: resetAttempts should also clear lastError on USER_RETRY from terminal
// ============================================================================

describe("BUG 15: USER_RETRY from terminal should fully reset context", () => {
  it("USER_RETRY from done.permanently_failed should clear lastError", () => {
    const ctx = makeCtx({ lastError: "[PERMANENT] failed", attempts: 5 });
    const result = transition("done.permanently_failed", makeEvent("USER_RETRY"), ctx);
    expect(result).not.toBeNull();
    expect(result!.state).toBe("create_session.idle");
    expect(result!.context.lastError).toBeNull();
    expect(result!.context.attempts).toBe(0);
  });
});
