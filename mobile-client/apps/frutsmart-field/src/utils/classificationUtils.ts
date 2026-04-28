/**
 * Representa el resultado de una única inferencia de clasificación.
 * Es la salida directa del modelo.
 */
interface ClassificationOutput {
  // CORRECCIÓN: El pipeline devuelve un Float32Array, no un array de arrays.
  output: Float32Array | null;
}

/**
 * Representa el resultado consolidado después de procesar
 * una o más inferencias de clasificación.
 */
export interface AggregatedClassificationResult {
  classifiedLabel: string;
  confidence: number;
}

/**
 * Representa el objeto de retorno completo, incluyendo tanto el resultado
 * agregado como las salidas brutas de cada inferencia.
 */
export interface ProcessedClassification {
  aggregated: AggregatedClassificationResult;
  rawOutputs: ClassificationOutput[];
}

/**
 * Procesa una lista de resultados de inferencia para determinar la clase final.
 *
 * Esta función implementa una estrategia de promediado de confianzas y ahora
 * devuelve un objeto completo con el resultado agregado y los datos brutos.
 *
 * @param results - Un array de objetos, cada uno con la salida del modelo.
 * @param labels - Un array de strings con las etiquetas de las clases.
 * @returns Un objeto que contiene el resultado agregado y los resultados brutos.
 */
export const processClassificationResults = (
  results: ClassificationOutput[],
  labels: readonly string[],
): ProcessedClassification => {
  console.log("--- INICIANDO PROCESO DE CLASIFICACIÓN ---");
  console.log("Resultados de entrada:", JSON.stringify(results, null, 2));
  console.log("Etiquetas de entrada:", labels);

  const aggregatedResult: AggregatedClassificationResult = {
    classifiedLabel: "Indeterminado",
    confidence: 0,
  };

  if (!results || results.length === 0) {
    console.error("Error: No se proporcionaron resultados para procesar.");
    return { aggregated: aggregatedResult, rawOutputs: results || [] };
  }

  const numClasses = labels.length;
  const confidenceSums = new Float32Array(numClasses).fill(0);
  let validResultsCount = 0;

  console.log(`Iniciando iteración sobre ${results.length} resultados...`);
  // Itera sobre cada resultado de inferencia.
  for (const [index, result] of results.entries()) {
    console.log(`\n[Resultado #${index + 1}]`);
    console.log("  > Objeto de resultado crudo:", result);

    // ---- LA CORRECCIÓN CLAVE ESTÁ AQUÍ ----
    // Se accede directamente a 'result.output' porque ya es el array de confianzas.
    const confidences = result?.output;
    console.log("  > Confianzas extraídas:", confidences);

    if (confidences && confidences.length === numClasses) {
      console.log("  > ¡Resultado válido! Sumando confianzas.");
      for (let i = 0; i < numClasses; i++) {
        confidenceSums[i] += confidences[i];
      }
      validResultsCount++;
    } else {
      console.warn(
        "  > ¡Resultado inválido! Omitiendo. Razón: El array de confianzas no existe o su longitud no coincide con el número de clases.",
      );
    }
  }

  console.log("\n--- FIN DE LA ITERACIÓN ---");
  console.log("Suma total de confianzas por clase:", confidenceSums);
  console.log("Número total de resultados válidos:", validResultsCount);

  if (validResultsCount === 0) {
    console.error("Error: No se encontraron resultados válidos para procesar.");
    return { aggregated: aggregatedResult, rawOutputs: results };
  }

  let maxConfidenceSum = -1;
  let bestClassIndex = -1;
  for (let i = 0; i < numClasses; i++) {
    if (confidenceSums[i] > maxConfidenceSum) {
      maxConfidenceSum = confidenceSums[i];
      bestClassIndex = i;
    }
  }

  console.log("\n--- CÁLCULO FINAL ---");
  console.log("Suma de confianza más alta:", maxConfidenceSum);
  console.log("Índice de la mejor clase:", bestClassIndex);

  if (bestClassIndex === -1) {
    console.error("Error: No se pudo determinar una mejor clase.");
    return { aggregated: aggregatedResult, rawOutputs: results };
  }

  const averageConfidence = maxConfidenceSum / validResultsCount;
  console.log("Confianza promedio (sin redondear):", averageConfidence);

  aggregatedResult.classifiedLabel = labels[bestClassIndex];
  aggregatedResult.confidence = Math.round(averageConfidence * 100) / 100;
  console.log("Resultado final agregado:", aggregatedResult);

  return {
    aggregated: aggregatedResult,
    rawOutputs: results,
  };
};
