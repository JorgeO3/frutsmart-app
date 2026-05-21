import { PixelRatio } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

import ChartForge, { ChartConfig } from "chart-forge";

import { database } from "@adapters/repository/Database";

import type {
  SummaryReportData,
  ClassificationSection,
  HarvestCriteriaSection,
  BunchDetail,
} from "../../types";
import {
  createLotSummarySection,
  createBunchDetailSection,
  createTotalSummarySection,
} from "./summaryComponents";
import { groupBy } from "../../utils";
import { loadReportAssets } from "../../assetLoader";
import { createDocumentShell } from "../../htmlTemplateV2";
import type { IReportStrategy, ReportParams } from "../IReportStrategy";
import type { ClassificationPhotoRow } from "@adapters/repository/types";

const CHART_COLOR_PALETTE = [
  "#E84C16",
  "#0A4CA4",
  "#FCEA00",
  "#94C01B",
  "#006531",
];

interface assembleViewModelData {
  externalClassification: ClassificationSection;
  harvestCriteria: HarvestCriteriaSection;
  internalClassification: ClassificationSection;
}

export class SummaryReportStrategy implements IReportStrategy {
  public async execute(params: ReportParams): Promise<string> {
    if (!params.reportDate) {
      throw new Error(
        "La fecha del reporte es requerida para la estrategia de resumen.",
      );
    }

    // --- 1. OBTENER Y TRANSFORMAR DATOS ---
    const summaryData = await this.fetchAndTransformData(params.reportDate);

    // --- 2. GENERAR GRÁFICOS ---
    const chartImageMap = await this.generateCharts(summaryData);

    // --- 3. OBTENER DATOS DETALLADOS DE TODOS LOS RACIMOS DEL DIA ---
    const detailedBunches = await this.fetchReportDetailData(params.reportDate);

    // --- 3. ENSAMBLAR VISTA-MODELO FINAL ---
    const reportData = this.assembleViewModel(
      summaryData,
      detailedBunches,
      chartImageMap,
    );

    // --- 4. CONSTRUIR EL HTML ---
    const reportBodyHtml = this.buildHtmlBody(reportData);

    // --- 5. CARGAR ASSETS Y CREAR EL DOCUMENTO FINAL ---
    const assets = await loadReportAssets();
    const finalHtml = createDocumentShell(reportBodyHtml, assets, {
      date: params.reportDate,
      time: new Date().toLocaleTimeString(),
      location: "Finca X",
    });

    return finalHtml;
  }

  /**
   * 2. Obtiene los datos detallados de cada clasificación (racimo).
   */
  private async fetchReportDetailData(
    reportDate: string,
  ): Promise<BunchDetail[]> {
    const { reportQueries } = database;
    const bunches = await reportQueries.getBunchesDetail(reportDate);
    if (!bunches || bunches.length === 0) {
      return [];
    }

    const detailedBunches: BunchDetail[] = [];
    for (const [index, bunch] of bunches.entries()) {
      const [classificationResults, photos] = await Promise.all([
        reportQueries.getClassificationResultsByBunch(
          bunch.quality_classification_id,
        ),
        reportQueries.getPhotosByBunch(bunch.quality_classification_id),
      ]);

      const externalResult = classificationResults.find(
        (r) => r.classification_type === "external",
      );
      const internalResult = classificationResults.find(
        (r) => r.classification_type === "internal",
      );

      const newPhotos: ClassificationPhotoRow[] = [];
      for (const photo of photos) {
        if (photo.photo_type !== "cropped") {
          newPhotos.push(photo);
        } else {
          const contentPhotoUri = await FileSystem.getContentUriAsync(
            photo.uri,
          );
          newPhotos.push({
            ...photo,
            uri: contentPhotoUri,
          });
        }
      }

      detailedBunches.push({
        bunchNumber: index + 1,
        qualityClassificationId: bunch.quality_classification_id,
        externalPhotos: newPhotos
          .filter((p) => p.classification_type === "external" && p.photo_type !== "raw")
          .map((p) => ({
            uri: p.uri,
            type: "external",
            photoType: p.photo_type,
          })),
        internalPhotos: newPhotos
          .filter((p) => p.classification_type === "internal" && p.photo_type !== "raw")
          .map((p) => ({
            uri: p.uri,
            type: "internal",
            photoType: p.photo_type,
          })),
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
            value: bunch.harvest_assigned_criterion || "N/A",
            observations: bunch.harvest_observation || "",
          },
          {
            concept: "Clasificación interna",
            value:
              internalResult?.human_feedback_corrected_class ||
              internalResult?.ai_predicted_class_name ||
              "N/A",
            observations: internalResult?.human_feedback_observation || "",
          },
          { concept: "Lote", value: bunch.lot_name, observations: "" },
          { concept: "Centro", value: bunch.center_name, observations: "" },
          {
            concept: "Peso (kg)",
            value: bunch.harvest_cluster_weight?.toString() || "0",
            observations: "",
          },
          {
            concept: "Nº aplicaciones ANA",
            value: bunch.harvest_number_of_applications?.toString() || "0",
            observations: "",
          },
        ],
      });
    }

    return detailedBunches;
  }

  private async fetchAndTransformData(date: string) {
    const { reportQueries } = database;
    const [extTotal, extByLot, harvTotal, harvByLot, intTotal, intByLot] =
      await Promise.all([
        reportQueries.getExternalClassificationTotal(date),
        reportQueries.getExternalClassificationByLot(date),
        reportQueries.getHarvestCriteriaTotal(date),
        reportQueries.getHarvestCriteriaByLot(date),
        reportQueries.getInternalClassificationTotal(date),
        reportQueries.getInternalClassificationByLot(date),
      ]);

    const externalClassification: ClassificationSection = {
      title: "Resumen clasificación externa",
      totalSummary: extTotal.map((r) => ({
        className: r.class_name,
        count: r.count,
      })),
      lotSummaries: Object.values(groupBy(extByLot, "lot_id")).map((rows) => ({
        lotId: rows[0].lot_id,
        lotName: rows[0].lot_name,
        summary: rows.map((r) => ({ className: r.class_name, count: r.count })),
        chartImageUri: "", // Se llenará después
      })),
    };

    const harvestCriteria: HarvestCriteriaSection = {
      title: "Resumen criterios de cosecha",
      totalSummary: harvTotal.map((r) => ({
        criterion: r.criterion,
        count: r.count,
      })),
      lotSummaries: Object.values(groupBy(harvByLot, "lot_id")).map((rows) => ({
        lotId: rows[0].lot_id,
        lotName: rows[0].lot_name,
        summary: rows.map((r) => ({ criterion: r.criterion, count: r.count })),
        chartImageUri: "", // Se llenará después
      })),
    };

    const internalClassification: ClassificationSection = {
      title: "Resumen clasificación interna",
      totalSummary: intTotal.map((r) => ({
        className: r.class_name,
        count: r.count,
      })),
      lotSummaries: Object.values(groupBy(intByLot, "lot_id")).map((rows) => ({
        lotId: rows[0].lot_id,
        lotName: rows[0].lot_name,
        summary: rows.map((r) => ({ className: r.class_name, count: r.count })),
        chartImageUri: "", // Se llenará después
      })),
    };

    return { externalClassification, harvestCriteria, internalClassification };
  }

  private async generateCharts(data: {
    externalClassification: ClassificationSection;
    harvestCriteria: HarvestCriteriaSection;
    internalClassification: ClassificationSection;
  }): Promise<Map<string, string>> {
    const chartConfigs: ChartConfig[] = [];
    const baseConfig = {
      width: 400 * PixelRatio.get(),
      height: 320 * PixelRatio.get(),
    };

    const createConfigs = (
      section: ClassificationSection | HarvestCriteriaSection,
      prefix: string,
    ) => {
      for (const lot of section.lotSummaries) {
        chartConfigs.push({
          ...baseConfig,
          id: `${prefix}-${lot.lotId}`,
          data: lot.summary.map((d, i) => ({
            label: "className" in d ? d.className : d.criterion,
            value: d.count,
            color: CHART_COLOR_PALETTE[i % CHART_COLOR_PALETTE.length],
          })),
        });
      }
    };

    createConfigs(data.externalClassification, "ext");
    createConfigs(data.harvestCriteria, "harv");
    createConfigs(data.internalClassification, "int");

    const results = await Promise.allSettled(
      chartConfigs.map((c) => ChartForge.generatePieChart(c)),
    );

    const chartImageMap = new Map<string, string>();
    results.forEach((res, i) => {
      if (res.status === "fulfilled") {
        chartImageMap.set(chartConfigs[i].id, res.value);
      } else {
        console.error(
          `Falló la generación del gráfico ${chartConfigs[i].id}:`,
          res.reason,
        );
      }
    });

    return chartImageMap;
  }

  private assembleViewModel(
    data: assembleViewModelData,
    detailedBunches: BunchDetail[],
    chartMap: Map<string, string>,
  ): SummaryReportData {
    const addCharts = <
      T extends ClassificationSection | HarvestCriteriaSection,
    >(
      section: T,
      prefix: string,
    ): T => ({
      ...section,
      lotSummaries: section.lotSummaries.map((lot) => ({
        ...lot,
        chartImageUri: chartMap.get(`${prefix}-${lot.lotId}`) || "",
      })),
    });

    return {
      externalClassification: addCharts(data.externalClassification, "ext"),
      harvestCriteria: addCharts(data.harvestCriteria, "harv"),
      internalClassification: addCharts(data.internalClassification, "int"),
      detailedBunches,
    };
  }

  private buildHtmlBody(data: SummaryReportData): string {
    const externalTotalHtml = createTotalSummarySection(
      data.externalClassification.totalSummary,
      "Resumen Clasificación Externa",
      ["Clase", "Cant. Racimos"],
      "primary",
    );
    const externalLotsHtml = data.externalClassification.lotSummaries
      .map((lot, i) =>
        createLotSummarySection(
          lot,
          "classification",
          i % 2 === 0 ? "secondary" : "tertiary",
        ),
      )
      .join("");

    const harvestTotalHtml = createTotalSummarySection(
      data.harvestCriteria.totalSummary,
      "Resumen Criterios de Cosecha",
      ["Criterio", "Cant. Racimos"],
      "quaternary",
    );
    const harvestLotsHtml = data.harvestCriteria.lotSummaries
      .map((lot, i) =>
        createLotSummarySection(
          lot,
          "harvest",
          i % 2 === 0 ? "secondary" : "tertiary",
        ),
      )
      .join("");

    const internalTotalHtml = createTotalSummarySection(
      data.internalClassification.totalSummary,
      "Resumen Clasificación Interna",
      ["Tipo", "Cant. Racimos"],
      "primary",
    );
    const internalLotsHtml = data.internalClassification.lotSummaries
      .map((lot, i) =>
        createLotSummarySection(
          lot,
          "classification",
          i % 2 === 0 ? "secondary" : "tertiary",
        ),
      )
      .join("");

    const detailSections = data.detailedBunches
      .map((bunch) => createBunchDetailSection(bunch))
      .join("\n\n        ");

    return `
      <section class="report-block mb-6">
        <div class="report-block__header">
          <h1>Resumen General de la Jornada</h1>
          <div class="divider"></div>
        </div>
        <div class="report-block__body">
          ${externalTotalHtml}
          ${externalLotsHtml}
          ${harvestTotalHtml}
          ${harvestLotsHtml}
          ${internalTotalHtml}
          ${internalLotsHtml}
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
