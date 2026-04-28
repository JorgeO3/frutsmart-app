import { File } from 'expo-file-system/next';
import { decode as decodeJpeg } from 'jpeg-js';
import type { TensorflowModel } from 'react-native-fast-tflite';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// --- Tipos ---
type BoundingBox = [number, number, number, number]; // [x, y, width, height]

export interface Detection {
  box: BoundingBox;
  score: number;
  classId: number;
}

export interface PipelineResult {
  displayImageUri: string;
  classificationText: string;
  // Opcional: si quieres devolver más datos
  // rawClassificationOutput?: Float32Array; 
}

// --- Constantes de Configuración y Etiquetas ---
export const MODEL_CONFIGURATION = {
  DETECTION_INPUT_SIZE: 416,
  CLASSIFICATION_INPUT_SIZE: 224,
  GRID_CELLS_PER_DIMENSION: 13,
  ANCHOR_BOXES: [
    [0.573, 0.677],[1.87, 2.06],[3.34, 5.47],
    [7.88, 3.53],[9.77, 9.17],
  ] as const,
  IOU_SUPPRESSION_THRESHOLD: 0.6,
  MINIMUM_CONFIDENCE_THRESHOLD: 0.6,
  MAX_RESULTS_AFTER_NMS: 20,
  PREVIEW_IMAGE_SIZE: 256,
} as const;

export const CLASSIFICATION_LABELS = [
  "Clase1", "Clase2", "Clase3", "Clase4"
];

const SIGMOID_LOOKUP_TABLE = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const x = (i - 128) / 16;
  SIGMOID_LOOKUP_TABLE[i] = x > 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
}

// --- Funciones Auxiliares ---
const fastSigmoid = (x: number): number => {
  if (x < -8) return 0; if (x > 8) return 1;
  const idx = Math.floor((x + 8) * 16);
  if (idx >= 0 && idx < SIGMOID_LOOKUP_TABLE.length) return SIGMOID_LOOKUP_TABLE[idx];
  const absX = Math.abs(x); return 0.5 * (x / (1 + absX)) + 0.5;
};

const convertBoxToCorners = (b: BoundingBox): BoundingBox => [b[0], b[1], b[0] + b[2], b[1] + b[3]];

const calculateIoU = (boxA: BoundingBox, boxB: BoundingBox): number => {
  const [aX1, aY1, aX2, aY2] = convertBoxToCorners(boxA);
  const [bX1, bY1, bX2, bY2] = convertBoxToCorners(boxB);
  const iX1 = Math.max(aX1, bX1);
  const iY1 = Math.max(aY1, bY1);
  const iX2 = Math.min(aX2, bX2);
  const iY2 = Math.min(aY2, bY2);
  const iW = Math.max(0, iX2 - iX1);
  const iH = Math.max(0, iY2 - iY1);
  const iArea = iW * iH;
  const areaA = (aX2 - aX1) * (aY2 - aY1);
  const areaB = (bX2 - bX1) * (bY2 - bY1);
  const unionArea = areaA + areaB - iArea;
  return unionArea === 0 ? 0 : iArea / unionArea;
};

function applyNMS(detections: Detection[]): Detection[] {
  const sortedDets = [...detections].sort((a, b) => b.score - a.score);
  const finalDets: Detection[] = [];
  for (const currentDet of sortedDets) {
    if (MODEL_CONFIGURATION.MAX_RESULTS_AFTER_NMS > 0 && finalDets.length >= MODEL_CONFIGURATION.MAX_RESULTS_AFTER_NMS) break;
    let keep = true;
    for (const keptDet of finalDets) {
      if (currentDet.classId === keptDet.classId && calculateIoU(currentDet.box, keptDet.box) > MODEL_CONFIGURATION.IOU_SUPPRESSION_THRESHOLD) {
        keep = false; break;
      }
    }
    if (keep) finalDets.push(currentDet);
  }
  return finalDets;
}

// --- Interfaz de Opciones para el Pipeline ---
interface PipelineOptions {
  sourceImageUri: string;
  detectionModel: TensorflowModel; // Instancia del modelo de detección cargado
  classificationModel: TensorflowModel; // Instancia del modelo de clasificación cargado
  detectionInputBuffer: Float32Array;
  classificationInputBuffer: Float32Array;
}

// --- Función Principal del Pipeline ---
export async function processImageFullPipeline(
  options: PipelineOptions
): Promise<PipelineResult> { // Se asume que siempre devuelve un resultado, incluso si es de error
  const {
    sourceImageUri,
    detectionModel,
    classificationModel,
    detectionInputBuffer,
    classificationInputBuffer,
  } = options;

  console.time("Full Async Pipeline (models pre-loaded)");
  let resultClassificationText = "Iniciando...";
  let resultDisplayImageUri: string = sourceImageUri; // URI por defecto

  try {
    // PASO A: PREPROCESAMIENTO PARA DETECCIÓN
    console.time("Pipeline: A. Preprocessing for Detection");
    const detectionManipulatorCtx = ImageManipulator.manipulate(sourceImageUri);
    detectionManipulatorCtx.resize({
      width: MODEL_CONFIGURATION.DETECTION_INPUT_SIZE,
      height: MODEL_CONFIGURATION.DETECTION_INPUT_SIZE,
    });
    const renderedDetectionInputImageRef = await detectionManipulatorCtx.renderAsync();
    const detectionInputImage = await renderedDetectionInputImageRef.saveAsync({
      format: SaveFormat.JPEG, compress: 1,
    });
    resultDisplayImageUri = detectionInputImage.uri; // Imagen que se analizó para detección
    console.timeEnd("Pipeline: A. Preprocessing for Detection");

    console.time("Pipeline: A. JPEG Decode for Detection");
    const detectionImgFile = new File(detectionInputImage.uri);
    const detectionImgBytes = detectionImgFile.bytes();
    if (!detectionImgBytes) throw new Error("No se pudieron leer bytes (detección).");
    const { data: detectionRgbaPx } = decodeJpeg(detectionImgBytes, { useTArray: true });
    console.timeEnd("Pipeline: A. JPEG Decode for Detection");

    console.time("Pipeline: A. Detection Tensor Population");
    let detInputBufIdx = 0;
    for (let i = 0; i < detectionRgbaPx.length; i += 4) {
      detectionInputBuffer[detInputBufIdx++] = detectionRgbaPx[i + 0]; // R
      detectionInputBuffer[detInputBufIdx++] = detectionRgbaPx[i + 1]; // G
      detectionInputBuffer[detInputBufIdx++] = detectionRgbaPx[i + 2]; // B
    }
    console.timeEnd("Pipeline: A. Detection Tensor Population");

    // PASO B: INFERENCIA DEL MODELO DE DETECCIÓN
    console.time("Pipeline: B. Detection Model Inference");
    const detOutputMap = await detectionModel.run([detectionInputBuffer]);
    const rawDetectionOutput = detOutputMap[0] as Float32Array;
    console.timeEnd("Pipeline: B. Detection Model Inference");

    // PASO C: POST-PROCESAMIENTO DE DETECCIÓN Y NMS
    console.time("Pipeline: C. Detection Post-processing & NMS");
    const numDetClasses = rawDetectionOutput.length /
      (MODEL_CONFIGURATION.GRID_CELLS_PER_DIMENSION ** 2 * MODEL_CONFIGURATION.ANCHOR_BOXES.length) - 5;
    const attrsPerAnchorDet = 5 + numDetClasses;
    const potentialDetections: Detection[] = [];
    let rawDetReadIdx = 0;
    for (let gy = 0; gy < MODEL_CONFIGURATION.GRID_CELLS_PER_DIMENSION; ++gy) {
        for (let gx = 0; gx < MODEL_CONFIGURATION.GRID_CELLS_PER_DIMENSION; ++gx) {
          for (let anchorIdx = 0; anchorIdx < MODEL_CONFIGURATION.ANCHOR_BOXES.length; ++anchorIdx) {
            const anchor = MODEL_CONFIGURATION.ANCHOR_BOXES[anchorIdx];
            const dX = rawDetectionOutput[rawDetReadIdx + 0];
            const dY = rawDetectionOutput[rawDetReadIdx + 1];
            const dW = rawDetectionOutput[rawDetReadIdx + 2];
            const dH = rawDetectionOutput[rawDetReadIdx + 3];
            const objLogit = rawDetectionOutput[rawDetReadIdx + 4];
            rawDetReadIdx += attrsPerAnchorDet;
            const confScore = fastSigmoid(objLogit);
            if (confScore < MODEL_CONFIGURATION.MINIMUM_CONFIDENCE_THRESHOLD) continue;
            const boxCX = (fastSigmoid(dX) + gx) / MODEL_CONFIGURATION.GRID_CELLS_PER_DIMENSION;
            const boxCY = (fastSigmoid(dY) + gy) / MODEL_CONFIGURATION.GRID_CELLS_PER_DIMENSION;
            const boxW = (Math.exp(dW) * anchor[0]) / MODEL_CONFIGURATION.GRID_CELLS_PER_DIMENSION;
            const boxH = (Math.exp(dH) * anchor[1]) / MODEL_CONFIGURATION.GRID_CELLS_PER_DIMENSION;
            potentialDetections.push({
              box: [boxCX - boxW / 2, boxCY - boxH / 2, boxW, boxH],
              score: confScore, classId: 0,
            });
          }
        }
      }
    const finalDetections = applyNMS(potentialDetections);
    console.timeEnd("Pipeline: C. Detection Post-processing & NMS");
        
    if (finalDetections.length === 0) {
      console.log("Pipeline: No se encontraron objetos detectados.");
      resultClassificationText = "No se detectó ningún objeto para clasificar.";
      // resultDisplayImageUri ya es detectionInputImage.uri
    } else {
      // PASO D: RECORTAR Y REDIMENSIONAR MEJOR DETECCIÓN
      const bestDetection = finalDetections[0];
      const { box: bestDetectionBox } = bestDetection;
      const cropOriginX = bestDetectionBox[0] * MODEL_CONFIGURATION.DETECTION_INPUT_SIZE;
      const cropOriginY = bestDetectionBox[1] * MODEL_CONFIGURATION.DETECTION_INPUT_SIZE;
      const cropWidth = bestDetectionBox[2] * MODEL_CONFIGURATION.DETECTION_INPUT_SIZE;
      const cropHeight = bestDetectionBox[3] * MODEL_CONFIGURATION.DETECTION_INPUT_SIZE;
      const valOrgX = Math.max(0, Math.floor(cropOriginX));
      const valOrgY = Math.max(0, Math.floor(cropOriginY));
      const maxW = MODEL_CONFIGURATION.DETECTION_INPUT_SIZE - valOrgX;
      const maxH = MODEL_CONFIGURATION.DETECTION_INPUT_SIZE - valOrgY;
      const valW = Math.max(1, Math.min(Math.floor(cropWidth), maxW));
      const valH = Math.max(1, Math.min(Math.floor(cropHeight), maxH));

      let classificationInputImageUri: string | null = null;

      if (valW > 0 && valH > 0) {
        console.time("Pipeline: D. Crop & Resize for Classification");
        try {
          const cropRect = { originX: valOrgX, originY: valOrgY, width: valW, height: valH };
          const classificationCropCtx = ImageManipulator.manipulate(detectionInputImage.uri);
          classificationCropCtx.crop(cropRect)
                               .resize({ width: MODEL_CONFIGURATION.CLASSIFICATION_INPUT_SIZE, height: MODEL_CONFIGURATION.CLASSIFICATION_INPUT_SIZE });
          const renderedClsInputImgRef = await classificationCropCtx.renderAsync();
          const classificationInputSavedImg = await renderedClsInputImgRef.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
          
          classificationInputImageUri = classificationInputSavedImg.uri;
          resultDisplayImageUri = classificationInputSavedImg.uri; // Actualizar URI para mostrar
        } catch (error: unknown) {
          console.error("Pipeline: Error al recortar/redimensionar:", error);
          resultClassificationText = `Error en recorte: ${error instanceof Error ? error.message : "Desconocido"}`;
          // resultDisplayImageUri se queda como detectionInputImage.uri
        } finally {
          console.timeEnd("Pipeline: D. Crop & Resize for Classification");
        }
      } else {
        console.warn("Pipeline: Dimensiones de recorte inválidas.");
        resultClassificationText = "Advertencia: Recorte inválido.";
        // resultDisplayImageUri se queda como detectionInputImage.uri
      }
      
      // PASO E: LÓGICA DEL MODELO DE CLASIFICACIÓN
      if (classificationInputImageUri) {
        console.time("Pipeline: E. Classification Full Step");
        try {
          console.time("Pipeline: E. JPEG Decode for Classification");
          const clsImgFile = new File(classificationInputImageUri);
          const clsImgBytes = clsImgFile.bytes();
          if (!clsImgBytes) throw new Error("No se pudieron leer bytes (clasificación).");
          const { data: clsRgbaPx } = decodeJpeg(clsImgBytes, { useTArray: true });
          console.timeEnd("Pipeline: E. JPEG Decode for Classification");

          console.time("Pipeline: E. Classification Tensor Population");
          let clsInputBufIdx = 0;
          for (let i = 0; i < clsRgbaPx.length; i += 4) {
            // ORDEN BGR y ¡¡NORMALIZACIÓN CRÍTICA!!
            classificationInputBuffer[clsInputBufIdx++] = clsRgbaPx[i + 2]; // B
            classificationInputBuffer[clsInputBufIdx++] = clsRgbaPx[i + 1]; // G
            classificationInputBuffer[clsInputBufIdx++] = clsRgbaPx[i + 0]; // R
          }
          console.timeEnd("Pipeline: E. Classification Tensor Population");

          console.time("Pipeline: E. Classification Inference");
          const clsOutputMap = await classificationModel.run([classificationInputBuffer]);
          const rawClsOutput = clsOutputMap[0] as Float32Array;
          console.timeEnd("Pipeline: E. Classification Inference");

          // POST-PROCESAMIENTO DE CLASIFICACIÓN
          if (rawClsOutput?.length === CLASSIFICATION_LABELS.length) {
            let highestProb = Number.NEGATIVE_INFINITY; let predIdx = -1;
            for (let i = 0; i < rawClsOutput.length; i++) {
              if (rawClsOutput[i] > highestProb) { highestProb = rawClsOutput[i]; predIdx = i; }
            }
            if (predIdx !== -1) {
              const predLabel = CLASSIFICATION_LABELS[predIdx];
              // Asumir que highestProb es un score/logit; aplicar sigmoide si es apropiado o usar directamente si es probabilidad
              const conf = (fastSigmoid(highestProb) * 100).toFixed(2); 
              resultClassificationText = `Predicción: ${predLabel} (${conf}%)`;
            } else resultClassificationText = "No se pudo determinar predicción.";
          } else {
            resultClassificationText = "Error: Salida de clasificación inconsistente.";
          }
        } catch (clsError) {
          console.error("Pipeline: Error en pipeline de clasificación:", clsError);
          resultClassificationText = `Error en clasificación: ${clsError instanceof Error ? clsError.message : String(clsError)}`;
        } finally {
          console.timeEnd("Pipeline: E. Classification Full Step");
        }
      } else if (resultClassificationText === "Iniciando...") { 
        // Si el recorte falló y no se actualizó el texto de clasificación antes
        resultClassificationText = "No se pudo preparar imagen para clasificación.";
      }
    }

  } catch (pipelineError) {
    console.error("Pipeline: Error general:", pipelineError);
    resultClassificationText = `Error en pipeline: ${pipelineError instanceof Error ? pipelineError.message : "Desconocido"}`;
    if (!resultDisplayImageUri) resultDisplayImageUri = sourceImageUri; // Fallback a la original
  }

  console.timeEnd("Full Async Pipeline (models pre-loaded)");
  return { displayImageUri: resultDisplayImageUri, classificationText: resultClassificationText };
}