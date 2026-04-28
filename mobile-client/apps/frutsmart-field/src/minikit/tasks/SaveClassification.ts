import * as FileSystem from "expo-file-system";

import { registerTask, type Step } from "@src/minikit/core/JobRuntime";
import { ensureDir, promoteDir } from "@src/minikit/fs/DirManager";
import { writeJson, readJson, ptr } from "@src/minikit/state/ManifestStore";
import { cropAndWebp } from "@src/minikit/img/ImageOps";
import {
  asRetryArgs,
  RETRY_FS,
  RETRY_DB,
} from "@src/minikit/core/RetryPolicies";
import { retry } from "@src/minikit/core/Retry";
import type { AnalysisManifest } from "@src/minikit/state/models";

// payload esperado (ajusta a tu modelo real)
type SavePayload = {
  classificationId: string;
  baseDir: string; // `${FileSystem.documentDirectory}frutosmart_data/`
  sessionId: string;
  data: any; // FieldWorkState
  dbSave: (payload: any) => Promise<void>; // inyecta tu repo/tx sqlite
};

const steps: Step[] = [
  {
    name: "prepare-staging",
    run: async (_ctx, { classificationId, baseDir }: SavePayload) => {
      const staging = `${baseDir}images/_staging/${classificationId}/`;
      const final = `${baseDir}images/${classificationId}/`;
      await ensureDir(staging);
      const mptr = ptr(`${baseDir}manifests/analysis/${classificationId}.json`);
      await ensureDir(`${baseDir}manifests/analysis/`);
      const man: AnalysisManifest = {
        version: 1,
        analysisId: classificationId,
        stagingDir: staging,
        finalDir: final,
        db: { status: "pending" },
        files: [],
      };
      await writeJson(mptr, man);
      return { mptrPath: mptr.path, staging, final };
    },
  },
  {
    name: "process-images",
    retry: { max: 3, baseMs: 250, maxElapsedMs: 12000 },
    run: async (ctx, { data }: SavePayload) => {
      const man = await readJson<AnalysisManifest>({ path: ctx.mptrPath });
      // ejemplo: procesa 1 imagen; extiéndelo a tu lista real (raw/segmented/cropped)
      const seg0 = data?.externalClassification?.segments?.[0];
      if (seg0?.rawUri) {
        const out = `${ctx.staging}external_cropped_0.webp`;
        await retry(
          () => cropAndWebp(seg0.rawUri, out, 300, 300, 0.8),
          asRetryArgs(RETRY_FS),
        );
        man.files.push({
          rel: `external_cropped_0.webp`,
          kind: "cropped",
          status: "staged",
        });
        await writeJson({ path: ctx.mptrPath }, man);
      }
    },
  },
  {
    name: "commit-db",
    retry: { max: 5, baseMs: 200, maxElapsedMs: 8000 },
    run: async (
      ctx,
      { dbSave, classificationId, sessionId, data }: SavePayload,
    ) => {
      await retry(
        () => dbSave({ classificationId, sessionId, data }),
        asRetryArgs(RETRY_DB),
      );
      const man = await readJson<AnalysisManifest>({ path: ctx.mptrPath });
      man.db.status = "committed";
      await writeJson({ path: ctx.mptrPath }, man);
    },
  },
  {
    name: "promote",
    retry: { max: 3, baseMs: 300, maxElapsedMs: 5000 },
    run: async (ctx) => {
      const man = await readJson<AnalysisManifest>({ path: ctx.mptrPath });
      await ensureDir(man.finalDir);
      await promoteDir(man.stagingDir, man.finalDir);
      man.files = man.files.map((f) => ({ ...f, status: "promoted" }));
      await writeJson({ path: ctx.mptrPath }, man);
    },
  },
];

registerTask({ type: "save-classification", steps, jobDeadlineMs: 60_000 });
