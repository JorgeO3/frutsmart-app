import type { SQLiteDatabase } from "expo-sqlite";

import type {
  ClassificationPhoto,
  ClassificationResult,
  QualityClassification,
} from "../types";
import type { DatabaseConnection } from "../database/DatabaseConnection";
import type { ClassificationPhotoRepository } from "./ClassificationPhotoRepository";
import type { ClassificationResultRepository } from "./ClassificationResultRepository";

// ============================================================
// Tipos de Datos Específicos para este Repositorio
// Nota: Estos tipos pueden vivir aquí o en un archivo central types.ts
// ============================================================

/**
 * Define la estructura de datos necesaria para crear una nueva clasificación completa.
 * Es el "Payload" que el servicio debe construir y enviar a este repositorio.
 */
export interface CreateClassificationPayload {
  classification: Omit<QualityClassification, "quality_classification_id">;
  results: Omit<ClassificationResult, "id" | "quality_classification_id">[];
  photos: Omit<ClassificationPhoto, "id" | "quality_classification_id">[];
}

/**
 * Representa una clasificación completa (un "Agregado"), incluyendo sus
 * entidades hijas (resultados y fotos). Es el tipo de dato que devuelven
 * los métodos de consulta como `findById`.
 */
export interface FullQualityClassification extends QualityClassification {
  results: ClassificationResult[];
  photos: ClassificationPhoto[];
}

// ============================================================
// Queries SQL para la tabla 'quality_classifications'
// ============================================================

const SQL_QUERIES = {
  INSERT_CLASSIFICATION: `
    INSERT INTO quality_classifications (
      quality_classification_id, creation_timestamp, session_id, lot_id, center_id,
      device_time_of_day, device_weather, device_has_internet, geo_latitude, geo_longitude,
      model_detection_id, model_external_id, model_internal_id, harvest_assigned_criterion,
      harvest_number_of_applications, harvest_cluster_weight, harvest_observation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
  FIND_BY_ID:
    "SELECT * FROM quality_classifications WHERE quality_classification_id = ?;",
  FIND_OLDER_THAN: `
    SELECT * FROM quality_classifications
    WHERE creation_timestamp < date('now', '-' || ? || ' days');
  `,
  DELETE_BY_IDS_BASE:
    "DELETE FROM quality_classifications WHERE quality_classification_id IN",
};

// ============================================================
// Clase del Repositorio
// ============================================================

/**
 * Repositorio que actúa como Fachada (Facade) para el agregado de QualityClassification.
 * Es el único punto de entrada para todas las operaciones relacionadas con una
 * clasificación, sus fotos y sus resultados.
 */
export class QualityClassificationRepository {
  /**
   * El constructor recibe sus dependencias (los repositorios hijos)
   * a través de Inyección de Dependencias.
   * @param db - La conexión a la base de datos.
   * @param resultRepository - El repositorio para los resultados de clasificación.
   * @param photoRepository - El repositorio para las fotos de clasificación.
   */
  constructor(
    private db: DatabaseConnection,
    private resultRepository: ClassificationResultRepository,
    private photoRepository: ClassificationPhotoRepository,
  ) { }

  /**
   * Orquesta la creación de una clasificación de calidad de forma transaccional,
   * delegando la inserción de hijos a sus respectivos repositorios.
   * @param payload - El objeto que contiene todos los datos de la clasificación.
   * @returns La entidad QualityClassification que fue creada.
   */
  public async create(
    payload: CreateClassificationPayload,
  ): Promise<QualityClassification> {
    const { classification, results, photos } = payload;
    const classificationId = this.db.helpers.generateId();

    const newClassification: QualityClassification = {
      ...classification,
      quality_classification_id: classificationId,
    };

    await this.db.transaction(async (tx) => {
      // 1. Insertar el registro principal (responsabilidad de esta clase).
      await this._insertMainClassification(tx, newClassification);

      // 2. Delegar la inserción de resultados al repositorio correspondiente.
      for (const result of results) {
        await this.resultRepository.create(tx, classificationId, result);
      }

      // 3. Delegar la inserción de fotos al repositorio correspondiente.
      for (const photo of photos) {
        await this.photoRepository.create(tx, classificationId, photo);
      }
    });

    return newClassification;
  }

  /**
   * Busca una clasificación completa por su ID, incluyendo todos sus resultados y fotos.
   * @param id - El ID de la clasificación a buscar.
   * @returns Un objeto FullQualityClassification si se encuentra, de lo contrario null.
   */
  public async findById(id: string): Promise<FullQualityClassification | null> {
    const mainClassification = await this.db.get<QualityClassification>(
      SQL_QUERIES.FIND_BY_ID,
      [id],
    );

    if (!mainClassification) {
      return null;
    }

    // Delega la búsqueda de hijos a sus propios métodos de fachada.
    const [results, photos] = await Promise.all([
      this.findResultsFor(id),
      this.findPhotosFor(id),
    ]);

    return {
      ...mainClassification,
      device_has_internet: this.db.helpers.sqliteToBoolean(
        mainClassification.device_has_internet as unknown as number,
      ),
      results,
      photos,
    };
  }

  /**
   * Busca todas las clasificaciones más antiguas que el número de días especificado.
   * @param days - El número de días para el umbral de retención.
   * @returns Un array de objetos QualityClassification.
   */
  public async findOlderThan(days: number): Promise<QualityClassification[]> {
    return this.db.getAll<QualityClassification>(SQL_QUERIES.FIND_OLDER_THAN, [
      String(days),
    ]);
  }

  /**
   * Elimina clasificaciones basadas en una lista de IDs.
   * @param ids - Un array de quality_classification_id a eliminar.
   */
  public async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return; // No hacer nada si no hay IDs para eliminar.
    }

    // Construir la query dinámicamente para el operador IN.
    const placeholders = ids.map(() => "?").join(",");
    const sql = `${SQL_QUERIES.DELETE_BY_IDS_BASE} (${placeholders});`;

    await this.db.run(sql, ids);
  }

  // ============================================================
  // MÉTODOS DE FACHADA (FACADE)
  // ============================================================

  /**
   * Busca todos los resultados asociados a una clasificación específica.
   * @param classificationId - El ID de la clasificación.
   * @returns Un array de objetos ClassificationResult.
   */
  public findResultsFor(
    classificationId: string,
  ): Promise<ClassificationResult[]> {
    return this.resultRepository.findByClassificationId(classificationId);
  }

  /**
   * Busca todas las fotos asociadas a una clasificación específica.
   * @param classificationId - El ID de la clasificación.
   * @returns Un array de objetos ClassificationPhoto.
   */
  public findPhotosFor(
    classificationId: string,
  ): Promise<ClassificationPhoto[]> {
    return this.photoRepository.findByClassificationId(classificationId);
  }

  // ============================================================
  // MÉTODOS PRIVADOS AUXILIARES
  // ============================================================

  /**
   * Inserta la entidad principal 'quality_classifications' dentro de una transacción.
   * @param tx - El objeto de transacción activo.
   * @param data - Los datos de la clasificación a insertar.
   */
  private async _insertMainClassification(
    tx: SQLiteDatabase,
    data: QualityClassification,
  ): Promise<void> {
    const params = [
      data.quality_classification_id,
      data.creation_timestamp,
      data.session_id,
      data.lot_id,
      data.center_id,
      data.device_time_of_day,
      data.device_weather,
      this.db.helpers.booleanToSqlite(data.device_has_internet),
      data.geo_latitude,
      data.geo_longitude,
      data.model_detection_id,
      data.model_external_id,
      data.model_internal_id,
      data.harvest_assigned_criterion,
      data.harvest_number_of_applications,
      data.harvest_cluster_weight,
      data.harvest_observation,
    ];
    await tx.runAsync(SQL_QUERIES.INSERT_CLASSIFICATION, params);
  }
}
