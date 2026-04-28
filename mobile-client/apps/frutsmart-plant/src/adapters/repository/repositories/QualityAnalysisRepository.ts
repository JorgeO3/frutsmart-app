import type { SQLiteDatabase } from "expo-sqlite";

import type { DatabaseConnection } from "../database/DatabaseConnection";
import type {
  FullAnalysis,
  FullAnalysisInput,
  Pagination,
  QualityAnalysis,
} from "../types";
import { ClassifiedSegmentsRepository } from "./ClassifiedSegmentsRepository";
import { QualityAnalysisLotsRepository } from "./QualityAnalysisLotsRepository";
import { QualityClassificationsRepository } from "./QualityClassificationsRepository";

// ============================================================
// SQL Queries
// ============================================================

const SQL_QUERIES = {
  CREATE: `
    INSERT INTO quality_analyses (
      id, creation_timestamp, session_id, provider, qr_code, truck_plate,
      consecutive_number, program_id, vendor, sub_vendor, device_time_of_day,
      device_weather, device_has_internet, geo_latitude, geo_longitude,
      model_detection_id, model_external_id, model_internal_id, criteria_rb,
      criteria_rv, criteria_rsm, criteria_rmf, criteria_rpl, criteria_pas,
      criteria_vac, external_summary_json, internal_summary_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
  FINALIZE: `UPDATE quality_analyses SET is_finalized = 1 WHERE id = ?;`,
  FIND_OLDER_THAN: `SELECT * FROM quality_analyses WHERE creation_timestamp < date('now', '-' || ? || ' days');`,
  FIND_BY_ID: `SELECT * FROM quality_analyses WHERE id = ?;`,
  FIND_ALL: `SELECT * FROM quality_analyses ORDER BY creation_timestamp DESC LIMIT ? OFFSET ?;`,
  COUNT_ALL: `SELECT COUNT(id) as total FROM quality_analyses;`,
};

// ============================================================
// Repository Class
// ============================================================

export class QualityAnalysisRepository {
  private lotsRepo: QualityAnalysisLotsRepository;
  private classificationsRepo: QualityClassificationsRepository;
  private segmentsRepo: ClassifiedSegmentsRepository;

  constructor(private db: DatabaseConnection) {
    this.lotsRepo = new QualityAnalysisLotsRepository(db);
    this.classificationsRepo = new QualityClassificationsRepository(db);
    this.segmentsRepo = new ClassifiedSegmentsRepository(db);
  }

  /**
   * Orquesta la creación y finalización de un análisis de calidad completo
   * dentro de una única transacción atómica.
   * @param data El objeto completo con todos los datos del análisis.
   * @returns El ID del nuevo análisis de calidad creado.
   */
  public async createAndFinalize(
    data: FullAnalysisInput,
    analysisId: string,
  ): Promise<string> {
    await this.db.transaction(async (tx) => {
      // 1. Insertar el registro principal
      await this._createAnalysisRecord(tx, analysisId, data);

      // 2. Delegar la inserción de lotes
      if (data.lotIds.length > 0) {
        await this.lotsRepo.bulkCreateForAnalysis(tx, analysisId, data.lotIds);
      }

      // 3. Delegar la inserción de clasificaciones y sus segmentos
      if (data.classifications.length > 0) {
        // Preparamos los datos para la inserción en bulk de las 4 clasificaciones
        const classificationInputsWithIds = data.classifications.map((c) => ({
          id: this.db.helpers.generateId(),
          input: c,
        }));

        // Insertamos todas las clasificaciones (las 4 iteraciones) a la vez
        await this.classificationsRepo.bulkCreateWithIds(
          tx,
          analysisId,
          classificationInputsWithIds,
        );

        // Ahora, insertamos los segmentos para cada clasificación creada
        for (const c of classificationInputsWithIds) {
          if (c.input.segments && c.input.segments.length > 0) {
            await this.segmentsRepo.bulkCreateForClassification(
              tx,
              c.id,
              c.input.segments,
            );
          }
        }
      }

      // 4. Finalizar el análisis para activar los triggers
      await this._finalizeAnalysis(tx, analysisId);
    });

    return analysisId;
  }

  /**
   * Busca un análisis de calidad por su ID y recupera todos sus datos anidados.
   * @param id El ID del análisis a buscar.
   * @returns Un objeto FullAnalysis completo, o null si no se encuentra.
   */
  public async findFullById(id: string): Promise<FullAnalysis | null> {
    const analysis = await this.db.get<QualityAnalysis>(
      SQL_QUERIES.FIND_BY_ID,
      [id],
    );
    if (!analysis) return null;

    // Convertimos los valores de la BD a booleanos para la app
    analysis.device_has_internet = this.db.helpers.sqliteToBoolean(
      analysis.device_has_internet as unknown as number,
    );
    analysis.is_finalized = this.db.helpers.sqliteToBoolean(
      analysis.is_finalized as unknown as number,
    );

    const [lots, classifications] = await Promise.all([
      this.lotsRepo.findByQualityAnalysisId(id),
      this.classificationsRepo.findByQualityAnalysisId(id),
    ]);

    const fullClassifications = await Promise.all(
      classifications.map(async (c) => {
        const segments = await this.segmentsRepo.findByClassificationId(c.id);
        // También convertimos el booleano aquí
        if (c.internal_hf_is_correct !== null) {
          c.internal_hf_is_correct = this.db.helpers.sqliteToBoolean(
            c.internal_hf_is_correct as unknown as number,
          );
        }
        return { ...c, segments };
      }),
    );

    return { ...analysis, lots, classifications: fullClassifications };
  }

  /**
   * Recupera una lista paginada de análisis de calidad (solo los datos principales).
   * @param page Página a recuperar.
   * @param limit Número de ítems por página.
   * @returns Un objeto de paginación con los análisis.
   */
  public async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<Pagination<QualityAnalysis>> {
    const offset = this.db.helpers.calculateOffset(page, limit);
    const [items, countResult] = await Promise.all([
      this.db.getAll<QualityAnalysis>(SQL_QUERIES.FIND_ALL, [limit, offset]),
      this.db.get<{ total: number }>(SQL_QUERIES.COUNT_ALL),
    ]);
    const total = countResult?.total ?? 0;

    // Convertimos los booleanos para la lista también
    items.forEach((item) => {
      item.device_has_internet = this.db.helpers.sqliteToBoolean(
        item.device_has_internet as unknown as number,
      );
      item.is_finalized = this.db.helpers.sqliteToBoolean(
        item.is_finalized as unknown as number,
      );
    });

    return this.db.helpers.createPaginationInfo(items, page, limit, total);
  }

  /**
   * Busca todos los análisis más antiguos que el número de días especificado.
   * @param days El número de días para el umbral de retención.
   * @returns Un array de objetos QualityAnalysis.
   */
  public async findOlderThan(days: number): Promise<QualityAnalysis[]> {
    return this.db.getAll<QualityAnalysis>(SQL_QUERIES.FIND_OLDER_THAN, [
      String(days),
    ]);
  }

  /**
   * Elimina análisis de la base de datos basados en una lista de IDs.
   * @param ids Un array de IDs de quality_analyses a eliminar.
   */
  public async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return; // No hacer nada si el array está vacío.
    }

    // Construir la query dinámicamente para el operador IN.
    const placeholders = ids.map(() => "?").join(",");
    const sql = `DELETE FROM quality_analyses WHERE id IN (${placeholders});`;

    await this.db.run(sql, ids);
  }

  // --- Métodos privados auxiliares ---

  private async _createAnalysisRecord(
    tx: SQLiteDatabase,
    analysisId: string,
    data: FullAnalysisInput,
  ): Promise<void> {
    const values = [
      analysisId,
      data.metadata.creation_timestamp,
      data.metadata.session_id,
      data.traceability.provider,
      data.traceability.qr_code,
      data.traceability.truck_plate,
      data.traceability.consecutive_number,
      data.traceability.program_id ?? null,
      data.traceability.vendor ?? null,
      data.traceability.sub_vendor ?? null,
      data.metadata.device_time_of_day,
      data.metadata.device_weather,
      this.db.helpers.booleanToSqlite(data.metadata.device_has_internet), // Mejora aplicada
      data.metadata.geo_latitude,
      data.metadata.geo_longitude,
      data.metadata.model_detection_id ?? null,
      data.metadata.model_external_id ?? null,
      data.metadata.model_internal_id ?? null,
      data.criteria.rb,
      data.criteria.rv,
      data.criteria.rsm,
      data.criteria.rmf,
      data.criteria.rpl,
      data.criteria.pas,
      data.criteria.vac,
      data.summary.external_summary_json,
      data.summary.internal_summary_json,
    ];
    await tx.runAsync(SQL_QUERIES.CREATE, values);
  }

  private async _finalizeAnalysis(
    tx: SQLiteDatabase,
    analysisId: string,
  ): Promise<void> {
    await tx.runAsync(SQL_QUERIES.FINALIZE, [analysisId]);
  }
}
