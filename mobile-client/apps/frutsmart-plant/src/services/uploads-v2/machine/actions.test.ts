/**
 * Tests de actions (mutaciones puras de contexto)
 */

import { contextMutators } from "./actions";
import type { UploadJobContext, UploadMachineEvent } from "../types";

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

describe("incrementAttempts", () => {
  it("incrementa attempts y setea lastAttemptAt", () => {
    const ctx = makeCtx({ attempts: 2 });
    const result = contextMutators.incrementAttempts(ctx, {} as UploadMachineEvent);
    expect(result!.attempts).toBe(3);
    expect(result!.lastAttemptAt).toBeGreaterThan(0);
  });
});

describe("resetAttempts", () => {
  it("limpia attempts, lastError y lastAttemptAt", () => {
    const ctx = makeCtx({ attempts: 5, lastError: "fail", lastAttemptAt: Date.now() });
    const result = contextMutators.resetAttempts(ctx, {} as UploadMachineEvent);
    expect(result!.attempts).toBe(0);
    expect(result!.lastError).toBeNull();
    expect(result!.lastAttemptAt).toBeNull();
  });
});

describe("setBackendSessionId", () => {
  it("extrae sessionId de SESSION_CREATED", () => {
    const event: UploadMachineEvent = { type: "SESSION_CREATED", sessionId: "sess-1" };
    const result = contextMutators.setBackendSessionId(makeCtx(), event);
    expect(result!.backendSessionId).toBe("sess-1");
  });

  it("retorna undefined para otros eventos", () => {
    const event: UploadMachineEvent = { type: "NATIVE_COMPLETED" };
    const result = contextMutators.setBackendSessionId(makeCtx(), event);
    expect(result).toBeUndefined();
  });
});

describe("setSkyboltSessionId", () => {
  it("extrae skyboltSessionId de NATIVE_STARTED", () => {
    const event: UploadMachineEvent = { type: "NATIVE_STARTED", skyboltSessionId: "sky-1" };
    const result = contextMutators.setSkyboltSessionId(makeCtx(), event);
    expect(result!.skyboltSessionId).toBe("sky-1");
  });
});

describe("updateMetrics", () => {
  it("actualiza métricas desde NATIVE_PROGRESS", () => {
    const event: UploadMachineEvent = {
      type: "NATIVE_PROGRESS",
      totalFiles: 20,
      completedFiles: 10,
      totalBytes: 20_000,
      uploadedBytes: 10_000,
    };
    const result = contextMutators.updateMetrics(makeCtx(), event);
    expect(result!.totalFiles).toBe(20);
    expect(result!.completedFiles).toBe(10);
    expect(result!.totalBytes).toBe(20_000);
    expect(result!.uploadedBytes).toBe(10_000);
  });

  it("actualiza métricas desde POLL_TICK con metrics", () => {
    const event: UploadMachineEvent = {
      type: "POLL_TICK",
      status: "uploading",
      metrics: { totalFiles: 15, completedFiles: 5, totalBytes: 15_000, uploadedBytes: 5_000 },
    };
    const result = contextMutators.updateMetrics(makeCtx(), event);
    expect(result!.totalFiles).toBe(15);
    expect(result!.uploadedBytes).toBe(5_000);
  });

  it("retorna undefined si POLL_TICK no trae metrics", () => {
    const event: UploadMachineEvent = { type: "POLL_TICK", status: "uploading", metrics: null };
    const result = contextMutators.updateMetrics(makeCtx(), event);
    expect(result).toBeUndefined();
  });
});
