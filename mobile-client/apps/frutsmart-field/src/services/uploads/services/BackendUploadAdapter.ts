/**
 * Upload System v2 — Backend Upload Adapter
 *
 * Encapsula todas las llamadas HTTP al backend NestJS.
 * No conoce la máquina de estados; solo ejecuta operaciones y retorna resultados.
 */

import { apiBaseUrl } from "@src/config/authConfig";
import { getValidAccessToken } from "../../auth/authService";
import { UploadApiError } from "../types";
import type { UploadDomain } from "../types";

// ---------------------------------------------------------------------------
// Tipos de entrada/salida
// ---------------------------------------------------------------------------

export interface CreateSessionInput {
  domain: UploadDomain;
  clientBatchId: string;
  qualityAnalysisId: string;
  files: AnalysisUploadFile[];
}

export interface AnalysisUploadFile {
  clientItemId: string;
  localUri: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  md5: string;
}

export interface CreateSessionOutput {
  sessionId: string;
  items: Array<{ clientItemId: string; blobName: string }>;
}

export interface PreparedSkyboltItem {
  clientItemId: string;
  localUri: string;
  blobName: string;
  contentType: string;
  sizeBytes: number;
  md5Hex: string;
}

// ---------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------

async function postJson<T>(path: string, body: unknown, options?: { timeoutMs?: number }): Promise<T> {
  const token = await getValidAccessToken();
  const url = `${apiBaseUrl}/api/v1${path}`;
  const payloadStr = JSON.stringify(body);
  const timeoutMs = options?.timeoutMs ?? 15_000;

  const maxRetries = 3;
  const retryableStatusCodes = new Set([429, 502, 503, 504]);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: payloadStr,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new UploadApiError(message, 0);
    }

    if (response.ok) {
      const text = await response.text();
      const payload = text ? safeJsonParse(text) : null;
      return payload as T;
    }

    // Not ok — check if we should retry
    if (attempt < maxRetries && retryableStatusCodes.has(response.status)) {
      const backoffMs = 1000 * 2 ** attempt; // 1s, 2s, 4s
      await delay(backoffMs);
      continue;
    }

    // Not retryable or out of retries
    const text = await response.text();
    const payload = text ? safeJsonParse(text) : null;
    const friendly =
      typeof payload === "object" && payload !== null
        ? ((payload as Record<string, unknown>).message as string) ?? response.statusText
        : response.statusText;
    throw new UploadApiError(`Upload backend ${response.status}: ${friendly}`, response.status);
  }

  // Should never reach here
  throw new UploadApiError("Unexpected retry exhaustion", 0);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------------------------------------------------------------------------
// Operaciones del backend
// ---------------------------------------------------------------------------

export async function createUploadSession(input: CreateSessionInput): Promise<CreateSessionOutput> {
  const body = {
    domain: input.domain,
    clientBatchId: input.clientBatchId,
    files: input.files.map((f) => ({
      clientItemId: f.clientItemId,
      fileName: f.fileName,
      fileSizeBytes: f.sizeBytes,
      contentType: f.contentType,
      md5: f.md5,
    })),
  };

  const response = await postJson<{
    sessionId: string;
    items?: Array<{ clientItemId: string; blobName: string }>;
  }>("/upload/sessions", body);

  console.log(`[DIAG] BackendUploadAdapter — createUploadSession OK sessionId=${response.sessionId} items=${(response.items ?? []).length}`);
  return {
    sessionId: response.sessionId,
    items: response.items ?? [],
  };
}

export async function completeUploadSession(sessionId: string): Promise<void> {
  console.log(`[DIAG] BackendUploadAdapter — completeUploadSession sessionId=${sessionId}`);
  await postJson(`/upload/sessions/${sessionId}/complete`, {
    verifyAndPromote: true,
    failOnIncomplete: false,
  });
}

export async function createEvaluation(input: {
  qualityAnalysisId: string;
  backendSessionId: string;
}): Promise<void> {
  // TODO: conectar con endpoint real cuando exista
  console.log("[BackendUploadAdapter] createEvaluation: stub", input);
}

// ---------------------------------------------------------------------------
// Helpers para preparar items Skybolt a partir del output del backend
// ---------------------------------------------------------------------------

export function prepareSkyboltItems(
  files: AnalysisUploadFile[],
  backendSessionId: string,
  backendItems: Array<{ clientItemId: string; blobName: string }>,
): PreparedSkyboltItem[] {
  const blobNameByClientItem = new Map(backendItems.map((i) => [i.clientItemId, i.blobName]));

  return files.map((file) => ({
    clientItemId: file.clientItemId,
    localUri: file.localUri,
    blobName: blobNameByClientItem.get(file.clientItemId) ?? `uploads/${backendSessionId}/${file.fileName}`,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    md5Hex: file.md5,
  }));
}
