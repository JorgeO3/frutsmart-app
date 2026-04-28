import type { DatabaseConnection } from "../database/DatabaseConnection";
import type { Pagination, Report } from "../types";

// ============================================================
// SQL Queries for the 'reports' table
// ============================================================

const SQL_QUERIES = {
  FIND_BY_ID: `
    SELECT * FROM reports WHERE id = ?;
  `,
  FIND_BY_REPORT_ID: `
    SELECT * FROM reports WHERE report_id = ?;
  `,
  FIND_BY_ANALYSIS_ID: `
    SELECT * FROM reports WHERE quality_analysis_id = ?;
  `,
  FIND_ALL: `
    SELECT * FROM reports ORDER BY report_date DESC LIMIT ? OFFSET ?;
  `,
  COUNT_ALL: `
    SELECT COUNT(id) as total FROM reports;
  `,
  FIND_BY_DATE_RANGE: `
    SELECT * FROM reports WHERE report_date BETWEEN ? AND ? ORDER BY report_date DESC LIMIT ? OFFSET ?;
  `,
  COUNT_BY_DATE_RANGE: `
    SELECT COUNT(id) as total FROM reports WHERE report_date BETWEEN ? AND ?;
  `,
};

// ============================================================
// Repository Class
// ============================================================

/**
 * Manages read operations for the 'reports' table.
 * Note: Report creation is handled automatically by a database trigger.
 */
export class ReportRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Finds a report by its primary key (UUID).
   * @param id The UUID of the report.
   * @returns The report entity if found, otherwise null.
   */
  public findById(id: string): Promise<Report | null> {
    return this.db.get<Report>(SQL_QUERIES.FIND_BY_ID, [id]);
  }

  /**
   * Finds a report by its user-facing readable ID.
   * @param reportId The readable ID (e.g., "ID-250908-A4F1B0E3").
   * @returns The report entity if found, otherwise null.
   */
  public findByReportId(reportId: string): Promise<Report | null> {
    return this.db.get<Report>(SQL_QUERIES.FIND_BY_REPORT_ID, [reportId]);
  }

  /**
   * Finds the specific report associated with a quality analysis.
   * @param analysisId The ID of the parent quality_analysis.
   * @returns The report entity if found, otherwise null.
   */
  public findByQualityAnalysisId(analysisId: string): Promise<Report | null> {
    return this.db.get<Report>(SQL_QUERIES.FIND_BY_ANALYSIS_ID, [analysisId]);
  }

  /**
   * Retrieves a paginated list of all reports, ordered by most recent.
   * @param page The page number to retrieve.
   * @param limit The number of items per page.
   * @returns A pagination object with the list of reports.
   */
  public async findAll(
    page: number,
    limit: number,
  ): Promise<Pagination<Report>> {
    const offset = this.db.helpers.calculateOffset(page, limit);
    const [items, countResult] = await Promise.all([
      this.db.getAll<Report>(SQL_QUERIES.FIND_ALL, [limit, offset]),
      this.db.get<{ total: number }>(SQL_QUERIES.COUNT_ALL),
    ]);
    const total = countResult?.total ?? 0;
    return this.db.helpers.createPaginationInfo(items, page, limit, total);
  }

  /**
   * Retrieves a paginated list of all reports within a specific date range.
   * @param startDate The start date of the range (e.g., "2025-09-01").
   * @param endDate The end date of the range (e.g., "2025-09-30").
   * @param page The page number to retrieve.
   * @param limit The number of items per page.
   * @returns A pagination object with the list of reports.
   */
  public async findByDateRange(
    startDate: string,
    endDate: string,
    page: number,
    limit: number,
  ): Promise<Pagination<Report>> {
    const offset = this.db.helpers.calculateOffset(page, limit);
    const [items, countResult] = await Promise.all([
      this.db.getAll<Report>(SQL_QUERIES.FIND_BY_DATE_RANGE, [
        startDate,
        endDate,
        limit,
        offset,
      ]),
      this.db.get<{ total: number }>(SQL_QUERIES.COUNT_BY_DATE_RANGE, [
        startDate,
        endDate,
      ]),
    ]);
    const total = countResult?.total ?? 0;
    return this.db.helpers.createPaginationInfo(items, page, limit, total);
  }
}
