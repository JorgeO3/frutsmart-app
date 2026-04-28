import type {
  HarvestCriteriaRow,
  AvailableReportRow,
  ClassificationPhotoRow,
  ClassificationResultRow,
  QualityClassificationRow,
  ClassificationSummaryRow,
} from "../types";
import type { DatabaseConnection } from "../database/DatabaseConnection";

// Aquí pondrías las complejas queries SQL de tu archivo Deno
const SQL_QUERIES = {
  // Resumen de clasificación externa total
  EXTERNAL_CLASSIFICATION_TOTAL: `
    SELECT 
      COALESCE(cr.human_feedback_corrected_class, cr.ai_predicted_class_name) AS class_name,
      COUNT(*) AS count
    FROM quality_classifications qc
    JOIN classification_results cr ON qc.quality_classification_id = cr.quality_classification_id
    WHERE cr.classification_type = 'external'
      AND DATE(qc.creation_timestamp) = ?
    GROUP BY class_name
    ORDER BY class_name
  `,

  // Resumen de clasificación externa por lote
  EXTERNAL_CLASSIFICATION_BY_LOT: `
    SELECT 
      l.id AS lot_id,
      l.name AS lot_name,
      COALESCE(cr.human_feedback_corrected_class, cr.ai_predicted_class_name) AS class_name,
      COUNT(*) AS count
    FROM quality_classifications qc
    JOIN lots l ON qc.lot_id = l.id
    JOIN classification_results cr ON qc.quality_classification_id = cr.quality_classification_id
    WHERE cr.classification_type = 'external'
      AND DATE(qc.creation_timestamp) = ?
    GROUP BY l.id, l.name, class_name
    ORDER BY l.name, class_name
  `,

  // Resumen de criterios de cosecha total
  HARVEST_CRITERIA_TOTAL: `
    SELECT 
      harvest_assigned_criterion AS criterion,
      COUNT(*) AS count
    FROM quality_classifications
    WHERE DATE(creation_timestamp) = ?
      AND harvest_assigned_criterion IS NOT NULL
    GROUP BY harvest_assigned_criterion
    ORDER BY harvest_assigned_criterion
  `,

  // Resumen de criterios de cosecha por lote
  HARVEST_CRITERIA_BY_LOT: `
    SELECT 
      l.id AS lot_id,
      l.name AS lot_name,
      qc.harvest_assigned_criterion AS criterion,
      COUNT(*) AS count
    FROM quality_classifications qc
    JOIN lots l ON qc.lot_id = l.id
    WHERE DATE(qc.creation_timestamp) = ?
      AND qc.harvest_assigned_criterion IS NOT NULL
    GROUP BY l.id, l.name, qc.harvest_assigned_criterion
    ORDER BY l.name, qc.harvest_assigned_criterion
  `,

  // Resumen de clasificación interna total
  INTERNAL_CLASSIFICATION_TOTAL: `
    SELECT 
      COALESCE(cr.human_feedback_corrected_class, cr.ai_predicted_class_name) AS class_name,
      COUNT(*) AS count
    FROM quality_classifications qc
    JOIN classification_results cr ON qc.quality_classification_id = cr.quality_classification_id
    WHERE cr.classification_type = 'internal'
      AND DATE(qc.creation_timestamp) = ?
    GROUP BY class_name
    ORDER BY class_name
  `,

  // Resumen de clasificación interna por lote
  INTERNAL_CLASSIFICATION_BY_LOT: `
    SELECT 
      l.id AS lot_id,
      l.name AS lot_name,
      COALESCE(cr.human_feedback_corrected_class, cr.ai_predicted_class_name) AS class_name,
      COUNT(*) AS count
    FROM quality_classifications qc
    JOIN lots l ON qc.lot_id = l.id
    JOIN classification_results cr ON qc.quality_classification_id = cr.quality_classification_id
    WHERE cr.classification_type = 'internal'
      AND DATE(qc.creation_timestamp) = ?
    GROUP BY l.id, l.name, class_name
    ORDER BY l.name, class_name
  `,

  // Detalles de cada racimo
  BUNCHES_DETAIL: `
    SELECT 
      qc.quality_classification_id,
      qc.creation_timestamp,
      qc.harvest_assigned_criterion,
      qc.harvest_number_of_applications,
      qc.harvest_cluster_weight,
      qc.harvest_observation,
      l.id AS lot_id,
      l.name AS lot_name,
      c.id AS center_id,
      c.name AS center_name
    FROM quality_classifications qc
    JOIN lots l ON qc.lot_id = l.id
    JOIN centers c ON qc.center_id = c.id
    WHERE DATE(qc.creation_timestamp) = ?
    ORDER BY qc.creation_timestamp
  `,

  // Resultados de clasificación para un racimo
  CLASSIFICATION_RESULTS_BY_BUNCH: `
    SELECT 
      quality_classification_id,
      classification_type,
      ai_predicted_class_name,
      human_feedback_corrected_class,
      human_feedback_observation
    FROM classification_results
    WHERE quality_classification_id = ?
  `,

  // Fotos de un racimo
  PHOTOS_BY_BUNCH: `
    SELECT 
      id,
      classification_type,
      photo_type,
      uri
    FROM classification_photos
    WHERE quality_classification_id = ? AND photo_type != 'segmented'
    ORDER BY classification_type, photo_type
  `,

  // Detalles del ÚLTIMO racimo del día
  LAST_BUNCH_DETAIL: `
    SELECT 
      qc.quality_classification_id,
      qc.creation_timestamp,
      qc.harvest_assigned_criterion,
      qc.harvest_number_of_applications,
      qc.harvest_observation,
      l.id AS lot_id,
      l.name AS lot_name,
      c.id AS center_id,
      c.name AS center_name
    FROM quality_classifications qc
    JOIN lots l ON qc.lot_id = l.id
    JOIN centers c ON qc.center_id = c.id
    WHERE DATE(qc.creation_timestamp) = ?
    ORDER BY qc.creation_timestamp DESC
    LIMIT 1
  `,

  GET_AVAILABLE_REPORTS: `
    SELECT
      id,
      report_date,
      report_id
    FROM reports
    WHERE (?1 IS NULL OR report_date >= ?1)
    ORDER BY report_date DESC
  `,
};

export class ReportQueryRepository {
  constructor(private db: DatabaseConnection) { }

  public getExternalClassificationTotal(
    date: string,
  ): Promise<ClassificationSummaryRow[]> {
    return this.db.getAll(SQL_QUERIES.EXTERNAL_CLASSIFICATION_TOTAL, [date]);
  }

  public getExternalClassificationByLot(
    date: string,
  ): Promise<
    (ClassificationSummaryRow & { lot_id: string; lot_name: string })[]
  > {
    return this.db.getAll(SQL_QUERIES.EXTERNAL_CLASSIFICATION_BY_LOT, [date]);
  }

  public getHarvestCriteriaTotal(date: string): Promise<HarvestCriteriaRow[]> {
    return this.db.getAll(SQL_QUERIES.HARVEST_CRITERIA_TOTAL, [date]);
  }

  public getHarvestCriteriaByLot(
    date: string,
  ): Promise<(HarvestCriteriaRow & { lot_id: string; lot_name: string })[]> {
    return this.db.getAll(SQL_QUERIES.HARVEST_CRITERIA_BY_LOT, [date]);
  }

  public getInternalClassificationTotal(
    date: string,
  ): Promise<ClassificationSummaryRow[]> {
    return this.db.getAll(SQL_QUERIES.INTERNAL_CLASSIFICATION_TOTAL, [date]);
  }

  public getInternalClassificationByLot(
    date: string,
  ): Promise<
    (ClassificationSummaryRow & { lot_id: string; lot_name: string })[]
  > {
    return this.db.getAll(SQL_QUERIES.INTERNAL_CLASSIFICATION_BY_LOT, [date]);
  }

  public getBunchesDetail(date: string): Promise<QualityClassificationRow[]> {
    return this.db.getAll(SQL_QUERIES.BUNCHES_DETAIL, [date]);
  }

  public getClassificationResultsByBunch(
    id: string,
  ): Promise<ClassificationResultRow[]> {
    return this.db.getAll(SQL_QUERIES.CLASSIFICATION_RESULTS_BY_BUNCH, [id]);
  }

  public getPhotosByBunch(id: string): Promise<ClassificationPhotoRow[]> {
    return this.db.getAll(SQL_QUERIES.PHOTOS_BY_BUNCH, [id]);
  }

  public getLastBunchDetail(
    date: string,
  ): Promise<QualityClassificationRow | null> {
    // Usamos this.db.get() porque esperamos un solo resultado o ninguno.
    return this.db.get(SQL_QUERIES.LAST_BUNCH_DETAIL, [date]);
  }

  public getAvailableReports(
    startDate?: string,
  ): Promise<AvailableReportRow[]> {
    // Si startDate es undefined, se pasa NULL a la query, lo que desactiva el filtro.
    return this.db.getAll(SQL_QUERIES.GET_AVAILABLE_REPORTS, [
      startDate || null,
    ]);
  }
}
