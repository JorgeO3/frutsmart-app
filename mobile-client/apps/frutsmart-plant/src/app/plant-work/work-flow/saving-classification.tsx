import { useCallback } from "react";
import { Alert } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import { analysisPersistenceService } from "@services/persistence/analysisPersistenceService";
import { useSkyboltUploadContext } from "@src/providers/SkyboltUploadProvider";
import { useSessionId } from "@stores/appStore";
import { usePlantWorkActions, usePlantWorkStoreBase } from "@stores/plantWork";
import { useSelectionActions } from "@stores/qualitySelection";

import AppLoader, { type AsyncResult, Err, Ok } from "@components/AppLoader";
import AppView from "@components/AppView";

// --- Tipos para esta pantalla específica ---
type AsyncTaskError = Error;
type AsyncTaskSuccess = string;
type AsyncTaskResult = AsyncResult<AsyncTaskSuccess, AsyncTaskError>;

const SavingClassificationScreen = () => {
  const router = useRouter();
  const { enqueueUploadFromAnalysis } = useSkyboltUploadContext();

  const sessionId = useSessionId();
  const { reset } = usePlantWorkActions();
  const { clearAll } = useSelectionActions();
  const { download } = useLocalSearchParams<{ download: string }>();

  console.log("Rendering SavingClassificationScreen...");

  // 2. Se define la tarea asíncrona que se ejecutará.
  const performAsyncTask = useCallback(async (): Promise<AsyncTaskResult> => {
    try {
      if (!sessionId) {
        throw new Error(
          "No hay una sesión activa para guardar la clasificación.",
        );
      }

      const stateData = usePlantWorkStoreBase.getState();

      console.log("Clasificación a guardar");

      // Se llama al servicio de persistencia con todo el estado.
      const analysisId = await analysisPersistenceService.saveAnalysis(
        stateData,
        sessionId,
      );

      // Si tiene éxito, se devuelve el resultado con 'Ok'.
      return Ok(analysisId);
    } catch (e) {
      const error =
        e instanceof Error
          ? e
          : new Error("Ocurrió un error desconocido al guardar los datos.");
      console.error("Error en performAsyncTask (SavingScreen):", error);
      // Si falla, se devuelve el error con 'Err'.
      return Err(error);
    }
  }, [sessionId]); // La tarea depende del estado que va a guardar.

  // 3. Se define qué hacer si la tarea falla.
  const handleTaskError = (error: AsyncTaskError) => {
    console.error("Error guardando la clasificación:", error.message);
    // TODO: Navegar a una pantalla de error o mostrar una alerta al usuario.
    // Por ejemplo:
    Alert.alert(
      "Error",
      "No se pudo guardar la clasificación. Por favor, intente de nuevo.",
    );
    // router.back();
  };

  // 4. Se define qué hacer si la tarea se completa con éxito.
  const handleTaskComplete = (analysisId: AsyncTaskSuccess) => {
    console.log(`Clasificación guardada exitosamente con ID: ${analysisId}`);

    void enqueueUploadFromAnalysis(analysisId).catch((error) => {
      console.error("No se pudo encolar upload del analisis", {
        analysisId,
        error,
      });
    });

    // Limpia el estado del store para la próxima clasificación.
    if (download !== "true") {
      reset();
      clearAll();
    }

    // Navega a la pantalla final del flujo.
    router.replace({
      pathname:
        download === "true"
          ? "/plant-work/work-flow/report-generation"
          : "/plant-work",
      params: { analysisId },
    });
  };

  // 5. Se renderiza el componente AsyncProcessingScreen con toda la lógica.
  return (
    <AppView legalTextColor="#000">
      <AppLoader
        isReady={true}
        asyncTask={performAsyncTask}
        onTaskError={handleTaskError}
        onTaskComplete={handleTaskComplete}
        loadingMessage="Guardando clasificación..."
        fallbackTimeout={3000}
      />
    </AppView>
  );
};

export default SavingClassificationScreen;
