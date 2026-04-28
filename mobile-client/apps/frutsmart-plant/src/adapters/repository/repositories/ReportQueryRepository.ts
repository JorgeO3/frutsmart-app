import type { DatabaseConnection } from "../database/DatabaseConnection";
import type {
  AvailableReportRow,
  Lot,
  QualityAnalysis,
  ReportData,
  ReportIteration,
} from "../types";

// ============================================================
// SQL Queries para la construcción de reportes de Planta
// ============================================================

const SQL_QUERIES = {
  /**
   * Obtiene los datos principales del análisis, incluyendo el nombre del programa.
   */
  GET_ANALYSIS_MAIN_DATA: `
    SELECT qa.*, p.name as program_name
    FROM quality_analyses qa
    LEFT JOIN programs p ON qa.program_id = p.id
    WHERE qa.id = ?;
  `,

  /**
   * Obtiene todos los lotes asociados a un análisis.
   */
  GET_ANALYSIS_LOTS: `
    SELECT l.* FROM lots l
    INNER JOIN quality_analysis_lots qal ON l.id = qal.lot_id
    WHERE qal.quality_analysis_id = ?
    ORDER BY l.name ASC;
  `,

  /**
   * Obtiene los datos clave de las 4 iteraciones (clasificaciones).
   */
  GET_ANALYSIS_ITERATIONS: `
    SELECT id, iteration_index, internal_segmented_photo_uri
    FROM quality_classifications
    WHERE quality_analysis_id = ?
    ORDER BY iteration_index ASC;
  `,

  /**
   * Obtiene TODAS las URIs de los segmentos para un análisis completo,
   * permitiendo agruparlas por su 'quality_classification_id' en la app.
   */
  GET_ALL_SEGMENTS_FOR_ANALYSIS: `
    SELECT cs.quality_classification_id, cs.uri
    FROM classified_segments cs
    INNER JOIN quality_classifications qc ON cs.quality_classification_id = qc.id
    WHERE qc.quality_analysis_id = ?;
  `,

  GET_AVAILABLE_REPORTS: `
    SELECT
      r.id,
      r.report_id,
      r.report_date,
      qa.id as quality_analysis_id,
      qa.truck_plate,
      qa.provider
    FROM reports AS r
    JOIN quality_analyses AS qa ON r.quality_analysis_id = qa.id
    WHERE (?1 IS NULL OR r.report_date >= ?1)
    ORDER BY r.report_date DESC;
  `,
};

// ============================================================
// Repository Class
// ============================================================

export class ReportQueryRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Obtiene todos los datos necesarios para generar un reporte de análisis de calidad.
   * @param analysisId El ID del 'quality_analysis' a consultar.
   * @returns Un objeto 'ReportData' completo o null si no se encuentra.
   */
  public async getFullDetailForReport(
    analysisId: string,
  ): Promise<ReportData | null> {
    // 1. Ejecutamos todas las consultas necesarias en paralelo para máxima eficiencia.
    const [mainData, lots, iterationsRaw, segmentsRaw] = await Promise.all([
      this.db.get<QualityAnalysis & { program_name: string }>(
        SQL_QUERIES.GET_ANALYSIS_MAIN_DATA,
        [analysisId],
      ),
      this.db.getAll<Lot>(SQL_QUERIES.GET_ANALYSIS_LOTS, [analysisId]),
      this.db.getAll<{
        id: string;
        iteration_index: number;
        internal_segmented_photo_uri: string;
      }>(SQL_QUERIES.GET_ANALYSIS_ITERATIONS, [analysisId]),
      this.db.getAll<{ quality_classification_id: string; uri: string }>(
        SQL_QUERIES.GET_ALL_SEGMENTS_FOR_ANALYSIS,
        [analysisId],
      ),
    ]);
    console.log({ mainData, lots, iterationsRaw, segmentsRaw });

    // Si no se encuentra el análisis principal, no podemos construir el reporte.
    if (!mainData) {
      return null;
    }

    // 2. Procesamos y ensamblamos los datos en la estructura anidada que necesitamos.

    // Agrupamos los segmentos por el ID de su clasificación padre.
    const segmentsByClassificationId = new Map<string, string[]>();
    for (const segment of segmentsRaw) {
      if (!segmentsByClassificationId.has(segment.quality_classification_id)) {
        segmentsByClassificationId.set(segment.quality_classification_id, []);
      }
      segmentsByClassificationId
        .get(segment.quality_classification_id)
        ?.push(segment.uri);
    }

    // Construimos el array de iteraciones con sus fotos correspondientes.
    const iterations: ReportIteration[] = iterationsRaw.map((iter) => ({
      iteration_index: iter.iteration_index,
      internal_photo_uri: iter.internal_segmented_photo_uri,
      external_photo_uris: segmentsByClassificationId.get(iter.id) || [],
    }));

    // 3. Devolvemos el objeto 'ReportData' completo.
    return {
      ...mainData,
      program: mainData.program_id
        ? { id: mainData.program_id, name: mainData.program_name }
        : null,
      lots,
      iterations,
    };
  }

  /**
   * --- NUEVO MÉTODO ---
   * Obtiene una lista de todos los reportes disponibles, opcionalmente filtrando por fecha.
   * @param startDate La fecha de inicio (YYYY-MM-DD) para filtrar reportes.
   * @returns Una promesa que resuelve a un array de reportes disponibles.
   */
  public getAvailableReports(
    startDate?: string,
  ): Promise<AvailableReportRow[]> {
    return this.db.getAll(SQL_QUERIES.GET_AVAILABLE_REPORTS, [
      startDate || null,
    ]);
  }
}
