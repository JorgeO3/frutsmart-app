import { useState, useCallback } from "react";
import { Alert } from "react-native";
import * as Print from "expo-print";

import { reportGeneratorService } from "@services/report-generator/reportGeneratorV2";
import { fileDownloaderService } from "@services/file-downloader/fileDownloaderService";
import type { AvailableReport } from "@services/report-availability/types";
import type { ReportType } from "@services/report-generator/ReportStrategyFactory";

// El estado de generación puede ser un ID de reporte o una clave genérica
type GeneratingState = string | null;

/**
 * Hook para gestionar la generación y descarga de reportes en PDF.
 * Encapsula el estado de carga y la interacción con los servicios.
 */
export const usePDFGenerator = () => {
  const [isGenerating, setIsGenerating] = useState<GeneratingState>(null);

  /**
   * Genera un reporte detallado para un solo racimo y lo descarga.
   * @param report El objeto de reporte disponible que contiene el ID y la fecha.
   */
  const generateAndDownloadDetailReport = useCallback(
    async (report: AvailableReport) => {
      if (isGenerating) return; // Evita ejecuciones múltiples
      setIsGenerating(report.id);

      try {
        console.log(`[PDF] Iniciando generación para reporte individual: ${report.reportId}`);

        // CAMBIO CLAVE: Pasamos el ID específico del reporte.
        // Esto asume que la estrategia 'detail' usará este ID para buscar el
        // racimo correcto, en lugar de solo el último del día.
        const html = await reportGeneratorService.generateReport("detail", {
          reportDate: report.reportDate,
        });

        const { uri } = await Print.printToFileAsync({ html });

        const fileName = `Reporte_Detalle_${report.reportId}.pdf`;
        const success = await fileDownloaderService.downloadToDownloadsFolder(
          uri,
          fileName,
        );

        if (success) {
          Alert.alert("Éxito", `El reporte "${fileName}" se ha guardado en tu dispositivo.`);
        }
      } catch (error) {
        console.error("Error generando o descargando el reporte individual:", error);
        Alert.alert("Error", `No se pudo generar el reporte: ${report.reportId}`);
      } finally {
        setIsGenerating(null);
      }
    },
    [isGenerating],
  );

  /**
   * Genera un reporte de resumen para una fecha dada y lo descarga a la carpeta
   * de Descargas del dispositivo (en Android).
   * @param reportDate La fecha para el reporte en formato YYYY-MM-DD.
   * @param reportType El tipo de reporte a generar ('summary' o 'detail').
   */
  const generateAndDownloadSummaryReport = useCallback(
    async (reportDate: string, reportType: ReportType = 'summary') => {
      if (isGenerating) return;
      // Usamos una clave genérica para el estado de carga del resumen
      setIsGenerating("summary_download");

      try {
        console.log(`[PDF] Iniciando generación de resumen para fecha: ${reportDate}`);
        const html = await reportGeneratorService.generateReport(reportType, {
          reportDate,
        });
        const { uri } = await Print.printToFileAsync({ html });

        const fileName = `Reporte_Resumen_${reportDate}.pdf`;
        const success = await fileDownloaderService.downloadToDownloadsFolder(
          uri,
          fileName,
        );

        if (success) {
          Alert.alert("Éxito", `El reporte se ha guardado como "${fileName}" en tu dispositivo.`);
        }

      } catch (error) {
        // El servicio de descarga ya muestra una alerta, solo logueamos.
        console.error("Error en el proceso de descarga del resumen:", error);
      } finally {
        setIsGenerating(null);
      }
    },
    [isGenerating],
  );

  return {
    isGenerating,
    generateAndDownloadDetailReport,
    generateAndDownloadSummaryReport,
  };
};
