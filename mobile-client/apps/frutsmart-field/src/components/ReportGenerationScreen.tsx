import React, { useState, useCallback } from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";

import * as Print from "expo-print";
import { Paths, File } from "expo-file-system/next";

// --- COMPONENTES DE LA APLICACIÓN ---
import AppLoader, { type AsyncResult, Ok, Err } from "@components/AppLoader";

import * as ChartGenerator from "@/native-modules/chart-generator"; // Importamos el módulo nativo

// --- SERVICIOS Y LÓGICA DE NEGOCIO ---
import { reportGeneratorService } from "@services/report-generator/reportGeneratorService";
import { loadReportAssets } from "@services/report-generator/assetLoader";
import { generateReportHtml } from "@services/report-generator/htmlTemplate";
import type { ReportData } from "@services/report-generator/types";

// --- Tipo para el resultado exitoso ---
type ReportGenerationResult = {
  pdfUri: string;
};

// ▼▼▼ 2. DEFINIMOS LA PALETA DE COLORES EN JAVASCRIPT ▼▼▼
const CHART_COLOR_PALETTE = [
  "#E84C16",
  "#0A4CA4",
  "#FCEA00",
  "#94C01B",
  "#006531",
  "#4271C3",
  "#00A099",
];

const ReportGenerationScreen = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const createReportTask = useCallback(async (): Promise<
    AsyncResult<ReportGenerationResult, Error>
  > => {
    try {
      const dateString = "2025-01-07";
      console.log(`Iniciando reporte para: ${dateString}`);

      // PASO 1: Obtener y transformar datos de resumen
      const summaryDto =
        await reportGeneratorService.fetchReportSummaryData(dateString);
      if (!summaryDto) {
        return Err(new Error("No se encontraron datos de resumen."));
      }
      const transformedData =
        reportGeneratorService.transformSummaryData(summaryDto);

      console.log("Datos de resumen transformados:", transformedData);

      // PASO 2: Crear configuraciones de gráficos y generarlos nativamente
      console.log("Creando configuraciones de gráficos...");
      const chartConfigs = reportGeneratorService.createChartConfigs(
        transformedData,
        CHART_COLOR_PALETTE,
      );

      const chartImageUriMap = new Map<string, string>();
      if (chartConfigs.length > 0) {
        console.log(`Generando ${chartConfigs.length} gráficos nativamente...`);
        // Llamamos al método `generatePieChart` de nuestro módulo para cada configuración
        const chartPromises = chartConfigs.map((config) =>
          ChartGenerator.generatePieChart(config),
        );
        const results = await Promise.allSettled(chartPromises);

        const failedCharts: string[] = [];
        results.forEach((result, index) => {
          const chartId = chartConfigs[index].id;
          if (result.status === "fulfilled") {
            chartImageUriMap.set(chartId, result.value);
          } else {
            console.error(
              `Falló la generación del gráfico ${chartId}:`,
              result.reason,
            );
            failedCharts.push(chartId);
          }
        });

        if (failedCharts.length > 0) {
          return Err(
            new Error(
              `No se pudieron generar los siguientes gráficos: ${failedCharts.join(", ")}`,
            ),
          );
        }
        console.log("Gráficos generados exitosamente.");
      }

      // PASO 3: Obtener datos restantes y assets en paralelo
      const [detailedBunches, assets] = await Promise.all([
        reportGeneratorService.fetchReportDetailData(dateString),
        loadReportAssets(),
      ]);

      // PASO 4: Ensamblar el objeto de datos final para el reporte
      const reportData: ReportData =
        reportGeneratorService.assembleFullReportData(
          transformedData,
          detailedBunches,
          chartImageUriMap,
        );

      // PASO 5: Generar HTML y PDF
      const html = generateReportHtml(reportData, assets);
      const { uri: pdfUri } = await Print.printToFileAsync({ html });
      console.log("PDF generado en:", pdfUri);

      const rawHtmlUri = `${Paths.cache.uri}raw-report-${Date.now()}.html`;
      console.log("Guardando HTML sin procesar en:", rawHtmlUri);
      const rawHtmlFile = new File(rawHtmlUri);
      rawHtmlFile.write(html);

      // Mover a una ubicación permanente
      const pdfFile = new File(pdfUri);
      const finalPdfFile = new File(
        Paths.document,
        `Reporte-${Date.now()}.pdf`,
      );
      pdfFile.move(finalPdfFile);

      return Ok({ pdfUri: finalPdfFile.uri });
    } catch (error) {
      console.error("Error en createReportTask:", error);
      return Err(
        error instanceof Error
          ? error
          : new Error("Ocurrió un error desconocido"),
      );
    }
  }, []);

  const handleTaskComplete = useCallback(
    async (result: ReportGenerationResult) => {
      setIsProcessing(false);
      Alert.alert("Éxito", `El reporte ha sido guardado en:\n${result.pdfUri}`);
    },
    [],
  );

  const handleTaskError = useCallback((error: Error) => {
    setIsProcessing(false);
    Alert.alert("Error", `No se pudo generar el reporte: ${error.message}`);
  }, []);

  return (
    <View style={styles.container}>
      {isProcessing ? (
        <AppLoader
          isReady={!isProcessing}
          fallbackTimeout={2033}
          asyncTask={createReportTask}
          onTaskError={handleTaskError}
          onTaskComplete={handleTaskComplete}
          loadingMessage="Generando su reporte, por favor espere..."
        />
      ) : (
        <View style={styles.content}>
          <Text style={styles.title}>Generador de Reportes</Text>
          <Button
            title="Generar Reporte del Día"
            onPress={() => setIsProcessing(true)}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
});

export default ReportGenerationScreen;
