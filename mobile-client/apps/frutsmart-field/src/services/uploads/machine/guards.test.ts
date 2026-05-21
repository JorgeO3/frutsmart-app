/**
 * Tests de guards
 */

import { guards } from "./guards";
import type { UploadJobContext, UploadMachineEvent, MachineConfig } from "../types";

const CONFIG: MachineConfig = {
  maxAttemptsPerStep: 3,
  baseBackoffMs: 1_000,
  maxBackoffMs: 10_000,
  jitterFraction: 0,
};

function makeCtx(overrides: Partial<UploadJobContext> = {}): UploadJobContext {
  return {
    jobId: "1",
    analysisId: "a1",
    domain: "plant",
    clientBatchId: "b1",
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

describe("guard: canRun", () => {
  it("retorna true si nunca se intentó", () => {
    const ctx = makeCtx({ attempts: 0, lastAttemptAt: null });
    expect(guards.canRun(ctx, { type: "SCHEDULER_TICK", nowMs: Date.now() }, CONFIG)).toBe(true);
  });

  it("retorna false si se alcanzó maxAttempts", () => {
    const ctx = makeCtx({ attempts: 3 });
    expect(guards.canRun(ctx, { type: "SCHEDULER_TICK", nowMs: Date.now() }, CONFIG)).toBe(false);
  });

  it("retorna false si el error es permanente", () => {
    const ctx = makeCtx({ attempts: 0, lastError: "[PERMANENT] something" });
    expect(guards.canRun(ctx, { type: "SCHEDULER_TICK", nowMs: Date.now() }, CONFIG)).toBe(false);
  });

  it("retorna true si el backoff ya pasó", () => {
    const ctx = makeCtx({ attempts: 1, lastAttemptAt: Date.now() - 20_000 });
    expect(guards.canRun(ctx, { type: "SCHEDULER_TICK", nowMs: Date.now() }, CONFIG)).toBe(true);
  });

  it("retorna false si el backoff aún no pasa", () => {
    const ctx = makeCtx({ attempts: 1, lastAttemptAt: Date.now() });
    expect(guards.canRun(ctx, { type: "SCHEDULER_TICK", nowMs: Date.now() }, CONFIG)).toBe(false);
  });
});

describe("guard: isPermanentError", () => {
  it("400 es permanente", () => {
    const event: UploadMachineEvent = { type: "SESSION_ERROR", statusCode: 400, message: "" };
    expect(guards.isPermanentError(makeCtx(), event, CONFIG)).toBe(true);
  });

  it("500 NO es permanente", () => {
    const event: UploadMachineEvent = { type: "SESSION_ERROR", statusCode: 500, message: "" };
    expect(guards.isPermanentError(makeCtx(), event, CONFIG)).toBe(false);
  });

  it("mensaje con prefijo PERMANENT es permanente", () => {
    const event: UploadMachineEvent = { type: "SESSION_ERROR", statusCode: 0, message: "[PERMANENT] fail" };
    expect(guards.isPermanentError(makeCtx(), event, CONFIG)).toBe(true);
  });

  it("ignora eventos que no son errores de sesión", () => {
    const event: UploadMachineEvent = { type: "NATIVE_COMPLETED" };
    expect(guards.isPermanentError(makeCtx(), event, CONFIG)).toBe(false);
  });
});

describe("guard: hasMetrics", () => {
  it("retorna true si totalBytes > 0", () => {
    expect(guards.hasMetrics(makeCtx({ totalBytes: 100 }), {} as UploadMachineEvent, CONFIG)).toBe(true);
  });

  it("retorna true si totalFiles > 0", () => {
    expect(guards.hasMetrics(makeCtx({ totalBytes: 0, totalFiles: 1 }), {} as UploadMachineEvent, CONFIG)).toBe(true);
  });

  it("retorna false si ambos son 0", () => {
    expect(guards.hasMetrics(makeCtx({ totalBytes: 0, totalFiles: 0 }), {} as UploadMachineEvent, CONFIG)).toBe(false);
  });
});

describe("guard: pollDetectedCompleted", () => {
  it("detecta completed", () => {
    const event: UploadMachineEvent = { type: "POLL_TICK", status: "completed", metrics: null };
    expect(guards.pollDetectedCompleted(makeCtx(), event, CONFIG)).toBe(true);
  });

  it("rechaza uploading", () => {
    const event: UploadMachineEvent = { type: "POLL_TICK", status: "uploading", metrics: null };
    expect(guards.pollDetectedCompleted(makeCtx(), event, CONFIG)).toBe(false);
  });
});

describe("guard: pollDetectedFailed", () => {
  it("detecta failed", () => {
    const event: UploadMachineEvent = { type: "POLL_TICK", status: "failed", metrics: null };
    expect(guards.pollDetectedFailed(makeCtx(), event, CONFIG)).toBe(true);
  });

  it("rechaza completed", () => {
    const event: UploadMachineEvent = { type: "POLL_TICK", status: "completed", metrics: null };
    expect(guards.pollDetectedFailed(makeCtx(), event, CONFIG)).toBe(false);
  });
});
