import * as FileSystem from "expo-file-system";

import { registerTask, type Step } from "@src/minikit/core/JobRuntime";
import { asRetryArgs, RETRY_FS } from "@src/minikit/core/RetryPolicies";
import { retry } from "@src/minikit/core/Retry";

async function cleanTmp() {
  await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}tmp/`, {
    idempotent: true,
  }).catch(() => {});
}

async function copyIdempotent(from: string, to: string) {
  try {
    await FileSystem.copyAsync({ from, to });
  } catch {}
}

const steps: Step[] = [
  {
    name: "cleanup-tmp",
    run: async () => {
      await retry(() => cleanTmp(), asRetryArgs(RETRY_FS));
    },
    retry: { max: 2, baseMs: 150, maxElapsedMs: 3000 },
  },
  {
    name: "copy-assets",
    run: async (
      _ctx,
      { assets }: { assets: Array<{ from: string; to: string }> },
    ) => {
      for (const a of assets) {
        await retry(() => copyIdempotent(a.from, a.to), asRetryArgs(RETRY_FS));
      }
    },
    retry: { max: 3, baseMs: 200, maxElapsedMs: 6000 },
  },
  {
    name: "init-nanort",
    run: async () => {
      const NativeNanoRT = (await import("@/modules/nano-rt/NanoRTModule"))
        .NativeNanoRT as any;
      if (NativeNanoRT.isReady?.()) return;
      await retry(() => NativeNanoRT.initializeModule(), {
        maxAttempts: 4,
        baseDelayMs: 250,
        maxDelayMs: 2000,
        maxElapsedMs: 12000,
        jitterRatio: 0.3,
        isTransient: (e) =>
          /I\/O|timeout|temporary|E_FS_IO/.test(
            String((e as any)?.message ?? e),
          ),
      });
    },
    retry: { max: 4, baseMs: 250, maxElapsedMs: 12000 },
  },
  {
    name: "mark-ready",
    run: async () => {
      const dir = `${FileSystem.documentDirectory}frutosmart_data/state/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
        () => {},
      );
      await FileSystem.writeAsStringAsync(
        `${dir}nanort.ready`,
        String(Date.now()),
      );
    },
  },
];

registerTask({ type: "warmup-nanort", steps, jobDeadlineMs: 25_000 });
