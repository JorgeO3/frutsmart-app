import type { DatabaseConnection } from "../database/DatabaseConnection";
import type { Session } from "../types-backup";

// ============================================================
// SQL Queries for the 'sessions' table
// ============================================================
const SQL_QUERIES = {
  CREATE: `
    INSERT INTO sessions (id) VALUES (?);
  `,

  FIND_BY_ID: `
    SELECT * FROM sessions WHERE id = ?;
  `,

  END_SESSION: `
    UPDATE sessions SET end_timestamp = CURRENT_TIMESTAMP WHERE id = ?;
  `,

  /**
   * Finds all sessions that do not have any quality analyses associated with them.
   * Useful for data cleanup or identifying incomplete sessions.
   */
  FIND_ORPHANED: `
    SELECT s.* FROM sessions s
    LEFT JOIN quality_analyses qa ON s.id = qa.session_id
    WHERE qa.id IS NULL;
  `,
};

// ============================================================
// Repository Class
// ============================================================

/**
 * Manages all database operations for the 'sessions' table.
 */
export class SessionRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Creates a new session record in the database.
   * @param sessionId The unique ID for the session, generated in the application layer.
   * @returns The newly created session entity.
   */
  public async create(sessionId: string): Promise<Session> {
    await this.db.run(SQL_QUERIES.CREATE, [sessionId]);

    const newSession = await this.findById(sessionId);
    if (!newSession) {
      throw new Error("Could not create or find the session after insertion.");
    }
    return newSession;
  }

  /**
   * Finds a session by its ID.
   * @param id The ID of the session to find.
   * @returns The session entity if found, otherwise null.
   */
  public async findById(id: string): Promise<Session | null> {
    return this.db.get<Session>(SQL_QUERIES.FIND_BY_ID, [id]);
  }

  /**
   * Marks a session as finished by updating its 'end_timestamp'.
   * @param sessionId The ID of the session to end.
   */
  public async endSession(sessionId: string): Promise<void> {
    await this.db.run(SQL_QUERIES.END_SESSION, [sessionId]);
  }
}
