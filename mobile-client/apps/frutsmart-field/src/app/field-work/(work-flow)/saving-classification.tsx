import React, { useCallback } from "react";
import { View, ActivityIndicator } from "react-native";

import { useRouter } from "expo-router";

// --- Componente reutilizable para procesos asíncronos ---
import AppLoader, { type AsyncResult, Ok, Err } from "@components/AppLoader";
// --- Store y Servicios ---
import { useSessionId } from "@stores/appStore";
import { useFieldWorkData } from "@stores/fieldWork";
import { classificationPersistenceService } from "@services/persistence/classificationPersistenceService";
import { useSkyboltUploadContext } from "@src/providers/SkyboltUploadProvider";

import AppView from "@components/AppView";

// --- Tipos para esta pantalla específica ---
type AsyncTaskError = Error;
type AsyncTaskSuccess = string;
type AsyncTaskResult = AsyncResult<AsyncTaskSuccess, AsyncTaskError>;

const SavingClassificationScreen = () => {
  const router = useRouter();
  const sessionId = useSessionId();
  const { enqueueUploadFromAnalysis } = useSkyboltUploadContext();

  console.log("Rendering SavingClassificationScreen...");

  // 1. Se obtiene el estado completo y final de la clasificación desde el store.
  const stateData = useFieldWorkData();

  // 2. Se define la tarea asíncrona que se ejecutará.
  const performAsyncTask = useCallback(async (): Promise<AsyncTaskResult> => {
    try {
      if (!sessionId) {
        throw new Error(
          "No hay una sesión activa para guardar la clasificación.",
        );
      }

      console.log(
        "Clasificación a guardar:",
        JSON.stringify(stateData, null, 2),
      );

      // Se llama al servicio de persistencia con todo el estado.
      const classificationId =
        await classificationPersistenceService.saveClassification(
          stateData,
          sessionId,
        );

      // Si tiene éxito, se devuelve el resultado con 'Ok'.
      return Ok(classificationId);
    } catch (e) {
      const error =
        e instanceof Error
          ? e
          : new Error("Ocurrió un error desconocido al guardar los datos.");
      console.error("Error en performAsyncTask (SavingScreen):", error);
      // Si falla, se devuelve el error con 'Err'.
      return Err(error);
    }
  }, [stateData, sessionId]); // La tarea depende del estado que va a guardar.

  // 3. Se define qué hacer si la tarea falla.
  const handleTaskError = (error: AsyncTaskError) => {
    console.error("Error guardando la clasificación:", error.message);
    // TODO: Navegar a una pantalla de error o mostrar una alerta al usuario.
    // Por ejemplo:
    // Alert.alert("Error", "No se pudo guardar la clasificación. Por favor, intente de nuevo.");
    // router.back();
  };

  // 4. Se define qué hacer si la tarea se completa con éxito.
  const handleTaskComplete = (classificationId: AsyncTaskSuccess) => {
    console.log(
      `Clasificación guardada exitosamente con ID: ${classificationId}`,
    );

    void enqueueUploadFromAnalysis(classificationId).catch((error) => {
      console.error("No se pudo encolar upload de clasificación", {
        classificationId,
        error,
      });
    });

    // Navega a la pantalla final del flujo.
    router.replace("/field-work/(work-flow)/cluster-summary");
  };

  // Salvaguarda: si el estado aún no está listo, muestra un loader.
  if (!stateData) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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
