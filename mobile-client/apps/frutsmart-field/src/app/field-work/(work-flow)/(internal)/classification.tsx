import React, { useCallback } from "react";

import { useRouter } from "expo-router";

// --- State Management ---
import {
  useFieldWorkActions,
  useInternalSegments, // <-- Hook correcto para obtener los segmentos
  type ClassificationResult,
} from "@stores/fieldWork";

import AppLoader, { type AsyncResult, Ok, Err } from "@components/AppLoader";

// --- Type Definitions ---
type AsyncTaskError = Error;
type AsyncTaskSuccess = ClassificationResult["aiPrediction"];
type AsyncTaskResult = AsyncResult<AsyncTaskSuccess, AsyncTaskError>;

const ClassificationScreen = () => {
  const router = useRouter();

  // --- State Hooks ---
  const segments = useInternalSegments();
  const segment = segments[0]; // Obtener el primer segmento
  const { updateInternalResult } = useFieldWorkActions();

  const performAsyncTask = useCallback(async (): Promise<AsyncTaskResult> => {
    try {
      console.log("Iniciando cálculo de clasificación final...");

      const finalPrediction: ClassificationResult["aiPrediction"] = {
        className: segment.bestClassName || "Tipo A", // Usar la clase del segmento o un valor por defecto
        confidence: segment.bestConfidence || 0.95,
        rawInference: {},
      };

      updateInternalResult({ aiPrediction: finalPrediction });

      console.log("Resultado de la clasificación nativa:", finalPrediction);
      // 3. Forzamos una espera de 1 segundo para la animación
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return Ok(finalPrediction);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const error = new Error(`Error durante el cálculo: ${errorMessage}`);
      console.error("[Calculation Error]:", error);
      return Err(error);
    }
  }, [updateInternalResult, segment]);

  const handleTaskError = (error: AsyncTaskError) => {
    console.error("Error al procesar los resultados", error);
  };

  const handleTaskComplete = () => {
    console.log("Procesamiento y guardado en store completado.");
    router.replace("/field-work/(work-flow)/(internal)/classification-result");
  };

  return (
    <AppLoader
      fallbackTimeout={2033}
      isReady={true}
      asyncTask={performAsyncTask}
      onTaskError={handleTaskError}
      onTaskComplete={handleTaskComplete}
      loadingMessage="Clasificando racimo..."
    />
  );
};

export default ClassificationScreen;
