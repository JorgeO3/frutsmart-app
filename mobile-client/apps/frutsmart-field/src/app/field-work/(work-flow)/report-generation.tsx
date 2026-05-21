import React, { useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";

// --- Componente reutilizable ---
import AppLoader, { type AsyncResult, Ok, Err } from "@components/AppLoader";

// --- Servicios y Estrategias (CORREGIDO) ---
import { reportGeneratorService } from "@services/report-generator/reportGeneratorV2";
import AppView from "@/src/components/AppView";

// --- Tipos para esta pantalla ---
type AsyncTaskError = Error;
// La tarea, si tiene éxito, devuelve la URI del PDF generado.
type AsyncTaskSuccess = string;
type AsyncTaskResult = AsyncResult<AsyncTaskSuccess, AsyncTaskError>;

const ReportGenerationScreen = () => {
  const router = useRouter();

  // --- Tarea Asíncrona: Generar el Reporte ---
  const performAsyncTask = useCallback(async (): Promise<AsyncTaskResult> => {
    try {
      console.log("Iniciando la generación del reporte detallado...");

      // 1. Obtener la fecha actual en formato YYYY-MM-DD.
      const reportDate = new Date().toISOString().split("T")[0];

      // 2. Ejecutar la estrategia a través del servicio generador.
      const htmlContent = await reportGeneratorService.generateReport(
        "detail",
        { reportDate },
      );

      await FileSystem.writeAsStringAsync(
        `${FileSystem.cacheDirectory}report.html`,
        htmlContent,
      );

      // 3. Convertir el HTML a un archivo PDF.
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      console.log("PDF generado exitosamente en la URI temporal:", uri);

      // 4. Devolver la URI del PDF como resultado exitoso.
      return Ok(uri);
    } catch (e) {
      const error =
        e instanceof Error
          ? e
          : new Error("Ocurrió un error desconocido al generar el reporte.");
      console.error("Error en performAsyncTask (ReportGeneration):", error);
      return Err(error);
    }
  }, []);

  // --- Handlers para el resultado de la tarea ---
  const handleTaskError = useCallback(
    (error: AsyncTaskError) => {
      console.error("Error generando el reporte:", error.message);
      Alert.alert("Error", `No se pudo generar el reporte: ${error.message}`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    [router],
  );

  const handleTaskComplete = useCallback(
    (pdfUri: AsyncTaskSuccess) => {
      console.log(
        `Reporte generado. Navegando a la pantalla de resultados con la URI: ${pdfUri}`,
      );
      // Navega a la siguiente pantalla, pasando la URI del PDF para que pueda ser mostrado.
      router.replace({
        pathname: "/field-work/(work-flow)/report-generation-results",
        params: { pdfUri },
      });
    },
    [router],
  );

  return (
    <AppView legalTextColor="#000">
      <AppLoader
        isReady={true} // La pantalla está lista para ejecutarse de inmediato.
        fallbackTimeout={3000} // Damos un timeout más largo por si la consulta a la DB es lenta.
        asyncTask={performAsyncTask}
        onTaskError={handleTaskError}
        onTaskComplete={handleTaskComplete}
        loadingMessage="Generando reporte..."
      />
    </AppView>
  );
};

export default ReportGenerationScreen;
