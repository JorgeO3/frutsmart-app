/**
 * Tests de BackendUploadAdapter
 */

import {
  createUploadSession,
  completeUploadSession,
  prepareSkyboltItems,
} from "./BackendUploadAdapter";
import type { AnalysisUploadFile } from "./BackendUploadAdapter";
import { UploadApiError } from "../types";

// Mock de authConfig para evitar que cargue expo-constants real
jest.mock("@src/config/authConfig", () => ({
  apiBaseUrl: "http://localhost:3000",
}));

// Mock del auth service
jest.mock("../../auth/authService", () => ({
  getValidAccessToken: jest.fn().mockResolvedValue("mock-token"),
}));

// Mock global fetch
global.fetch = jest.fn();

function mockFetchResponse(status: number, body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  });
}

const FILES: AnalysisUploadFile[] = [
  { clientItemId: "c1", localUri: "file://a.jpg", fileName: "a.jpg", contentType: "image/jpeg", sizeBytes: 1_000, md5: "abc123" },
];

describe("createUploadSession", () => {
  it("crea sesión y retorna sessionId + items", async () => {
    mockFetchResponse(200, {
      sessionId: "sess-1",
      items: [{ clientItemId: "c1", blobName: "uploads/sess-1/a.jpg" }],
    });

    const result = await createUploadSession({
      domain: "plant",
      clientBatchId: "batch-1",
      qualityAnalysisId: "qa-1",
      files: FILES,
    });

    expect(result.sessionId).toBe("sess-1");
    expect(result.items).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/upload/sessions"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("lanza UploadApiError en 400", async () => {
    mockFetchResponse(400, { message: "Invalid input" });

    await expect(
      createUploadSession({
        domain: "plant",
        clientBatchId: "batch-1",
        qualityAnalysisId: "qa-1",
        files: FILES,
      }),
    ).rejects.toThrow(UploadApiError);
  });
});

describe("completeUploadSession", () => {
  it("llama al endpoint correcto", async () => {
    mockFetchResponse(200, {});
    await completeUploadSession("sess-1");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/upload/sessions/sess-1/complete"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("prepareSkyboltItems", () => {
  it("mapea blobNames del backend", () => {
    const items = prepareSkyboltItems(FILES, "sess-1", [{ clientItemId: "c1", blobName: "custom/blob.jpg" }]);
    expect(items[0].blobName).toBe("custom/blob.jpg");
  });

  it("fallback cuando no hay match", () => {
    const items = prepareSkyboltItems(FILES, "sess-1", []);
    expect(items[0].blobName).toBe("uploads/sess-1/a.jpg");
  });
});

describe("retry on 5xx", () => {
  let originalSetTimeout: typeof setTimeout;

  beforeEach(() => {
    jest.clearAllMocks();
    // Make setTimeout synchronous so retries execute instantly
    originalSetTimeout = global.setTimeout;
    global.setTimeout = jest.fn((cb: (...args: unknown[]) => void) => {
      cb();
      return 0 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout;
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
  });

  it("retries on 503 and eventually succeeds", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: jest.fn().mockResolvedValue(JSON.stringify({ message: "Server busy" })),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        text: jest.fn().mockResolvedValue(JSON.stringify({ sessionId: "sess-retry", items: [] })),
      });

    const result = await createUploadSession({
      domain: "plant",
      clientBatchId: "batch-1",
      qualityAnalysisId: "qa-1",
      files: FILES,
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.sessionId).toBe("sess-retry");
  });

  it("gives up after max retries on 503", async () => {
    for (let i = 0; i < 4; i++) {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: jest.fn().mockResolvedValue(JSON.stringify({ message: "Still down" })),
      });
    }

    await expect(
      createUploadSession({
        domain: "plant",
        clientBatchId: "batch-1",
        qualityAnalysisId: "qa-1",
        files: FILES,
      }),
    ).rejects.toThrow(UploadApiError);

    expect(global.fetch).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it("does NOT retry on 400", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: jest.fn().mockResolvedValue(JSON.stringify({ message: "Invalid" })),
    });

    await expect(
      createUploadSession({
        domain: "plant",
        clientBatchId: "batch-1",
        qualityAnalysisId: "qa-1",
        files: FILES,
      }),
    ).rejects.toThrow(UploadApiError);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
