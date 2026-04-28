import { useRouter } from "expo-router";

import AppLoader, { type AsyncResult, Ok } from "@components/AppLoader";
import AppView from "@components/AppView";

type AsyncTaskSuccess = string;
type AsyncTaskError = string;
type AsyncTaskResult = AsyncResult<AsyncTaskSuccess, AsyncTaskError>;

const LoginLoading = () => {
  const router = useRouter();

  const handleTaskComplete = (result: AsyncTaskSuccess) => {
    console.log("Login successful:", result);
    router.replace("/plant-work");
  };

  const handleTaskError = (error: AsyncTaskError) => {
    console.error("Error:", error);
  };

  const performAsyncTask = async (): Promise<AsyncTaskResult> => {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return Ok("Login successful");
  };

  return (
    <AppView legalTextColor="#000">
      <AppLoader
        isReady={true}
        fallbackTimeout={3000}
        asyncTask={performAsyncTask}
        onTaskError={handleTaskError}
        onTaskComplete={handleTaskComplete}
        loadingMessage="Cargando sesión..."
      />
    </AppView>
  );
};

export default LoginLoading;
