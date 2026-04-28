import * as FileSystem from "expo-file-system";

import { registerTask, type Step } from "@src/minikit/core/JobRuntime";
import { writeAtomicBase64 } from "@src/minikit/fs/FileOps";

// payload de ejemplo — adapta a tu compositor/pdf real
export type PdfPayload = {
  outPath: string; // destino final del PDF
  composeBase64: () => Promise<string>; // función que devuelve el PDF en base64
};

const steps: Step[] = [
  {
    name: "compose-pdf",
    retry: { max: 2, baseMs: 300, maxElapsedMs: 15000 },
    run: async (_ctx, { outPath, composeBase64 }: PdfPayload) => {
      await FileSystem.makeDirectoryAsync(
        outPath.slice(0, outPath.lastIndexOf("/")),
        { intermediates: true },
      ).catch(() => {});
      const b64 = await composeBase64();
      await writeAtomicBase64(outPath, b64);
    },
  },
];

registerTask({ type: "generate-pdf", steps, jobDeadlineMs: 30_000 });
