/**
 * Tests del Zustand Store
 */

import { useUploadStore } from "./uploadStore";
import type { UploadJobContext, UploadStateValue } from "../types";

function makeCtx(overrides: Partial<UploadJobContext> = {}): UploadJobContext {
  return {
    jobId: "job-1",
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

beforeEach(() => {
  // Reset store antes de cada test
  useUploadStore.setState({ jobs: new Map() });
});

describe("loadJob / unloadJob", () => {
  it("carga un job en el store", () => {
    useUploadStore.getState().loadJob(makeCtx(), "create_session.idle");
    expect(useUploadStore.getState().jobs.has("job-1")).toBe(true);
  });

  it("descarga un job del store", () => {
    useUploadStore.getState().loadJob(makeCtx(), "create_session.idle");
    useUploadStore.getState().unloadJob("job-1");
    expect(useUploadStore.getState().jobs.has("job-1")).toBe(false);
  });
});

describe("dispatch", () => {
  it("transiciona de idle a running con SCHEDULER_TICK", () => {
    useUploadStore.getState().loadJob(makeCtx(), "create_session.idle");
    const result = useUploadStore.getState().dispatch("job-1", { type: "SCHEDULER_TICK", nowMs: Date.now() });

    expect(result).not.toBeNull();
    expect(result!.state).toBe("create_session.running");
    expect(useUploadStore.getState().jobs.get("job-1")!.state).toBe("create_session.running");
  });

  it("ignora eventos inválidos y retorna null", () => {
    useUploadStore.getState().loadJob(makeCtx(), "create_session.idle");
    const result = useUploadStore.getState().dispatch("job-1", { type: "NATIVE_COMPLETED" } as any);

    expect(result).toBeNull();
    expect(useUploadStore.getState().jobs.get("job-1")!.state).toBe("create_session.idle");
  });

  it("retorna null para job inexistente", () => {
    const result = useUploadStore.getState().dispatch("missing", { type: "SCHEDULER_TICK", nowMs: Date.now() });
    expect(result).toBeNull();
  });
});

describe("getSnapshot", () => {
  it("deriva progressPercent correctamente", () => {
    useUploadStore.getState().loadJob(makeCtx({ uploadedBytes: 5_000 }), "upload.uploading");
    const snap = useUploadStore.getState().getSnapshot("job-1");
    expect(snap!.progressPercent).toBe(50);
  });

  it("detecta estados terminales", () => {
    useUploadStore.getState().loadJob(makeCtx(), "done.success");
    const snap = useUploadStore.getState().getSnapshot("job-1");
    expect(snap!.isTerminal).toBe(true);
    expect(snap!.canRetry).toBe(false);
    expect(snap!.canCancel).toBe(false);
  });

  it("detecta que se puede pausar en uploading", () => {
    useUploadStore.getState().loadJob(makeCtx(), "upload.uploading");
    const snap = useUploadStore.getState().getSnapshot("job-1");
    expect(snap!.canPause).toBe(true);
  });

  it("retorna null para job inexistente", () => {
    expect(useUploadStore.getState().getSnapshot("missing")).toBeNull();
  });
});

describe("getAllSnapshots", () => {
  it("lista todos los jobs", () => {
    useUploadStore.getState().loadJob(makeCtx({ jobId: "a" }), "create_session.idle");
    useUploadStore.getState().loadJob(makeCtx({ jobId: "b" }), "upload.uploading");
    const all = useUploadStore.getState().getAllSnapshots();
    expect(all).toHaveLength(2);
  });
});

describe("getRunnableJobIds", () => {
  it("incluye jobs que no están en done ni paused", () => {
    useUploadStore.getState().loadJob(makeCtx({ jobId: "a" }), "create_session.idle");
    useUploadStore.getState().loadJob(makeCtx({ jobId: "b" }), "upload.uploading");
    useUploadStore.getState().loadJob(makeCtx({ jobId: "c" }), "upload.paused");
    useUploadStore.getState().loadJob(makeCtx({ jobId: "d" }), "done.success");

    const ids = useUploadStore.getState().getRunnableJobIds();
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).not.toContain("c");
    expect(ids).not.toContain("d");
  });
});

describe("getTerminalJobIds", () => {
  it("solo incluye jobs en done", () => {
    useUploadStore.getState().loadJob(makeCtx({ jobId: "a" }), "done.success");
    useUploadStore.getState().loadJob(makeCtx({ jobId: "b" }), "done.permanently_failed");
    useUploadStore.getState().loadJob(makeCtx({ jobId: "c" }), "upload.uploading");

    const ids = useUploadStore.getState().getTerminalJobIds();
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).not.toContain("c");
  });
});
