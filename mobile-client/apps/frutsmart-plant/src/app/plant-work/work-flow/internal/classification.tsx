import { useCallback } from "react";

import { useRouter } from "expo-router";

// --- State Management ---

import AppLoader, { type AsyncResult, Ok } from "@components/AppLoader";

// import { useShortRT } from "@/modules/short-rt/src/ShortRTContext";
// import type { ClassificationResult } from "@/modules/short-rt/src/ShortRTModule";

// --- Type Definitions ---
type AsyncTaskError = Error;
type AsyncTaskSuccess = string;
type AsyncTaskResult = AsyncResult<AsyncTaskSuccess, AsyncTaskError>;

const ClassificationScreen = () => {
  const router = useRouter();

  const performAsyncTask = useCallback(async (): Promise<AsyncTaskResult> => {
    // const OneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    const twoSeconds = 2 * 1000; // 2 seconds in milliseconds
    await new Promise((resolve) => setTimeout(resolve, twoSeconds));

    return Ok("Clasificación completada");
  }, []);

  const handleTaskError = (error: AsyncTaskError) => {
    console.error("Error durante el procesamiento", error);
  };

  const handleTaskComplete = (_data: AsyncTaskSuccess) => {
    router.replace("/plant-work/work-flow/internal/classification-result");
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
