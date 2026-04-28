import { registerTask, type Step } from "@src/minikit/core/JobRuntime";
import { collectMetadata } from "@src/minikit/sensors/SafeMetadata";

registerTask({
  type: "selection-overview",
  steps: [
    {
      name: "metadata",
      run: async () => ({ metadata: await collectMetadata() }),
      retry: { max: 2, baseMs: 150, maxElapsedMs: 2000 },
    },
  ],
});
