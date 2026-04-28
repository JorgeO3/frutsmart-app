import * as MathUtils from "./mathUtils";

function __findBestClassificationPrediction(scores: Float32Array): {
  index: number;
  score: number;
} {
  let maxScore = Number.NEGATIVE_INFINITY;
  let bestIndex = -1;
  if (scores && scores.length > 0) {
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > maxScore) {
        maxScore = scores[i];
        bestIndex = i;
      }
    }
  }
  return { index: bestIndex, score: maxScore };
}

function _processClassificationOutput(
  rawOutput: Float32Array,
  labels: readonly string[],
): { label: string | null; confidence: number | null } {
  if (rawOutput.length !== labels.length) {
    throw new Error(
      `Discrepancia en el número de salidas del modelo de clasificación (${rawOutput.length}) y el número de etiquetas proporcionadas (${labels.length}). Verifique la configuración del modelo y las etiquetas.`,
    );
  }
  const bestPrediction = __findBestClassificationPrediction(rawOutput);
  if (bestPrediction.index === -1) {
    console.log(
      "ClassificationProcessor: No se pudo determinar la mejor predicción.",
    );
    return { label: null, confidence: null };
  }
  const confidenceValue = bestPrediction.score;
  return { label: labels[bestPrediction.index], confidence: confidenceValue };
}

// Exportaciones del módulo classificationProcessor
export { _processClassificationOutput as processClassificationOutput };
