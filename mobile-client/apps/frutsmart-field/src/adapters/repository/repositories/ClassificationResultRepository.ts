// src/adapters/repository/repositories/ClassificationResultRepository.ts

import type { SQLiteDatabase } from "expo-sqlite";
import type { DatabaseConnection } from "../database/DatabaseConnection";
import type { ClassificationResult } from "../types";

/**
 * Queries SQL para la tabla 'classification_results'.
 */
const SQL_QUERIES = {
  CREATE: `
    INSERT INTO classification_results (
      id, quality_classification_id, classification_type, ai_predicted_class_name, ai_confidence,
      ai_raw_inference_output_json, human_feedback_is_correct, human_feedback_corrected_class,
      human_feedback_observation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
  FIND_BY_CLASSIFICATION_ID:
    "SELECT * FROM classification_results WHERE quality_classification_id = ?;",
};

/**
 * Repositorio para gestionar las operaciones de la entidad 'ClassificationResult'.
 * Esta clase es utilizada internamente por QualityClassificationRepository.
 */
export class ClassificationResultRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Crea un nuevo registro de resultado DENTRO de una transacción existente.
   * Este método es llamado por la fachada QualityClassificationRepository para asegurar la atomicidad.
   * @param tx - El objeto de la transacción activa de expo-sqlite.
   * @param classificationId - El ID de la clasificación padre.
   * @param result - Los datos del resultado a crear.
   */
  public async create(
    tx: SQLiteDatabase,
    classificationId: string,
    result: Omit<ClassificationResult, "id" | "quality_classification_id">,
  ): Promise<void> {
    const resultId = this.db.helpers.generateId();

    const params = [
      resultId,
      classificationId,
      result.classification_type,
      result.ai_predicted_class_name,
      result.ai_confidence,
      result.ai_raw_inference_output_json,
      // Maneja la conversión de booleano a entero (0/1) para SQLite
      result.human_feedback_is_correct != null
        ? this.db.helpers.booleanToSqlite(result.human_feedback_is_correct)
        : null,
      result.human_feedback_corrected_class,
      result.human_feedback_observation,
    ];

    await tx.runAsync(SQL_QUERIES.CREATE, params);
  }

  /**
   * Busca todos los resultados asociados a una clasificación.
   * Este método es llamado por los métodos de fachada de QualityClassificationRepository.
   * @param classificationId - El ID de la clasificación.
   * @returns Un array de objetos ClassificationResult.
   */
  public async findByClassificationId(
    classificationId: string,
  ): Promise<ClassificationResult[]> {
    const resultsFromDb = await this.db.getAll<ClassificationResult>(
      SQL_QUERIES.FIND_BY_CLASSIFICATION_ID,
      [classificationId],
    );

    // Mapea los resultados para reconvertir los valores numéricos a booleanos,
    // asegurando que la capa de negocio siempre trabaje con tipos de JS puros.
    return resultsFromDb.map((r) => ({
      ...r,
      human_feedback_is_correct:
        r.human_feedback_is_correct != null
          ? this.db.helpers.sqliteToBoolean(
              r.human_feedback_is_correct as unknown as number,
            )
          : null,
    }));
  }
}
