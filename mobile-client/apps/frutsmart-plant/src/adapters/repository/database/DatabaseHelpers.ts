import type { Pagination } from "../types-backup";

/**
 * Utilidades comunes para operaciones de base de datos
 */
export class DatabaseHelpers {
  /**
   * Genera un ID único para las entidades
   */
  generateId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 9);
    return `${timestamp}-${randomStr}`;
  }

  /**
   * Calcula el offset para paginación
   */
  calculateOffset(page: number, limit: number): number {
    return Math.max(0, (page - 1) * limit);
  }

  /**
   * Convierte un booleano a formato SQLite (0 o 1)
   */
  booleanToSqlite(value: boolean): number {
    return value ? 1 : 0;
  }

  /**
   * Convierte un valor SQLite a booleano
   */
  sqliteToBoolean(value: number): boolean {
    return value === 1;
  }

  /**
   * Sanitiza una cadena de búsqueda para FTS5
   */
  sanitizeSearchQuery(query: string): string {
    const trimmed = query.trim();
    if (!trimmed) return "";

    // Elimina caracteres especiales y añade wildcard
    return `${trimmed.replace(/[^a-zA-Z0-9\s]/g, "")}*`;
  }

  /**
   * Extrae el nombre de archivo de una URI
   */
  extractFilenameFromUri(uri: string): string {
    return uri.split("/").pop() || "";
  }

  /**
   * Formatea una fecha para uso en SQL
   */
  formatDateForSQL(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  /**
   * Formatea un timestamp para uso en SQL
   */
  formatTimestampForSQL(date: Date): string {
    return date.toISOString();
  }

  /**
   * Agrupa elementos por una clave
   */
  groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce(
      (result, item) => {
        const groupKey = String(item[key]);
        if (!result[groupKey]) {
          result[groupKey] = [];
        }
        result[groupKey].push(item);
        return result;
      },
      {} as Record<string, T[]>,
    );
  }

  /**
   * Convierte un objeto a JSON para almacenamiento
   */
  toJSON(value: unknown): string {
    return JSON.stringify(value);
  }

  /**
   * Parsea JSON de la base de datos
   */
  fromJSON<T>(value: string | null): T | null {
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Escapa caracteres especiales en LIKE queries
   */
  escapeLikePattern(pattern: string): string {
    return pattern.replace(/[%_]/g, "\\$&");
  }

  /**
   * Construye condiciones WHERE para búsqueda
   */
  buildSearchConditions(
    searchTerm: string,
    columns: string[],
  ): {
    sql: string;
    params: string[];
  } {
    if (!searchTerm || columns.length === 0) {
      return { sql: "1=1", params: [] };
    }

    const conditions = columns.map((col) => `${col} LIKE ?`).join(" OR ");
    const params = columns.map(() => `%${this.escapeLikePattern(searchTerm)}%`);

    return { sql: `(${conditions})`, params };
  }

  /**
   * Valida si un string es un ID válido
   */
  isValidId(id: string): boolean {
    // Formato: timestamp-random
    return /^[a-z0-9]+-[a-z0-9]+$/.test(id);
  }

  /**
   * Crea información de paginación
   */
  createPaginationInfo<T>(
    items: T[],
    page: number,
    limit: number,
    total: number,
  ): Pagination<T> {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }
}
