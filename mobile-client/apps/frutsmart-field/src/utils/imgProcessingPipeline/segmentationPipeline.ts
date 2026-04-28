import type {
  SegmentationPipelineOutput,
  SegmentationPipelineOptions,
} from "./types";

import * as ImageProcessor from "./imageProcessor";
import * as SegmentationDecoder from "./segmentationDecoder";
import * as SegmentationMaskHandler from "./segmentationMaskHandler";

/**
 * Ejecuta el pipeline de segmentación de imágenes.
 * @param options Opciones del pipeline, incluyendo la imagen fuente, modelo y configuración.
 * @returns Una promesa que resuelve a un objeto SegmentationPipelineOutput.
 * @throws Error si ocurren fallos críticos durante el preprocesamiento, inferencia,
 * o durante el procesamiento del único segmento detectado (enmascaramiento o recorte).
 */
export async function runSegmentationPipeline(
  options: SegmentationPipelineOptions,
): Promise<SegmentationPipelineOutput> {
  const { sourceImageUri, segmentationModel, segmentationInputBuffer, config } =
    options;

  if (!sourceImageUri) {
    throw new Error(
      "runSegmentationPipeline: URI de imagen fuente no proporcionada.",
    );
  }

  // 1. Preprocesamiento de la imagen (puede lanzar error)
  const { uri: processedImageUri, pixelBuffer } =
    await ImageProcessor.preprocessImage(
      sourceImageUri,
      { targetSize: config.inputSize }, // Asume RGB por defecto si config.isBgr no existe para segmentación
    );
  segmentationInputBuffer.set(pixelBuffer);

  // 2. Inferencia del modelo (puede lanzar error)
  const rawOutputs = await segmentationModel.run([segmentationInputBuffer]);
  if (!rawOutputs || rawOutputs.length < 2) {
    // El modelo YOLO de segmentación usualmente tiene 2 salidas
    throw new Error("Salida del modelo de segmentación inválida o incompleta.");
  }

  // 3. Decodificación de la salida del modelo
  const detectedSegmentsAfterNMS = SegmentationDecoder.decode(
    [rawOutputs[0] as Float32Array, rawOutputs[1] as Float32Array],
    config,
  );

  const segmentsFound = detectedSegmentsAfterNMS.length;
  let finalProcessedSegmentUri: string | null = null;

  // 4. Si se detectó exactamente UN segmento, intentar enmascararlo y recortarlo.
  if (segmentsFound === 1) {
    const bestSegment = detectedSegmentsAfterNMS[0]; // Ya vienen ordenados por score
    try {
      // Aplicar máscara (puede lanzar error)
      const maskedImageUri = await SegmentationMaskHandler.applyMask(
        bestSegment,
        processedImageUri, // Aplicar máscara sobre la imagen preprocesada
        config.maskWidth,
        config.maskHeight,
      );

      // Recortar el objeto de la imagen con máscara (puede lanzar error o devolver null)
      finalProcessedSegmentUri = await ImageProcessor.cropObjectFromSegment(
        maskedImageUri,
        bestSegment,
        config.inputSize, // Ancho de la imagen maskedImageUri
        config.inputSize, // Alto de la imagen maskedImageUri
      );
      // Si cropObjectFromSegment devuelve null, finalProcessedSegmentUri será null.
      // Esto es manejado por React Native (segmentsFound=1, processedSegmentUri=null).
    } catch (processingError) {
      // Si applyMask o cropObjectFromSegment (si lanza error) fallan.
      console.error(
        "runSegmentationPipeline: Error procesando el único segmento detectado:",
        processingError,
      );
      throw processingError; // Propagar el error para que React Native lo maneje.
    }
  } else if (segmentsFound > 1) {
    console.log(
      `runSegmentationPipeline: Múltiples segmentos (${segmentsFound}) detectados. No se procesará un único segmento individual.`,
    );
    // processedSegmentUri permanece null. React Native decidirá basado en segmentsFound > 1.
  } else {
    // segmentsFound === 0
    console.log("runSegmentationPipeline: No se detectaron segmentos.");
    // processedSegmentUri permanece null. React Native decidirá basado en segmentsFound === 0.
  }

  return {
    bestSegmentUri: finalProcessedSegmentUri,
    segmentsFound: segmentsFound,
  };
}