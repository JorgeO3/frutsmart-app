// src/adapters/repository/repositories/ClassificationPhotoRepository.ts

import type { SQLiteDatabase } from "expo-sqlite";
import type { DatabaseConnection } from "../database/DatabaseConnection";
import type { ClassificationPhoto } from "../types";

/**
 * Queries SQL para la tabla 'classification_photos'.
 */
const SQL_QUERIES = {
  CREATE: `
    INSERT INTO classification_photos (
      id, quality_classification_id, classification_type, photo_type, uri, raw_inference_output_json
    ) VALUES (?, ?, ?, ?, ?, ?);
  `,
  // biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
  FIND_BY_CLASSIFICATION_ID: `SELECT * FROM classification_photos WHERE quality_classification_id = ?;`,
};

/**
 * Repositorio para gestionar las operaciones de la entidad 'ClassificationPhoto'.
 * Esta clase es utilizada internamente por QualityClassificationRepository.
 */
export class ClassificationPhotoRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Crea un nuevo registro de foto DENTRO de una transacción existente.
   * Este método es llamado por la fachada QualityClassificationRepository para asegurar la atomicidad.
   * @param tx - El objeto de la transacción activa de expo-sqlite.
   * @param classificationId - El ID de la clasificación padre.
   * @param photo - Los datos de la foto a crear.
   */
  public async create(
    tx: SQLiteDatabase,
    classificationId: string,
    photo: Omit<ClassificationPhoto, "id" | "quality_classification_id">,
  ): Promise<void> {
    // Se genera un ID descriptivo y único combinando el ID de la clasificación y el nombre del archivo.
    const photoId = `${classificationId}-${this.db.helpers.extractFilenameFromUri(photo.uri)}`;

    const params = [
      photoId,
      classificationId,
      photo.classification_type,
      photo.photo_type,
      photo.uri,
      photo.raw_inference_output_json,
    ];

    await tx.runAsync(SQL_QUERIES.CREATE, params);
  }

  /**
   * Busca todas las fotos asociadas a una clasificación.
   * Este método es llamado por los métodos de fachada de QualityClassificationRepository.
   * @param classificationId - El ID de la clasificación.
   * @returns Un array de objetos ClassificationPhoto.
   */
  public findByClassificationId(
    classificationId: string,
  ): Promise<ClassificationPhoto[]> {
    return this.db.getAll<ClassificationPhoto>(
      SQL_QUERIES.FIND_BY_CLASSIFICATION_ID,
      [classificationId],
    );
  }
}
