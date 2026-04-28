import type { DatabaseConnection } from "../database/DatabaseConnection";
import type { Lot, Pagination } from "../types";

// ============================================================
// SQL Queries
// ============================================================

const SQL_QUERIES = {
  // Búsqueda para términos cortos donde FTS5 no es eficiente
  SEARCH_LIKE: `
    SELECT * FROM lots 
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
  // Búsqueda híbrida (FTS5 + LIKE) para términos más largos
  SEARCH_FTS: `
    SELECT DISTINCT l.* FROM lots l
    WHERE l.rowid IN (
      SELECT rowid FROM lots_fts WHERE lots_fts MATCH ?
      UNION
      SELECT rowid FROM lots WHERE name LIKE '%' || ? || '%'
    )
    ORDER BY 
      CASE 
        WHEN l.name = ? THEN 0 
        WHEN l.name LIKE ? || '%' THEN 1 
        ELSE 2 
      END, 
      LENGTH(l.name), name
    LIMIT ? OFFSET ?;
  `,
  FIND_ALL: "SELECT * FROM lots ORDER BY name ASC LIMIT ? OFFSET ?;",
  COUNT_ALL: "SELECT COUNT(id) as total FROM lots;",
  COUNT_SEARCH_LIKE:
    "SELECT COUNT(id) as total FROM lots WHERE name LIKE '%' || ? || '%';",
  COUNT_SEARCH_FTS: `
    SELECT COUNT(DISTINCT l.id) as total FROM lots l
    WHERE l.rowid IN (
      SELECT rowid FROM lots_fts WHERE lots_fts MATCH ?
      UNION
      SELECT rowid FROM lots WHERE name LIKE '%' || ? || '%'
    );
  `,
  // Otras queries CRUD
  CREATE: "INSERT INTO lots (id, external_id, name) VALUES (?, ?, ?);",
  FIND_BY_ID: "SELECT * FROM lots WHERE id = ?;",
};

// ============================================================
// Repository Class
// ============================================================

export class LotRepository {
  constructor(private db: DatabaseConnection) {}

  public async create(lot: Omit<Lot, "id">): Promise<Lot> {
    const newId = this.db.helpers.generateId();
    const newLot: Lot = { id: newId, ...lot };
    await this.db.run(SQL_QUERIES.CREATE, [newLot.id, newLot.name]);
    return newLot;
  }

  public findById(id: string): Promise<Lot | null> {
    return this.db.get<Lot>(SQL_QUERIES.FIND_BY_ID, [id]);
  }

  public async search(
    term: string,
    page: number,
    limit: number,
  ): Promise<Pagination<Lot>> {
    const offset = this.db.helpers.calculateOffset(page, limit);
    const searchTerm = term.trim();

    if (!searchTerm) {
      return this.findAll(page, limit);
    }

    const useFts = searchTerm.length > 2 && !/^\d+$/.test(searchTerm);

    let items: Lot[];
    let total: number;

    if (useFts) {
      const sanitizedQuery = this.db.helpers.sanitizeSearchQuery(searchTerm);
      const [results, countResult] = await Promise.all([
        this.db.getAll<Lot>(SQL_QUERIES.SEARCH_FTS, [
          sanitizedQuery,
          `%${searchTerm}%`,
          searchTerm,
          `${searchTerm}%`,
          limit,
          offset,
        ]),
        this.db.get<{ total: number }>(SQL_QUERIES.COUNT_SEARCH_FTS, [
          sanitizedQuery,
          `%${searchTerm}%`,
        ]),
      ]);
      items = results;
      total = countResult?.total ?? 0;
    } else {
      const [results, countResult] = await Promise.all([
        this.db.getAll<Lot>(SQL_QUERIES.SEARCH_LIKE, [
          `%${searchTerm}%`,
          searchTerm,
          `${searchTerm}%`,
          limit,
          offset,
        ]),
        this.db.get<{ total: number }>(SQL_QUERIES.COUNT_SEARCH_LIKE, [
          `%${searchTerm}%`,
        ]),
      ]);
      items = results;
      total = countResult?.total ?? 0;
    }

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  public async findAll(page: number, limit: number): Promise<Pagination<Lot>> {
    const offset = this.db.helpers.calculateOffset(page, limit);
    const [items, countResult] = await Promise.all([
      this.db.getAll<Lot>(SQL_QUERIES.FIND_ALL, [limit, offset]),
      this.db.get<{ total: number }>(SQL_QUERIES.COUNT_ALL),
    ]);

    const total = countResult?.total ?? 0;

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
