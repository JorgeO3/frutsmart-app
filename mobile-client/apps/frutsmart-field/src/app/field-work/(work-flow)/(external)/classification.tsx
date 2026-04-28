import React, { useCallback } from "react";
import { useRouter } from "expo-router";

// CAMBIO: Imports actualizados para el nuevo store y sus tipos
import {
  useFieldWorkActions,
  useExternalSegments, // <-- Hook correcto para obtener los segmentos
  type ClassifiedSegment,
} from "@stores/fieldWork";

import AppLoader, { type AsyncResult, Ok, Err } from "@components/AppLoader";
import AppView from "@/src/components/AppView";

// --- Lógica de Cálculo (Traducción de Kotlin a TypeScript) ---

const CLASE_A_FORMACION: Record<string, number> = {
  "clase 1": 0.95,
  clase1: 0.95,
  "clase 2": 0.795,
  clase2: 0.795,
  "clase 3": 0.595,
  clase3: 0.595,
  "clase 4": 0.4,
  clase4: 0.4,
};

const claseDesdePorcentaje = (p: number): string => {
  if (p >= 0.9) return "Clase 1";
  if (p >= 0.7) return "Clase 2";
  if (p >= 0.5) return "Clase 3";
  return "Clase 4";
};

// CAMBIO: La función ahora recibe un array de segmentos, no de "pasos"
const calcularClasificacionFinal = (segments: ClassifiedSegment[]) => {
  // Obtenemos la mejor clase de cada segmento acumulado
  const mejoresClases = segments.map((segment) => segment.bestClassName || "");

  const valores = mejoresClases.map((clase) => {
    const key = clase.trim().toLowerCase();
    return CLASE_A_FORMACION[key] ?? 0.4; // Fallback a 0.40 si no se encuentra
  });

  const promedio =
    valores.length > 0
      ? valores.reduce((a, b) => a + b, 0) / valores.length
      : 0.0;

  const claseFinal = claseDesdePorcentaje(promedio);

  return {
    className: claseFinal,
    confidence: promedio,
    rawInference: {
      details: "Resultado promediado de clasificaciones.",
      individualValues: valores,
    },
  };
};

// --- Type Definitions ---
type AsyncTaskError = Error;
type AsyncTaskSuccess = ReturnType<typeof calcularClasificacionFinal>;
type AsyncTaskResult = AsyncResult<AsyncTaskSuccess, AsyncTaskError>;

// --- Componente Principal ---
const ClassificationScreen = () => {
  const router = useRouter();

  // CAMBIO: Usamos los hooks correctos del store
  const segments = useExternalSegments();
  const { updateExternalResult } = useFieldWorkActions();

  // --- Lógica de la Tarea Asíncrona ---
  const performAsyncTask = useCallback(async (): Promise<AsyncTaskResult> => {
    try {
      console.log("Iniciando cálculo de clasificación final...");

      // 1. Ejecutamos el algoritmo con los segmentos del store
      const finalPrediction = calcularClasificacionFinal(segments);
      console.log("Cálculo completado:", finalPrediction);

      // 2. Guardamos el resultado en el store usando la acción correcta
      updateExternalResult({ aiPrediction: finalPrediction });

      // 3. Forzamos una espera de 1 segundo para la animación
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return Ok(finalPrediction);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const error = new Error(`Error durante el cálculo: ${errorMessage}`);
      console.error("[Calculation Error]:", error);
      return Err(error);
    }
  }, [segments, updateExternalResult]);

  // --- Handlers ---
  const handleTaskError = (error: AsyncTaskError) => {
    console.error("Error al procesar los resultados", error);
  };

  const handleTaskComplete = () => {
    console.log("Procesamiento y guardado en store completado.");
    router.replace("/field-work/(work-flow)/(external)/classification-result");
  };

  return (
    <AppView>
      <AppLoader
        isReady={true}
        asyncTask={performAsyncTask}
        onTaskError={handleTaskError}
        onTaskComplete={handleTaskComplete}
        loadingMessage="Calculando resultado final..."
      />
    </AppView>
  );
};

export default ClassificationScreen;
