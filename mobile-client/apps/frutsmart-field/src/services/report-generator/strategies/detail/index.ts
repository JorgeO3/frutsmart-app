import * as FileSystem from "expo-file-system";
import { database } from "@adapters/repository/Database";

import type { BunchDetail, DetailReportData, Photo } from "./types";
import { loadReportAssets } from "../../assetLoader";
import { createDocumentShell } from "../../htmlTemplateV2";
import { createSingleBunchDetailSection } from "./DetailComponents";
import type { IReportStrategy, ReportParams } from "../IReportStrategy";

export class DetailReportStrategy implements IReportStrategy {
  public async execute(params: ReportParams): Promise<string> {
    if (!params.reportDate) {
      throw new Error(
        "La fecha del reporte es requerida para la estrategia de detalle.",
      );
    }

    // 1. Obtener y transformar los datos del último racimo.
    const reportData = await this.fetchAndBuildDetailData(params.reportDate);
    if (!reportData) {
      throw new Error(
        `No se encontró ningún racimo clasificado en la fecha: ${params.reportDate}`,
      );
    }

    // 2. Construir el cuerpo del HTML.
    const reportBodyHtml = this.buildHtmlBody(reportData);

    // 3. Cargar assets y crear el documento final.
    const assets = await loadReportAssets();
    const finalHtml = createDocumentShell(reportBodyHtml, assets, {
      date: reportData.reportDate,
      time: reportData.reportTime,
      location: reportData.location,
    });

    return finalHtml;
  }

  private async fetchAndBuildDetailData(
    date: string,
  ): Promise<DetailReportData | null> {
    const { reportQueries } = database;

    // Obtener solo el último racimo del día.
    const lastBunch = await reportQueries.getLastBunchDetail(date);
    if (!lastBunch) {
      return null; // No hay racimos ese día.
    }

    // Obtener datos relacionados para ese racimo.
    const [classificationResults, photos] = await Promise.all([
      reportQueries.getClassificationResultsByBunch(
        lastBunch.quality_classification_id,
      ),
      reportQueries.getPhotosByBunch(lastBunch.quality_classification_id),
    ]);

    // Procesar fotos para obtener content URIs si es necesario.
    const processedPhotos: Photo[] = await Promise.all(
      photos.map(async (photo) => ({
        uri:
          photo.photo_type === "cropped"
            ? await FileSystem.getContentUriAsync(photo.uri)
            : photo.uri,
        type: photo.classification_type,
        photoType: photo.photo_type,
      })),
    );

    const externalResult = classificationResults.find(
      (r) => r.classification_type === "external",
    );
    const internalResult = classificationResults.find(
      (r) => r.classification_type === "internal",
    );

    // Ensamblar el objeto BunchDetail.
    const bunchDetail: BunchDetail = {
      bunchNumber: 1, // Solo hay uno en este reporte
      qualityClassificationId: lastBunch.quality_classification_id,
      externalPhotos: processedPhotos.filter((p) => p.type === "external" && p.photoType === "cropped"),
      internalPhotos: processedPhotos.filter((p) => p.type === "internal" && p.photoType === "cropped"),
      details: [
        {
          concept: "Clasificación externa",
          value:
            externalResult?.human_feedback_corrected_class ||
            externalResult?.ai_predicted_class_name ||
            "N/A",
          observations: externalResult?.human_feedback_observation || "",
        },
        {
          concept: "Criterio de cosecha",
          value: lastBunch.harvest_assigned_criterion || "N/A",
          observations: lastBunch.harvest_observation || "",
        },
        {
          concept: "Clasificación interna",
          value:
            internalResult?.human_feedback_corrected_class ||
            internalResult?.ai_predicted_class_name ||
            "N/A",
          observations: internalResult?.human_feedback_observation || "",
        },
        { concept: "Lote", value: lastBunch.lot_name, observations: "" },
      ],
    };

    // Ensamblar el objeto principal para el reporte.
    return {
      reportDate: new Date(lastBunch.creation_timestamp).toLocaleDateString(),
      reportTime: new Date(lastBunch.creation_timestamp).toLocaleTimeString(),
      location: lastBunch.center_name,
      bunchDetail: bunchDetail,
    };
  }

  private buildHtmlBody(data: DetailReportData): string {
    const detailSectionHtml = createSingleBunchDetailSection(data.bunchDetail);

    return `
      <section class="report-block mb-6">
        <div class="report-block__header">
          <h1>Reporte Detallado de Racimo</h1>
          <div class="divider"></div>
        </div>
        <div class="report-block__body">
          ${detailSectionHtml}
        </div>
      </section>
    `;
  }
}
