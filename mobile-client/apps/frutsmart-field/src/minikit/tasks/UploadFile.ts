import * as FileSystem from "expo-file-system";

import { registerTask, type Step } from "@src/minikit/core/JobRuntime";
import { readJson, writeJson, ptr } from "@src/minikit/state/ManifestStore";
import type { UploadManifest } from "@src/minikit/state/models";
import { asRetryArgs, RETRY_NET } from "@src/minikit/core/RetryPolicies";
import { retry } from "@src/minikit/core/Retry";

// payload genérico — ajusta a tu backend
export type UploadPayload = {
  fileId: string;
  localPath: string;
  endpoint: string; // e.g. https://api.example.com/upload
  chunkSize?: number; // por defecto 5MB
};

const steps: Step[] = [
  {
    name: "ensure-session",
    requiresNetwork: true,
    retry: { max: 4, baseMs: 400, maxElapsedMs: 10000 },
    run: async (
      _ctx,
      { fileId, localPath, chunkSize = 5 * 1024 * 1024 }: UploadPayload,
    ) => {
      const info = await FileSystem.getInfoAsync(localPath);
      if (!info.exists) throw new Error(`Local file not found: ${localPath}`);
      const mptr = ptr(
        `${FileSystem.documentDirectory}manifests/upload/${fileId}.json`,
      );
      await FileSystem.makeDirectoryAsync(
        `${FileSystem.documentDirectory}manifests/upload/`,
        { intermediates: true },
      ).catch(() => {});

      let mf: UploadManifest;
      try {
        mf = await readJson<UploadManifest>(mptr);
      } catch {
        const size = info.size ?? 0;
        const parts: UploadManifest["parts"] = [];
        for (
          let offset = 0, index = 0;
          offset < size;
          offset += chunkSize, index++
        ) {
          const sz = Math.min(chunkSize, size - offset);
          parts.push({ index, offset, size: sz, etag: null });
        }
        mf = {
          version: 1,
          fileId,
          localPath,
          size,
          backend: "custom",
          sessionId: `${fileId}-${Date.now()}`,
          chunkSize,
          completedBytes: 0,
          parts,
          status: "pending",
        };
        await writeJson(mptr, mf);
      }
      return { mptrPath: mptr.path };
    },
  },
  {
    name: "upload-chunks",
    requiresNetwork: true,
    retry: { max: 8, baseMs: 500, maxDelayMs: 5000, maxElapsedMs: 240000 },
    run: async (ctx, { endpoint }: UploadPayload) => {
      const mf = await readJson<UploadManifest>({ path: ctx.mptrPath });
      for (const p of mf.parts) {
        if (p.etag) continue;
        // lee el chunk en base64 (alternativamente usa Blob si tu stack lo soporta)
        const chunk = await FileSystem.readAsStringAsync(mf.localPath, {
          encoding: FileSystem.EncodingType.Base64,
          position: p.offset,
          length: p.size,
        } as any);

        await retry(async () => {
          const res = await fetch(`${endpoint}`, {
            method: "PUT",
            headers: {
              "content-type": "application/octet-stream",
              "x-upload-session-id": mf.sessionId,
              "content-range": `bytes ${p.offset}-${p.offset + p.size - 1}/${mf.size}`,
            },
            body: Buffer.from(chunk, "base64"), // si no tienes Buffer, manda directamente el base64 con un content-type acorde
          } as any);
          if (!res.ok) throw new Error(`UPLOAD_${res.status}`);
          p.etag = res.headers.get("etag") ?? `${p.offset}:${p.size}`;
          mf.completedBytes += p.size;
          await writeJson({ path: ctx.mptrPath }, mf);
        }, asRetryArgs(RETRY_NET));
      }
      mf.status = "completed";
      await writeJson({ path: ctx.mptrPath }, mf);
    },
  },
  {
    name: "finalize",
    requiresNetwork: true,
    retry: { max: 3, baseMs: 600, maxElapsedMs: 20000 },
    run: async (ctx, { endpoint }: UploadPayload) => {
      const mf = await readJson<UploadManifest>({ path: ctx.mptrPath });
      const res = await fetch(`${endpoint}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: mf.sessionId,
          fileId: mf.fileId,
          parts: mf.parts,
        }),
      });
      if (!res.ok) throw new Error(`COMPLETE_${res.status}`);
    },
  },
];

registerTask({ type: "upload-file", steps, jobDeadlineMs: 5 * 60_000 });
