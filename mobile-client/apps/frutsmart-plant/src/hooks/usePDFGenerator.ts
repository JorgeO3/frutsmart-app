import * as Print from "expo-print";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { fileDownloaderService } from "@services/file-downloader/fileDownloaderService";
import type { ReportType } from "@services/report-generator/ReportStrategyFactory";
import { reportGeneratorService } from "@services/report-generator/reportGenerator";

// El estado de generación puede ser un ID de reporte o una clave genérica
type GeneratingState = string | null;

/**
 * Hook para gestionar la generación y descarga de reportes en PDF.
 * Encapsula el estado de carga y la interacción con los servicios.
 */
export const usePDFGenerator = () => {
  const [isGenerating, setIsGenerating] = useState<GeneratingState>(null);

  /**
   * Genera un reporte de resumen para una fecha dada y lo descarga a la carpeta
   * de Descargas del dispositivo (en Android).
   * @param reportDate La fecha para el reporte en formato YYYY-MM-DD.
   * @param reportType El tipo de reporte a generar ('summary' o 'detail').
   */
  const generateAndDownloadPlantReport = useCallback(
    async (
      reportDate: string,
      analysisId: string,
      reportType: ReportType = "plant",
    ) => {
      if (isGenerating) return;
      // Usamos una clave genérica para el estado de carga del resumen
      setIsGenerating("summary_download");

      try {
        console.log(
          `[PDF] Iniciando generación de resumen para fecha: ${reportDate}`,
        );
        const html = await reportGeneratorService.generateReport(reportType, {
          analysisId,
          reportDate,
        });
        const { uri } = await Print.printToFileAsync({ html });

        const fileName = `Reporte_Resumen_${reportDate}.pdf`;
        const success = await fileDownloaderService.downloadToDownloadsFolder(
          uri,
          fileName,
        );

        if (success) {
          Alert.alert(
            "Éxito",
            `El reporte se ha guardado como "${fileName}" en tu dispositivo.`,
          );
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
    generateAndDownloadPlantReport,
  };
};
