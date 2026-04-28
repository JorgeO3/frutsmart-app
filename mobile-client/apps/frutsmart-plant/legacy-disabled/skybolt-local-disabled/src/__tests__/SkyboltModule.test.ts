import { describe, expect, it, mock } from "bun:test";

mock.module("expo", () => ({
  requireNativeModule: () => {
    throw new Error("Native module not available in test");
  },
}));

const { isAvailable, toUploadEvent } = await import("../SkyboltModule");

describe("SkyboltModule adapter", () => {
  it("reports unavailable module in test runtime", () => {
    expect(isAvailable).toBe(false);
  });

  it("maps session:paused with default reason", () => {
    const event = toUploadEvent({
      type: "session:paused",
      sessionId: "s1",
    });

    expect(event).toEqual({
      type: "session:paused",
      sessionId: "s1",
      reason: "user",
    });
  });

  it("maps simple session lifecycle events", () => {
    expect(toUploadEvent({ type: "session:started", sessionId: "s1" })).toEqual({
      type: "session:started",
      sessionId: "s1",
    });
    expect(toUploadEvent({ type: "session:resumed", sessionId: "s1" })).toEqual({
      type: "session:resumed",
      sessionId: "s1",
    });
    expect(toUploadEvent({ type: "session:completed", sessionId: "s1" })).toEqual({
      type: "session:completed",
      sessionId: "s1",
    });
    expect(toUploadEvent({ type: "session:canceled", sessionId: "s1" })).toEqual({
      type: "session:canceled",
      sessionId: "s1",
    });
  });

  it("maps item:progress with fallback numeric values", () => {
    const event = toUploadEvent({
      type: "item:progress",
      sessionId: "s1",
      clientItemId: "i1",
    });

    expect(event.type).toBe("item:progress");
    if (event.type !== "item:progress") {
      throw new Error("Unexpected event type");
    }

    expect(event.payload.bytesUploaded).toBe(0);
    expect(event.payload.totalBytes).toBe(0);
  });

  it("maps error:network with attempt fallback", () => {
    const event = toUploadEvent({
      type: "error:network",
      sessionId: "s1",
      clientItemId: "i1",
    });

    expect(event.type).toBe("error:network");
    if (event.type !== "error:network") {
      throw new Error("Unexpected event type");
    }

    expect(event.payload.attempt).toBe(0);
    expect(event.payload.message).toBe("Network error");
  });

  it("maps item:failed with fallback error", () => {
    const event = toUploadEvent({
      type: "item:failed",
      sessionId: "s1",
      clientItemId: "i1",
    });

    expect(event).toEqual({
      type: "item:failed",
      sessionId: "s1",
      payload: {
        clientItemId: "i1",
        error: {
          code: "E_UNKNOWN",
          message: "Unknown error",
        },
      },
    });
  });

  it("maps forbidden/contract/checksum/file-access errors", () => {
    const types = [
      "error:forbidden",
      "error:contract",
      "error:checksum",
      "error:file-access",
    ] as const;

    for (const type of types) {
      const event = toUploadEvent({
        type,
        sessionId: "s1",
        clientItemId: "i1",
      });
      expect(event.type).toBe(type);
      if (
        event.type === "error:forbidden" ||
        event.type === "error:contract" ||
        event.type === "error:checksum" ||
        event.type === "error:file-access"
      ) {
        expect(event.payload.message).toBe("Error occurred");
      }
    }
  });

  it("maps throttling errors with retryAfter fallback", () => {
    const rateLimited = toUploadEvent({
      type: "error:rate-limited",
      sessionId: "s1",
      clientItemId: "i1",
    });
    const throttled = toUploadEvent({
      type: "error:throttled",
      sessionId: "s1",
      clientItemId: "i1",
    });

    if (rateLimited.type !== "error:rate-limited") throw new Error("bad type");
    if (throttled.type !== "error:throttled") throw new Error("bad type");

    expect(rateLimited.payload.retryAfterMs).toBe(0);
    expect(throttled.payload.retryAfterMs).toBe(0);
  });

  it("maps sas events", () => {
    expect(
      toUploadEvent({
        type: "sas:requested",
        sessionId: "s1",
      }),
    ).toEqual({
      type: "sas:requested",
      sessionId: "s1",
      payload: { blobNames: [] },
    });

    expect(
      toUploadEvent({
        type: "sas:error",
        sessionId: "s1",
      }),
    ).toEqual({
      type: "sas:error",
      sessionId: "s1",
      error: {
        code: "E_SAS",
        message: "SAS error",
      },
    });
  });

  it("maps upload:recovery-complete with fallbacks", () => {
    expect(
      toUploadEvent({
        type: "upload:recovery-complete",
      }),
    ).toEqual({
      type: "upload:recovery-complete",
      payload: {
        totalScanned: 0,
        pendingCount: 0,
      },
    });
  });

  it("maps debug event", () => {
    expect(
      toUploadEvent({
        type: "debug",
        message: "ok",
      }),
    ).toEqual({
      type: "debug",
      sessionId: undefined,
      message: "ok",
    });
  });

  it("throws when required fields are missing", () => {
    expect(() =>
      toUploadEvent({
        type: "item:completed",
        sessionId: "s1",
      }),
    ).toThrow("Missing clientItemId");
  });

  it("maps upload:resume-all-complete with numeric fallbacks", () => {
    const event = toUploadEvent({
      type: "upload:resume-all-complete",
    });

    expect(event).toEqual({
      type: "upload:resume-all-complete",
      payload: {
        totalPending: 0,
        resumed: 0,
        failed: 0,
      },
    });
  });

  it("maps session:failed with fallback upload error", () => {
    const event = toUploadEvent({
      type: "session:failed",
      sessionId: "s1",
    });

    expect(event).toEqual({
      type: "session:failed",
      sessionId: "s1",
      error: {
        code: "E_UNKNOWN",
        message: "Unknown error",
      },
    });
  });

  it("maps auth:required with empty pendingSessions fallback", () => {
    const event = toUploadEvent({
      type: "auth:required",
    });

    expect(event).toEqual({
      type: "auth:required",
      sessionId: undefined,
      pendingSessions: [],
    });
  });

  it("throws when state-change is missing newState", () => {
    expect(() =>
      toUploadEvent({
        type: "upload:state-change",
        sessionId: "s1",
        oldState: "PAUSED",
      }),
    ).toThrow("Missing newState");
  });
});
