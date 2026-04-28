import type { DatabaseConnection } from "../database/DatabaseConnection";
import type { Session } from "../types";

// ============================================================
// Queries SQL para la tabla 'sessions'
// ============================================================

const SQL_QUERIES = {
  /**
   * Inserta una nueva sesión. El 'start_timestamp' se añade automáticamente
   * gracias al DEFAULT CURRENT_TIMESTAMP en el esquema de la base de datos.
   */
  CREATE: `
    INSERT INTO sessions (id) VALUES (?);
  `,

  /**
   * Busca una sesión específica por su ID.
   */
  FIND_BY_ID: `
    SELECT * FROM sessions WHERE id = ?;
  `,

  /**
   * Actualiza el 'end_timestamp' de una sesión para marcarla como finalizada.
   * Se usa CURRENT_TIMESTAMP para registrar la hora exacta de la finalización.
   */
  END_SESSION: `
    UPDATE sessions SET end_timestamp = CURRENT_TIMESTAMP WHERE id = ?;
  `,

  /**
   * Opcional: Query para encontrar todas las sesiones que no tienen
   * ninguna clasificación de calidad asociada. Útil para limpieza.
   */
  FIND_ORPHANED: `
    SELECT s.* FROM sessions s
    LEFT JOIN quality_classifications qc ON s.id = qc.session_id
    WHERE qc.quality_classification_id IS NULL;
  `,
};

// ============================================================
// Clase del Repositorio
// ============================================================

/**
 * Repositorio para gestionar todas las operaciones de la tabla 'sessions'.
 */
export class SessionRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Crea un nuevo registro de sesión en la base de datos.
   * @param sessionId - El ID único para la sesión, generado en la capa de aplicación.
   * @returns La entidad de la sesión recién creada.
   */
  public async create(sessionId: string): Promise<Session> {
    await this.db.run(SQL_QUERIES.CREATE, [sessionId]);

    // Después de insertar, buscamos el registro para obtener el start_timestamp autogenerado.
    const newSession = await this.findById(sessionId);
    if (!newSession) {
      // Esto no debería ocurrir en una operación normal.
      throw new Error(
        "No se pudo crear o encontrar la sesión después de la inserción.",
      );
    }
    return newSession;
  }

  /**
   * Busca una sesión por su ID.
   * @param id - El ID de la sesión a buscar.
   * @returns La entidad de la sesión si se encuentra, de lo contrario null.
   */
  public async findById(id: string): Promise<Session | null> {
    return this.db.get<Session>(SQL_QUERIES.FIND_BY_ID, [id]);
  }

  /**
   * Marca una sesión como finalizada actualizando su 'end_timestamp'.
   * @param sessionId - El ID de la sesión a finalizar.
   */
  public async endSession(sessionId: string): Promise<void> {
    await this.db.run(SQL_QUERIES.END_SESSION, [sessionId]);
  }
}
