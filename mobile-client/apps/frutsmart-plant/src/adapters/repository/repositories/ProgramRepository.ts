import type { DatabaseConnection } from "../database/DatabaseConnection";
import type { Pagination, Program } from "../types";

// ============================================================
// SQL Queries for 'programs' table
// ============================================================
// biome-ignore format: readability
const SQL_QUERIES = {
  SEARCH_LIKE: `
    SELECT * FROM programs
    WHERE name LIKE '%' || ? || '%'
    ORDER BY
      CASE
        WHEN name = ? THEN 0
        WHEN name LIKE ? || '%' THEN 1
        ELSE 2
      END,
      LENGTH(name), name
    LIMIT ? OFFSET ?;
  `,
  SEARCH_FTS: `
    SELECT DISTINCT p.* FROM programs p
    WHERE p.rowid IN (
      SELECT rowid FROM programs_fts WHERE programs_fts MATCH ?
      UNION
      SELECT rowid FROM programs WHERE name LIKE '%' || ? || '%'
    )
    ORDER BY
      CASE
        WHEN p.name = ? THEN 0
        WHEN p.name LIKE ? || '%' THEN 1
        ELSE 2
      END,
      LENGTH(p.name), p.name
    LIMIT ? OFFSET ?;
  `,
  COUNT_SEARCH_LIKE: "SELECT COUNT(id) as total FROM programs WHERE name LIKE '%' || ? || '%';",
  COUNT_SEARCH_FTS: `
    SELECT COUNT(DISTINCT p.id) as total FROM programs p
    WHERE p.rowid IN (
      SELECT rowid FROM programs_fts WHERE programs_fts MATCH ?
      UNION
      SELECT rowid FROM programs WHERE name LIKE '%' || ? || '%'
    );
  `,
  FIND_ALL: "SELECT * FROM programs ORDER BY name ASC LIMIT ? OFFSET ?;",
  COUNT_ALL: "SELECT COUNT(id) as total FROM programs;",
  CREATE: "INSERT INTO programs (id, external_id, name) VALUES (?, ?, ?);",
  FIND_BY_ID: "SELECT * FROM programs WHERE id = ?;",
};

// ============================================================
// Repository Class
// ============================================================

export class ProgramRepository {
  constructor(private db: DatabaseConnection) {}

  public async create(programData: Omit<Program, "id">): Promise<Program> {
    const newId = this.db.helpers.generateId();
    const newProgram: Program = { id: newId, ...programData };
    await this.db.run(SQL_QUERIES.CREATE, [
      newProgram.id,
      newProgram.external_id,
      newProgram.name,
    ]);
    return newProgram;
  }

  public findById(id: string): Promise<Program | null> {
    return this.db.get<Program>(SQL_QUERIES.FIND_BY_ID, [id]);
  }

  public async search(
    term: string,
    page: number,
    limit: number,
  ): Promise<Pagination<Program>> {
    const offset = this.db.helpers.calculateOffset(page, limit);
    const searchTerm = term.trim();

    if (!searchTerm) {
      return this.findAll(page, limit);
    }

    // Use FTS for terms longer than 2 chars that are not purely numeric
    const useFts = searchTerm.length > 2 && !/^\d+$/.test(searchTerm);
    let items: Program[];
    let total: number;

    if (useFts) {
      const sanitizedQuery = this.db.helpers.sanitizeSearchQuery(searchTerm);
      const [results, countResult] = await Promise.all([
        this.db.getAll<Program>(SQL_QUERIES.SEARCH_FTS, [
          sanitizedQuery,
          searchTerm,
          searchTerm,
          searchTerm,
          limit,
          offset,
        ]),
        this.db.get<{ total: number }>(SQL_QUERIES.COUNT_SEARCH_FTS, [
          sanitizedQuery,
          searchTerm,
        ]),
      ]);
      items = results;
      total = countResult?.total ?? 0;
    } else {
      const [results, countResult] = await Promise.all([
        this.db.getAll<Program>(SQL_QUERIES.SEARCH_LIKE, [
          searchTerm,
          searchTerm,
          searchTerm,
          limit,
          offset,
        ]),
        this.db.get<{ total: number }>(SQL_QUERIES.COUNT_SEARCH_LIKE, [
          searchTerm,
        ]),
      ]);
      items = results;
      total = countResult?.total ?? 0;
    }

    return this.db.helpers.createPaginationInfo(items, page, limit, total);
  }

  public async findAll(
    page: number,
    limit: number,
  ): Promise<Pagination<Program>> {
    const offset = this.db.helpers.calculateOffset(page, limit);
    const [items, countResult] = await Promise.all([
      this.db.getAll<Program>(SQL_QUERIES.FIND_ALL, [limit, offset]),
      this.db.get<{ total: number }>(SQL_QUERIES.COUNT_ALL),
    ]);
    const total = countResult?.total ?? 0;
    return this.db.helpers.createPaginationInfo(items, page, limit, total);
  }
}
