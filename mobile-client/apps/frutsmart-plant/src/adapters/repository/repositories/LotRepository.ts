import type { DatabaseConnection } from "../database/DatabaseConnection";
import type { Lot, Pagination } from "../types";

// ============================================================
// SQL Queries for 'lots' table
// ============================================================
// biome-ignore format: readability
const SQL_QUERIES = {
  // Queries for finding lots within a specific program
  FIND_ALL_BY_PROGRAM: "SELECT * FROM lots WHERE program_id = ? ORDER BY name ASC LIMIT ? OFFSET ?;",
  COUNT_ALL_BY_PROGRAM: "SELECT COUNT(id) as total FROM lots WHERE program_id = ?;",
  
  // Search queries filtered by program_id
  SEARCH_LIKE_BY_PROGRAM: `
    SELECT * FROM lots
    WHERE program_id = ? AND name LIKE '%' || ? || '%'
    ORDER BY
      CASE WHEN name = ? THEN 0 WHEN name LIKE ? || '%' THEN 1 ELSE 2 END,
      LENGTH(name), name
    LIMIT ? OFFSET ?;
  `,
  SEARCH_FTS_BY_PROGRAM: `
    SELECT DISTINCT l.* FROM lots l
    WHERE l.program_id = ? AND l.rowid IN (
      SELECT rowid FROM lots_fts WHERE lots_fts MATCH ?
      UNION
      SELECT rowid FROM lots WHERE name LIKE '%' || ? || '%'
    )
    ORDER BY
      CASE WHEN l.name = ? THEN 0 WHEN l.name LIKE ? || '%' THEN 1 ELSE 2 END,
      LENGTH(l.name), l.name
    LIMIT ? OFFSET ?;
  `,
  COUNT_SEARCH_LIKE_BY_PROGRAM: "SELECT COUNT(id) as total FROM lots WHERE program_id = ? AND name LIKE '%' || ? || '%';",
  COUNT_SEARCH_FTS_BY_PROGRAM: `
    SELECT COUNT(DISTINCT l.id) as total FROM lots l
    WHERE l.program_id = ? AND l.rowid IN (
      SELECT rowid FROM lots_fts WHERE lots_fts MATCH ?
      UNION
      SELECT rowid FROM lots WHERE name LIKE '%' || ? || '%'
    );
  `,

  // Standard CRUD and global list/search queries
  CREATE: "INSERT INTO lots (id, external_id, name, program_id) VALUES (?, ?, ?, ?);",
  FIND_BY_ID: "SELECT * FROM lots WHERE id = ?;",
  FIND_ALL: "SELECT * FROM lots ORDER BY name ASC LIMIT ? OFFSET ?;", // Global find all
  COUNT_ALL: "SELECT COUNT(id) as total FROM lots;", // Global count
};

// ============================================================
// Repository Class
// ============================================================

export class LotRepository {
  constructor(private db: DatabaseConnection) {}

  public async create(lotData: Omit<Lot, "id">): Promise<Lot> {
    const newId = this.db.helpers.generateId();
    const newLot: Lot = { id: newId, ...lotData };
    await this.db.run(SQL_QUERIES.CREATE, [
      newLot.id,
      newLot.external_id,
      newLot.name,
      newLot.program_id,
    ]);
    return newLot;
  }

  public findById(id: string): Promise<Lot | null> {
    return this.db.get<Lot>(SQL_QUERIES.FIND_BY_ID, [id]);
  }

  public async findAllByProgram(
    programId: string,
    page: number,
    limit: number,
  ): Promise<Pagination<Lot>> {
    const offset = this.db.helpers.calculateOffset(page, limit);
    const [items, countResult] = await Promise.all([
      this.db.getAll<Lot>(SQL_QUERIES.FIND_ALL_BY_PROGRAM, [
        programId,
        limit,
        offset,
      ]),
      this.db.get<{ total: number }>(SQL_QUERIES.COUNT_ALL_BY_PROGRAM, [
        programId,
      ]),
    ]);
    const total = countResult?.total ?? 0;
    return this.db.helpers.createPaginationInfo(items, page, limit, total);
  }

  public async search(
    term: string,
    page: number,
    limit: number,
    programId: string, // The program context for the search
  ): Promise<Pagination<Lot>> {
    const offset = this.db.helpers.calculateOffset(page, limit);
    const searchTerm = term.trim();

    // If no search term, just return all lots for the given program
    if (!searchTerm) {
      return this.findAllByProgram(programId, page, limit);
    }

    const useFts = searchTerm.length > 2 && !/^\d+$/.test(searchTerm);
    let items: Lot[];
    let total: number;

    if (useFts) {
      const sanitizedQuery = this.db.helpers.sanitizeSearchQuery(searchTerm);
      const [results, countResult] = await Promise.all([
        this.db.getAll<Lot>(SQL_QUERIES.SEARCH_FTS_BY_PROGRAM, [
          programId,
          sanitizedQuery,
          searchTerm,
          searchTerm,
          searchTerm,
          limit,
          offset,
        ]),
        this.db.get<{ total: number }>(
          SQL_QUERIES.COUNT_SEARCH_FTS_BY_PROGRAM,
          [programId, sanitizedQuery, searchTerm],
        ),
      ]);
      items = results;
      total = countResult?.total ?? 0;
    } else {
      const [results, countResult] = await Promise.all([
        this.db.getAll<Lot>(SQL_QUERIES.SEARCH_LIKE_BY_PROGRAM, [
          programId,
          searchTerm,
          searchTerm,
          searchTerm,
          limit,
          offset,
        ]),
        this.db.get<{ total: number }>(
          SQL_QUERIES.COUNT_SEARCH_LIKE_BY_PROGRAM,
          [programId, searchTerm],
        ),
      ]);
      items = results;
      total = countResult?.total ?? 0;
    }
    return this.db.helpers.createPaginationInfo(items, page, limit, total);
  }

  // A global findAll might be useful for admin purposes, but is not required by the main flow
  public async findAll(page: number, limit: number): Promise<Pagination<Lot>> {
    const offset = this.db.helpers.calculateOffset(page, limit);
    const [items, countResult] = await Promise.all([
      this.db.getAll<Lot>(SQL_QUERIES.FIND_ALL, [limit, offset]),
      this.db.get<{ total: number }>(SQL_QUERIES.COUNT_ALL),
    ]);
    const total = countResult?.total ?? 0;
    return this.db.helpers.createPaginationInfo(items, page, limit, total);
  }
}
