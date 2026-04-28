import type { SQLiteDatabase } from "expo-sqlite";
import type { DatabaseConnection } from "../database/DatabaseConnection";
import type { Lot } from "../types";

// ============================================================
// SQL Queries for 'quality_analysis_lots' table
// ============================================================

const SQL_QUERIES = {
  // --- CAMBIO: Ya no necesitamos una query de creación simple ---
  // La query se construirá dinámicamente en el método 'bulkCreate'

  FIND_LOTS_BY_ANALYSIS_ID: `
    SELECT l.* FROM lots l
    INNER JOIN quality_analysis_lots qal ON l.id = qal.lot_id
    WHERE qal.quality_analysis_id = ?;
  `,

  DELETE_BY_ANALYSIS_ID: `
    DELETE FROM quality_analysis_lots WHERE quality_analysis_id = ?;
  `,
};

// ============================================================
// Repository Class
// ============================================================

/**
 * Manages the many-to-many relationship between quality analyses and lots.
 */
export class QualityAnalysisLotsRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Inserts all lot associations for a single quality analysis in a single,
   * efficient bulk operation.
   * @param analysisId The ID of the parent quality_analysis.
   * @param lotIds An array of lot IDs to associate with the analysis.
   */
  public async bulkCreateForAnalysis(
    tx: SQLiteDatabase,
    analysisId: string,
    lotIds: string[],
  ): Promise<void> {
    // Si no hay IDs de lote para insertar, no hacemos nada.
    if (lotIds.length === 0) {
      return;
    }

    // 1. Crear la cadena de placeholders: e.g., '(?, ?), (?, ?), (?, ?)'
    const placeholders = lotIds.map(() => "(?, ?)").join(", ");

    // 2. Construir la consulta SQL completa.
    const sql = `
      INSERT INTO quality_analysis_lots (quality_analysis_id, lot_id)
      VALUES ${placeholders};
    `;

    // 3. Aplanar el array de valores para que coincida con los placeholders.
    // e.g., [analysisId, lotId1, analysisId, lotId2, analysisId, lotId3]
    const values = lotIds.flatMap((lotId) => [analysisId, lotId]);

    // 4. Ejecutar la única consulta con todos los datos.
    await tx.runAsync(sql, values);
  }

  /**
   * Retrieves the full details of all lots linked to a specific quality analysis.
   * @param analysisId The ID of the quality_analysis to query.
   * @returns A promise that resolves to an array of Lot objects.
   */
  public findByQualityAnalysisId(analysisId: string): Promise<Lot[]> {
    return this.db.getAll<Lot>(SQL_QUERIES.FIND_LOTS_BY_ANALYSIS_ID, [
      analysisId,
    ]);
  }

  /**
   * Removes all lot associations for a specific quality analysis.
   * @param analysisId The ID of the quality_analysis whose lot links should be cleared.
   */
  public async deleteByAnalysisId(analysisId: string): Promise<void> {
    await this.db.run(SQL_QUERIES.DELETE_BY_ANALYSIS_ID, [analysisId]);
  }
}
