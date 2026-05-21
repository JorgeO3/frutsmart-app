import { useCallback } from "react";

import { useRouter } from "expo-router";

import AppLoader, { type AsyncResult, Ok } from "@components/AppLoader";

type AsyncTaskError = Error;
type AsyncTaskSuccess = string;
type AsyncTaskResult = AsyncResult<AsyncTaskSuccess, AsyncTaskError>;

const ClassificationScreen = () => {
  const router = useRouter();

  const performAsyncTask = useCallback(async (): Promise<AsyncTaskResult> => {
    const twoSeconds = 2 * 1000;
    await new Promise((resolve) => setTimeout(resolve, twoSeconds));
    return Ok("Clasificación completada");
  }, []);

  const handleTaskError = (error: AsyncTaskError) => {
    console.error("Error durante el procesamiento", error);
  };

  const handleTaskComplete = (_data: AsyncTaskSuccess) => {
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