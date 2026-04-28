import { useCallback } from "react";

import { useRouter } from "expo-router";

// --- State Management ---

// --- UI Components ---
import AppLoader, { type AsyncResult, Ok } from "@components/AppLoader";

// --- Type Definitions ---
type AsyncTaskError = Error;
type AsyncTaskSuccess = string;
type AsyncTaskResult = AsyncResult<AsyncTaskSuccess, AsyncTaskError>;

const ClassificationScreen = () => {
  const router = useRouter();

  // --- Asynchronous Task Logic ---
  const performAsyncTask = useCallback(async (): Promise<AsyncTaskResult> => {
    const twoSeconds = 2 * 1000; // 2 seconds in milliseconds
    await new Promise((resolve) => setTimeout(resolve, twoSeconds));

    return Ok("Clasificación completada");
  }, []);

  // --- Callback Handlers ---
  const handleTaskError = (error: AsyncTaskError) => {
    console.error("Error durante el procesamiento", error);
    // Aquí se puede implementar una alerta para el usuario.
  };

  const handleTaskComplete = (_data: AsyncTaskSuccess) => {
    router.replace("/plant-work/work-flow/external/classification-result");
  };

  return (
    <AppLoader
      fallbackTimeout={2033}
      isReady={true}
      asyncTask={performAsyncTask}
      onTaskError={handleTaskError}
      onTaskComplete={handleTaskComplete}
      loadingMessage="Clasificando imágenes..."
    />
  );
};

export default ClassificationScreen;
