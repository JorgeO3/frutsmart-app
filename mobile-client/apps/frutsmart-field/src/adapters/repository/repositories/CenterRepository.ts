import type { DatabaseConnection } from "../database/DatabaseConnection";
import type { Center, Pagination } from "../types";

// ============================================================
// SQL Queries
// ============================================================

const SQL_QUERIES = {
  // Búsqueda LIKE para términos cortos o numéricos, con ordenamiento por relevancia.
  SEARCH_LIKE: `
    SELECT * FROM centers
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
  // Búsqueda híbrida (FTS5 + LIKE) para una mayor relevancia y velocidad.
  SEARCH_FTS: `
    SELECT DISTINCT c.* FROM centers c
    WHERE c.rowid IN (
      SELECT rowid FROM centers_fts WHERE centers_fts MATCH ?
      UNION
      SELECT rowid FROM centers WHERE name LIKE '%' || ? || '%'
    )
    ORDER BY
      CASE
        WHEN c.name = ? THEN 0
        WHEN c.name LIKE ? || '%' THEN 1
        ELSE 2
      END,
      LENGTH(c.name), c.name
    LIMIT ? OFFSET ?;
  `,
  // Queries para contar el total de resultados en una búsqueda para la paginación.
  COUNT_SEARCH_LIKE: `SELECT COUNT(id) as total FROM centers WHERE name LIKE '%' || ? || '%';`,
  COUNT_SEARCH_FTS: `
    SELECT COUNT(DISTINCT c.id) as total FROM centers c
    WHERE c.rowid IN (
      SELECT rowid FROM centers_fts WHERE centers_fts MATCH ?
      UNION
      SELECT rowid FROM centers WHERE name LIKE '%' || ? || '%'
    );
  `,
  FIND_ALL_BY_LOT:
    "SELECT * FROM centers WHERE lot_id = ? ORDER BY name ASC LIMIT ? OFFSET ?;",
  COUNT_ALL_BY_LOT: "SELECT COUNT(id) as total FROM centers WHERE lot_id = ?;",
  SEARCH_LIKE_BY_LOT: `
    SELECT * FROM centers
    WHERE lot_id = ? AND name LIKE '%' || ? || '%'
    ORDER BY
      CASE
        WHEN name = ? THEN 0
        WHEN name LIKE ? || '%' THEN 1
        ELSE 2
      END,
      LENGTH(name), name
    LIMIT ? OFFSET ?;
  `,
  SEARCH_FTS_BY_LOT: `
    SELECT DISTINCT c.* FROM centers c
    WHERE c.rowid IN (
      SELECT rowid FROM centers_fts WHERE lot_id = ? AND centers_fts MATCH ?
      UNION
      SELECT rowid FROM centers WHERE lot_id = ? AND name LIKE '%' || ? || '%'
    )
    ORDER BY
      CASE
        WHEN c.name = ? THEN 0
        WHEN c.name LIKE ? || '%' THEN 1
        ELSE 2
      END,
      LENGTH(c.name), c.name
    LIMIT ? OFFSET ?;
  `,
  COUNT_SEARCH_LIKE_BY_LOT: `SELECT COUNT(id) as total FROM centers WHERE lot_id = ? AND name LIKE '%' || ? || '%';`,
  COUNT_SEARCH_FTS_BY_LOT: `
    SELECT COUNT(DISTINCT c.id) as total FROM centers c
    WHERE c.rowid IN (
      SELECT rowid FROM centers_fts WHERE lot_id = ? AND centers_fts MATCH ?
      UNION
      SELECT rowid FROM centers WHERE lot_id = ? AND name LIKE '%' || ? || '%'
    );
  `,
  // Queries CRUD y de listado estándar.
  FIND_ALL: "SELECT * FROM centers ORDER BY name ASC LIMIT ? OFFSET ?;",
  COUNT_ALL: "SELECT COUNT(id) as total FROM centers;",
  FIND_BY_LOT_ID: "SELECT * FROM centers WHERE lot_id = ? ORDER BY name ASC;",
  CREATE: "INSERT INTO centers (id, name, lot_id) VALUES (?, ?, ?);",
  FIND_BY_ID: "SELECT * FROM centers WHERE id = ?;",
};

// ============================================================
// Repository Class
// ============================================================

/**
 * Repositorio para gestionar las operaciones de la entidad 'Center'.
 */
export class CenterRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Crea un nuevo centro en la base de datos.
   * @param centerData - Objeto con el nombre y el lot_id del centro.
   * @returns El objeto Center completo con su nuevo ID.
   */
  public async create(centerData: Omit<Center, "id">): Promise<Center> {
    const newId = this.db.helpers.generateId();
    const newCenter: Center = { id: newId, ...centerData };
    await this.db.run(SQL_QUERIES.CREATE, [
      newCenter.id,
      newCenter.name,
      newCenter.lot_id,
    ]);
    return newCenter;
  }

  /**
   * Busca un centro por su ID.
   * @param id - El ID del centro a buscar.
   * @returns El objeto Center si se encuentra, de lo contrario null.
   */
  public findById(id: string): Promise<Center | null> {
    return this.db.get<Center>(SQL_QUERIES.FIND_BY_ID, [id]);
  }

  /**
   * Obtiene todos los centros asociados a un lote específico.
   * @param lotId - El ID del lote.
   * @returns Un array de objetos Center.
   */
  public findByLotId(lotId: string): Promise<Center[]> {
    return this.db.getAll<Center>(SQL_QUERIES.FIND_BY_LOT_ID, [lotId]);
  }

  public async findAllByLot(
    lotId: string,
    page: number,
    limit: number,
  ): Promise<Pagination<Center>> {
    const offset = this.db.helpers.calculateOffset(page, limit);
    const [items, countResult] = await Promise.all([
      this.db.getAll<Center>(SQL_QUERIES.FIND_ALL_BY_LOT, [
        lotId,
        limit,
        offset,
      ]),
      this.db.get<{ total: number }>(SQL_QUERIES.COUNT_ALL_BY_LOT, [lotId]),
    ]);
    const total = countResult?.total ?? 0;
    return this.db.helpers.createPaginationInfo(items, page, limit, total);
  }

  /**
   * Realiza una búsqueda de centros por un término, con paginación.
   * Utiliza una estrategia de búsqueda híbrida (FTS5 y LIKE) para optimizar la relevancia.
   * @param term - El término de búsqueda.
   * @param page - El número de página (empezando en 1).
   * @param limit - El número de resultados por página.
   * @returns Un objeto de paginación con los centros encontrados.
   */
  public async search(
    term: string,
    page: number,
    limit: number,
    lotId?: string,
  ): Promise<Pagination<Center>> {
    const offset = this.db.helpers.calculateOffset(page, limit);
    const searchTerm = term.trim();

    // If a lotId is provided, search within that specific lot
    if (lotId) {
      if (!searchTerm) {
        return this.findAllByLot(lotId, page, limit);
      }

      const useFts = searchTerm.length > 2 && !/^\d+$/.test(searchTerm);
      let items: Center[];
      let total: number;

      if (useFts) {
        const sanitizedQuery = this.db.helpers.sanitizeSearchQuery(searchTerm);
        const [results, countResult] = await Promise.all([
          this.db.getAll<Center>(SQL_QUERIES.SEARCH_FTS_BY_LOT, [
            lotId,
            sanitizedQuery,
            lotId,
            searchTerm,
            searchTerm,
            searchTerm,
            limit,
            offset,
          ]),
          this.db.get<{ total: number }>(SQL_QUERIES.COUNT_SEARCH_FTS_BY_LOT, [
            lotId,
            sanitizedQuery,
            lotId,
            searchTerm,
          ]),
        ]);
        items = results;
        total = countResult?.total ?? 0;
      } else {
        const [results, countResult] = await Promise.all([
          this.db.getAll<Center>(SQL_QUERIES.SEARCH_LIKE_BY_LOT, [
            lotId,
            searchTerm,
            searchTerm,
            searchTerm,
            limit,
            offset,
          ]),
          this.db.get<{ total: number }>(SQL_QUERIES.COUNT_SEARCH_LIKE_BY_LOT, [
            lotId,
            searchTerm,
          ]),
        ]);
        items = results;
        total = countResult?.total ?? 0;
      }
      return this.db.helpers.createPaginationInfo(items, page, limit, total);
    }

    // Fallback to original behavior if no lotId is provided
    if (!searchTerm) {
      return this.findAll(page, limit);
    }

    const useFtsGlobal = searchTerm.length > 2 && !/^\d+$/.test(searchTerm);
    let itemsGlobal: Center[];
    let totalGlobal: number;

    if (useFtsGlobal) {
      const sanitizedQuery = this.db.helpers.sanitizeSearchQuery(searchTerm);
      const [results, countResult] = await Promise.all([
        this.db.getAll<Center>(SQL_QUERIES.SEARCH_FTS, [
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
      itemsGlobal = results;
      totalGlobal = countResult?.total ?? 0;
    } else {
      const [results, countResult] = await Promise.all([
        this.db.getAll<Center>(SQL_QUERIES.SEARCH_LIKE, [
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
      itemsGlobal = results;
      totalGlobal = countResult?.total ?? 0;
    }
    return this.db.helpers.createPaginationInfo(
      itemsGlobal,
      page,
      limit,
      totalGlobal,
    );
  }

  /**
   * Obtiene una lista paginada de todos los centros.
   * @param page - El número de página (empezando en 1).
   * @param limit - El número de resultados por página.
   * @returns Un objeto de paginación con los centros.
   */
  public async findAll(
    page: number,
    limit: number,
  ): Promise<Pagination<Center>> {
    const offset = this.db.helpers.calculateOffset(page, limit);
    const [items, countResult] = await Promise.all([
      this.db.getAll<Center>(SQL_QUERIES.FIND_ALL, [limit, offset]),
      this.db.get<{ total: number }>(SQL_QUERIES.COUNT_ALL),
    ]);

    const total = countResult?.total ?? 0;
    return this.db.helpers.createPaginationInfo(items, page, limit, total);
  }
}
