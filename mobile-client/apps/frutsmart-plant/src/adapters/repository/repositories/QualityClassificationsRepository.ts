import type { SQLiteDatabase } from "expo-sqlite";
import type { DatabaseConnection } from "../database/DatabaseConnection";
import type {
  QualityClassification,
  QualityClassificationInput,
} from "../types";

// ============================================================
// SQL Queries for 'quality_classifications' table
// ============================================================

const SQL_QUERIES = {
  // La consulta de creación se construirá dinámicamente para el bulk insert.

  /**
   * Recupera todas las clasificaciones para un análisis, ordenadas por su índice.
   * El orden es crucial para reconstruir el estado en el orden correcto.
   */
  FIND_BY_ANALYSIS_ID: `
    SELECT * FROM quality_classifications
    WHERE quality_analysis_id = ?
    ORDER BY iteration_index ASC;
  `,

  /**
   * Elimina todas las clasificaciones asociadas a un análisis.
   */
  DELETE_BY_ANALYSIS_ID: `
    DELETE FROM quality_classifications WHERE quality_analysis_id = ?;
  `,

  /**
   * Busca una clasificación individual por su ID.
   */
  FIND_BY_ID: `
    SELECT * FROM quality_classifications WHERE id = ?;
  `,
};

// ============================================================
// Repository Class
// ============================================================

export class QualityClassificationsRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Inserta todas las clasificaciones (iteraciones) para un análisis de calidad
   * en una única y eficiente operación de base de datos.
   * @param analysisId El ID del quality_analysis al que pertenecen estas clasificaciones.
   * @param classifications Un array de objetos (normalmente 4) con los datos de cada iteración.
   */
  public async bulkCreateWithIds(
    tx: SQLiteDatabase,
    analysisId: string,
    classifications: { id: string; input: QualityClassificationInput }[],
  ): Promise<void> {
    if (classifications.length === 0) return;

    const columns = [
      "id",
      "quality_analysis_id",
      "iteration_index",
      "external_raw_photo_uri",
      "internal_raw_photo_uri",
      "internal_segmented_photo_uri",
      "internal_ai_class_name",
      "internal_ai_confidence",
      "internal_ai_raw_confidences_json",
      "internal_hf_is_correct",
      "internal_hf_corrected_class_name",
      "internal_hf_observation",
    ] as const;

    const placeholders = classifications
      .map(() => `(${Array(columns.length).fill("?").join(", ")})`)
      .join(", ");

    const sql = `INSERT INTO quality_classifications (${columns.join(", ")}) VALUES ${placeholders};`;

    const values = classifications.flatMap(({ id, input }) => [
      id,
      analysisId,
      input.iteration_index,
      input.external_raw_photo_uri,
      input.internal_raw_photo_uri,
      input.internal_segmented_photo_uri,
      input.internal_ai_class_name,
      input.internal_ai_confidence,
      input.internal_ai_raw_confidences_json,
      input.internal_hf_is_correct,
      input.internal_hf_corrected_class_name,
      input.internal_hf_observation,
    ]);

    const expectedLength = classifications.length * columns.length;
    if (values.length !== expectedLength) {
      throw new Error(
        `Expected ${expectedLength} values, but got ${values.length}`,
      );
    }

    console.log({ valuesLength: values.length, expectedLength });

    await tx.runAsync(sql, values);
  }

  /**
   * Recupera todas las clasificaciones (iteraciones) para un análisis específico.
   * @param analysisId El ID del quality_analysis.
   * @returns Un array de objetos QualityClassification, ordenados por iteración.
   */
  public findByQualityAnalysisId(
    analysisId: string,
  ): Promise<QualityClassification[]> {
    return this.db.getAll<QualityClassification>(
      SQL_QUERIES.FIND_BY_ANALYSIS_ID,
      [analysisId],
    );
  }

  /**
   * Elimina todas las clasificaciones para un análisis específico.
   * @param analysisId El ID del quality_analysis.
   */
  public async deleteByAnalysisId(analysisId: string): Promise<void> {
    await this.db.run(SQL_QUERIES.DELETE_BY_ANALYSIS_ID, [analysisId]);
  }

  /**
   * Busca una única clasificación por su ID primario.
   * @param id El ID de la clasificación.
   * @returns El objeto QualityClassification si se encuentra, de lo contrario null.
   */
  public findById(id: string): Promise<QualityClassification | null> {
    return this.db.get<QualityClassification>(SQL_QUERIES.FIND_BY_ID, [id]);
  }
}
