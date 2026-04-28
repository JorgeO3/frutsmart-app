import type { SQLiteDatabase } from "expo-sqlite";
import type { DatabaseConnection } from "../database/DatabaseConnection";
import type { ClassifiedSegment, ClassifiedSegmentInput } from "../types";

// ============================================================
// SQL Queries for 'classified_segments' table
// ============================================================

const SQL_QUERIES = {
  // La consulta de creación se construirá dinámicamente para el bulk insert.

  /**
   * Recupera todos los segmentos asociados a una clasificación (iteración) específica.
   */
  FIND_BY_CLASSIFICATION_ID: `
    SELECT * FROM classified_segments
    WHERE quality_classification_id = ?;
  `,

  /**
   * Elimina todos los segmentos de una clasificación.
   */
  DELETE_BY_CLASSIFICATION_ID: `
    DELETE FROM classified_segments WHERE quality_classification_id = ?;
  `,

  /**
   * Busca un segmento individual por su ID.
   */
  FIND_BY_ID: `
    SELECT * FROM classified_segments WHERE id = ?;
  `,
};

// ============================================================
// Repository Class
// ============================================================

export class ClassifiedSegmentsRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Inserta todos los segmentos para una clasificación externa en una
   * única y eficiente operación de base de datos.
   * @param classificationId El ID de la quality_classification a la que pertenecen estos segmentos.
   * @param segments Un array de objetos con los datos de cada segmento detectado.
   */
  public async bulkCreateForClassification(
    tx: SQLiteDatabase,
    classificationId: string,
    segments: ClassifiedSegmentInput[],
  ): Promise<void> {
    if (segments.length === 0) {
      return;
    }

    const columns = [
      "id",
      "quality_classification_id",
      "uri",
      "best_class_name",
      "best_confidence",
      "confidences_json",
    ].join(", ");

    // 1. Crear la cadena de placeholders: e.g., '(?, ..., ?), (?, ..., ?)'
    const placeholders = segments
      .map(() => `(${new Array(6).fill("?").join(", ")})`)
      .join(", ");

    // 2. Construir la consulta SQL completa.
    const sql = `INSERT INTO classified_segments (${columns}) VALUES ${placeholders};`;

    // 3. Aplanar el array de valores, generando un ID para cada segmento.
    const values = segments.flatMap((s) => [
      this.db.helpers.generateId(),
      classificationId,
      s.uri,
      s.best_class_name,
      s.best_confidence,
      s.confidences_json,
    ]);

    // 4. Ejecutar la única consulta con todos los datos.
    await tx.runAsync(sql, values);
  }

  /**
   * Recupera todos los segmentos para una clasificación (iteración) específica.
   * @param classificationId El ID de la quality_classification.
   * @returns Un array de objetos ClassifiedSegment.
   */
  public findByClassificationId(
    classificationId: string,
  ): Promise<ClassifiedSegment[]> {
    return this.db.getAll<ClassifiedSegment>(
      SQL_QUERIES.FIND_BY_CLASSIFICATION_ID,
      [classificationId],
    );
  }

  /**
   * Elimina todos los segmentos para una clasificación específica.
   * @param classificationId El ID de la quality_classification.
   */
  public async deleteByClassificationId(
    classificationId: string,
  ): Promise<void> {
    await this.db.run(SQL_QUERIES.DELETE_BY_CLASSIFICATION_ID, [
      classificationId,
    ]);
  }

  /**
   * Busca un único segmento por su ID primario.
   * @param id El ID del segmento.
   * @returns El objeto ClassifiedSegment si se encuentra, de lo contrario null.
   */
  public findById(id: string): Promise<ClassifiedSegment | null> {
    return this.db.get<ClassifiedSegment>(SQL_QUERIES.FIND_BY_ID, [id]);
  }
}
