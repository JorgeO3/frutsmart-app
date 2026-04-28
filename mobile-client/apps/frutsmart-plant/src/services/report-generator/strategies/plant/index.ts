import { database } from "@adapters/repository/Database";
import type { ReportData } from "@adapters/repository/types";
import * as FileSystem from "expo-file-system/legacy";
import { loadReportAssets } from "../../assetLoader";
import { createDocumentShell } from "../../htmlTemplate";
import type { IReportStrategy, ReportParams } from "../IReportStrategy";
import {
  createBunchDetailsSection,
  createSummariesSection,
} from "./plantReportComponents"; // Importamos los nuevos helpers

export class PlantDetailReportStrategy implements IReportStrategy {
  public async execute(params: ReportParams): Promise<string> {
    if (!params.analysisId) {
      throw new Error("El ID del análisis es requerido para este reporte.");
    }

    // 1. Obtener todos los datos crudos de la base de datos.
    const rawReportData = await database.reportQueries.getFullDetailForReport(
      params.analysisId,
    );

    console.log({ rawReportData });

    if (!rawReportData) {
      throw new Error(
        `No se encontraron datos para el análisis: ${params.analysisId}`,
      );
    }

    // 2. Preparar los datos: convertir todas las URIs de imágenes a 'content://'.
    const reportData = await this._prepareDataWithContentUris(rawReportData);

    // 3. Construir el cuerpo del HTML usando los helpers.
    const reportBodyHtml = this._buildHtmlBody(reportData);

    // 4. Cargar assets y envolver el cuerpo en la plantilla principal.
    const assets = await loadReportAssets();
    const creationDate = new Date(reportData.creation_timestamp);

    const finalHtml = createDocumentShell(reportBodyHtml, assets, {
      date: creationDate.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: creationDate.toLocaleTimeString("es-CO"),
      location:
        reportData.program?.name ||
        `${reportData.vendor} / ${reportData.sub_vendor}` ||
        "N/A",
    });

    return finalHtml;
  }

  /**
   * Convierte todas las URIs de imágenes de 'file://' a 'content://' para que
   * expo-print pueda renderizarlas.
   */
  private async _prepareDataWithContentUris(
    data: ReportData,
  ): Promise<ReportData> {
    const processedIterations = await Promise.all(
      data.iterations.map(async (iter) => {
        const internalUri = iter.internal_photo_uri
          ? await FileSystem.getContentUriAsync(iter.internal_photo_uri)
          : null;

        const externalUris = await Promise.all(
          iter.external_photo_uris.map((uri) =>
            FileSystem.getContentUriAsync(uri),
          ),
        );

        return {
          ...iter,
          internal_photo_uri: internalUri,
          external_photo_uris: externalUris,
        };
      }),
    );
    return { ...data, iterations: processedIterations };
  }

  private _buildHtmlBody(data: ReportData): string {
    const totalSummaryHtml = createSummariesSection(
      JSON.parse(data.external_summary_json || "{}"),
      JSON.parse(data.internal_summary_json || "{}"),
      {
        rb: data.criteria_rb,
        rv: data.criteria_rv,
        rsm: data.criteria_rsm,
        rmf: data.criteria_rmf,
        rpl: data.criteria_rpl,
        pas: data.criteria_pas,
        vac: data.criteria_vac,
      },
    );

    const detailSections = createBunchDetailsSection(data);

    return `
      <section class="report-block mb-6">
        <div class="report-block__header">
          <h1>Resumen General de la Jornada</h1>
          <div class="divider"></div>
        </div>
        <div class="report-block__body">
          ${totalSummaryHtml}
        </div>
      </section>

      <section class="report-block">
        <div class="report-block__header flex flex-col items-center">
          <h1 class="leading-none mb-0">Resumen Detallado</h1>
          <div class="divider"></div>
          <p class="text-md text-center leading-none">
            A continuación, encuentre los detalles de las capturas de
            fotografía realizadas en las tareas de campo.
          </p>
        </div>
        <div class="report-block__body">
          ${detailSections}
        </div>
      </section>
    `;
  }
}
