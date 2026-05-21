/**
 * Tests de NativeUploadAdapter
 */

import {
  initNativeAdapter,
  initializeAndStartSession,
  resumeNativeSession,
  pauseNativeSession,
  cancelNativeSession,
  getNativeProgress,
} from "./NativeUploadAdapter";
import type { NativeEventHandler } from "./NativeUploadAdapter";

// Mock del módulo skybolt
jest.mock("skybolt", () => ({
  addUploadListener: jest.fn(),
  initializeSession: jest.fn().mockResolvedValue(undefined),
  startSession: jest.fn().mockResolvedValue(undefined),
  resumeSession: jest.fn().mockResolvedValue(undefined),
  pauseSession: jest.fn().mockResolvedValue(undefined),
  cancelSession: jest.fn().mockResolvedValue(undefined),
  getSessionProgress: jest.fn().mockResolvedValue({
    totalFiles: 10,
    completedFiles: 5,
    totalBytes: 10_000,
    uploadedBytes: 5_000,
    status: "uploading",
    transferRateBps: 2_048,
    estimatedCompletionMs: 3_200,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Skybolt = require("skybolt");

describe("initNativeAdapter", () => {
  it("registra listener una sola vez", () => {
    const handler: NativeEventHandler = jest.fn();
    initNativeAdapter(handler);
    initNativeAdapter(handler); // duplicado
    expect(Skybolt.addUploadListener).toHaveBeenCalledTimes(1);
  });
});

describe("native operations", () => {
  it("initializeAndStartSession llama a skybolt", async () => {
    await initializeAndStartSession("sess-1", []);
    expect(Skybolt.initializeSession).toHaveBeenCalled();
    expect(Skybolt.startSession).toHaveBeenCalledWith("sess-1");
  });

  it("resumeNativeSession delega", async () => {
    await resumeNativeSession("sess-1");
    expect(Skybolt.resumeSession).toHaveBeenCalledWith("sess-1");
  });

  it("pauseNativeSession delega", async () => {
    await pauseNativeSession("sess-1");
    expect(Skybolt.pauseSession).toHaveBeenCalledWith("sess-1");
  });

  it("cancelNativeSession delega", async () => {
    await cancelNativeSession("sess-1");
    expect(Skybolt.cancelSession).toHaveBeenCalledWith("sess-1");
  });

  it("getNativeProgress traduce el resultado", async () => {
    const progress = await getNativeProgress("sess-1");
    expect(progress).not.toBeNull();
    expect(progress!.totalFiles).toBe(10);
    expect(progress!.status).toBe("uploading");
    expect(progress!.transferRateBps).toBe(2_048);
    expect(progress!.estimatedRemainingSeconds).toBe(4);
  });
});
