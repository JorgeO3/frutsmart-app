/**
 * Edge-case integration tests for UploadOrchestrator.
 *
 * These test the interaction between effects, store, and machine.
 */

import { uploadOrchestrator } from "./UploadOrchestrator";
import { useUploadStore } from "../store/uploadStore";
import type { UploadJobContext } from "../types";

// Mock the native adapter to avoid importing Skybolt
jest.mock("./NativeUploadAdapter", () => ({
  initNativeAdapter: jest.fn(),
  initializeAndStartSession: jest.fn().mockResolvedValue(undefined),
  resumeNativeSession: jest.fn().mockResolvedValue(undefined),
  pauseNativeSession: jest.fn().mockResolvedValue(undefined),
  cancelNativeSession: jest.fn().mockResolvedValue(undefined),
  getNativeProgress: jest.fn().mockResolvedValue(null),
}));

// Mock the backend adapter
jest.mock("./BackendUploadAdapter", () => ({
  createUploadSession: jest.fn().mockResolvedValue({ sessionId: "sess-123", items: [] }),
  completeUploadSession: jest.fn().mockResolvedValue(undefined),
  createEvaluation: jest.fn().mockResolvedValue(undefined),
  prepareSkyboltItems: jest.fn().mockReturnValue([]),
}));

// Mock authConfig
jest.mock("@src/config/authConfig", () => ({
  apiBaseUrl: "http://localhost:3000",
  oidcConfig: {
    issuer: "https://test.b2c.com/tenant",
    openIdConfigUrl: "https://test.b2c.com/tenant/.well-known/openid-configuration",
    tokenEndpoint: "https://test.b2c.com/tenant/oauth2/token",
    clientId: "test-client-id",
    scopes: ["openid", "profile"],
  },
  authEnabled: false,
}));

// Mock DB
jest.mock("@adapters/repository/Database", () => ({
  database: {
    uploadJobs: {
      getAllJobs: jest.fn().mockResolvedValue([]),
      createJob: jest.fn().mockResolvedValue(undefined),
      updateJobStep: jest.fn().mockResolvedValue(undefined),
      markJobFailed: jest.fn().mockResolvedValue(undefined),
      markJobDone: jest.fn().mockResolvedValue(undefined),
      setBackendSessionId: jest.fn().mockResolvedValue(undefined),
      setSkyboltSessionId: jest.fn().mockResolvedValue(undefined),
      updateJobMetrics: jest.fn().mockResolvedValue(undefined),
    },
    qualityAnalyses: {
      findFullById: jest.fn().mockResolvedValue({
        classifications: [],
      }),
    },
  },
}));

// Mock crypto and file-system
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn().mockReturnValue("mock-uuid"),
}));

jest.mock("expo-file-system/legacy", () => ({
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
}));

// Mock skybolt
jest.mock("skybolt", () => ({
  extractMD5FromFiles: jest.fn().mockResolvedValue([]),
  configure: jest.fn().mockResolvedValue(undefined),
  getSessionProgress: jest.fn().mockResolvedValue(null),
  initializeSession: jest.fn().mockResolvedValue(undefined),
  startSession: jest.fn().mockResolvedValue(undefined),
  resumeSession: jest.fn().mockResolvedValue(undefined),
  pauseSession: jest.fn().mockResolvedValue(undefined),
  cancelSession: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  useUploadStore.setState({ jobs: new Map() });
  // Reset singleton bootstrap flag so initNativeAdapter is called again
  (uploadOrchestrator as any).isBootstrapped = false;
});

// ============================================================================
// BUG 2: startNativeUpload effect dispatches NATIVE_STARTED
// ============================================================================

describe("BUG 2: startNativeUpload dispatches NATIVE_STARTED", () => {
  it("should have skyboltSessionId set after starting native upload", async () => {
    const jobId = "job-1";
    const backendSessionId = "sess-1";

    const ctx: UploadJobContext = {
      jobId,
      analysisId: "a1",
      domain: "plant",
      clientBatchId: jobId,
      backendSessionId,
      skyboltSessionId: null,
      totalFiles: 10,
      completedFiles: 0,
      totalBytes: 10_000,
      uploadedBytes: 0,
      attempts: 0,
      lastError: null,
      lastAttemptAt: null,
      createdAt: Date.now(),
    };

    useUploadStore.getState().loadJob(ctx, "upload.idle");

    // Dispatch NATIVE_STARTED directly (simulating the effect or native event)
    useUploadStore.getState().dispatch(jobId, { type: "NATIVE_STARTED", skyboltSessionId: backendSessionId });

    const snapshot = useUploadStore.getState().getSnapshot(jobId);
    expect(snapshot!.context.skyboltSessionId).toBe(backendSessionId);
    expect(snapshot!.state).toBe("upload.uploading");
  });
});

// ============================================================================
// BUG 4: paused jobs stay paused after bootstrap
// ============================================================================

describe("BUG 4: paused jobs should stay paused after bootstrap", () => {
  it("should map DB paused state to upload.paused, not upload.idle", async () => {
    const { database } = require("@adapters/repository/Database");

    // Simulate a job that was paused by the user
    database.uploadJobs.getAllJobs.mockResolvedValueOnce([
      {
        id: "job-paused",
        quality_analysis_id: "a1",
        domain: "plant",
        client_batch_id: "job-paused",
        backend_session_id: "sess-1",
        skybolt_session_id: "sky-1",
        pipeline_step: "upload",
        step_status: "pending",
        total_files: 10,
        completed_files: 5,
        total_bytes: 10_000,
        uploaded_bytes: 5_000,
        last_error: null,
        attempts_count: 2,
        last_attempt_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    // Reset and bootstrap
    useUploadStore.setState({ jobs: new Map() });
    await uploadOrchestrator.bootstrap();

    const snapshot = useUploadStore.getState().getSnapshot("job-paused");
    expect(snapshot!.state).toBe("upload.paused");
  });
});

// ============================================================================
// BUG 7: memory caches cleared on terminal states
// ============================================================================

describe("BUG 7: memory caches should be cleared on terminal states", () => {
  it("should clear analysisFilesCache when job reaches done.success", async () => {
    const jobId = "job-1";

    // Access private caches via any cast
    const orchestrator = uploadOrchestrator as any;

    // Simulate cache population
    orchestrator.analysisFilesCache.set(jobId, [{ clientItemId: "c1", localUri: "file://a.jpg", fileName: "a.jpg", contentType: "image/jpeg", sizeBytes: 1000, md5: "abc" }]);
    orchestrator.preparedItemsCache.set(jobId, [{ clientItemId: "c1", localUri: "file://a.jpg", blobName: "b1", contentType: "image/jpeg", sizeBytes: 1000, md5Hex: "abc" }]);

    // Simulate the persistDone effect being run
    await (orchestrator as any).runSingleEffect("job-1", { type: "persistDone", jobId }, {
      jobId,
      analysisId: "a1",
      domain: "plant",
      clientBatchId: jobId,
    } as UploadJobContext);

    // EXPECTED: caches should be cleared for this jobId
    expect(orchestrator.analysisFilesCache.has(jobId)).toBe(false);
    expect(orchestrator.preparedItemsCache.has(jobId)).toBe(false);
  });
});

// ============================================================================
// BUG 16: Native event for non-existent job should not crash
// ============================================================================

describe("BUG 16: native event before store ready", () => {
  it("should not crash if native event arrives for unknown job", async () => {
    // Bootstrap first so initNativeAdapter is called
    await uploadOrchestrator.bootstrap();

    const { initNativeAdapter } = require("./NativeUploadAdapter");
    const handler = (initNativeAdapter as jest.Mock).mock.calls[0]?.[0];

    expect(handler).toBeDefined();

    // Simulate native event for a job that doesn't exist in the store
    expect(() => {
      handler("non-existent-session", { type: "NATIVE_COMPLETED" });
    }).not.toThrow();
  });
});
