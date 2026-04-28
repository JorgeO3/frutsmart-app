import type {
  ClassificationPipelineOutput,
  ClassificationPipelineOptions,
} from "./types";
import * as ImgProcessor from "./imageProcessor";

export async function runClassificationPipeline(
  options: ClassificationPipelineOptions,
): Promise<ClassificationPipelineOutput> {
  const { imgUri, model, inputBuffer, config } = options;

  const { pixelBuffer } = await ImgProcessor.preprocessImage(imgUri, {
    targetSize: config.inputSize,
    isBgr: config.isBgr,
  });
  inputBuffer.set(pixelBuffer);

  const rawOutputs = model.runSync([inputBuffer]);
  const outputBuffer = rawOutputs?.[0] as Float32Array | null;

  if (!outputBuffer) {
    console.log(
      "runClassificationPipeline: No hubo salida del modelo de clasificación.",
    );
  }

  console.log(rawOutputs);

  // --- KEY CORRECTION ---
  // A COPY of the output buffer is created here to ensure that the function
  // always returns a new and independent result, avoiding shared reference
  // bugs in the calling code.
  const copiedOutput = outputBuffer ? new Float32Array(outputBuffer) : null;

  return { output: copiedOutput };
}
