import type { DatabaseConnection } from "../database/DatabaseConnection";
import type { Report } from "../types";

// ============================================================
// SQL Queries
// ============================================================

const SQL_QUERIES = {
  // Inserta o reemplaza un reporte si ya existe para esa fecha
  CREATE_OR_UPDATE: `
    INSERT INTO reports (report_date, report_data_json) 
    VALUES (?, ?)
    ON CONFLICT(report_date) DO UPDATE SET
      report_data_json = excluded.report_data_json;
  `,
  FIND_BY_DATE_RANGE: `
    SELECT * FROM reports 
    WHERE report_date BETWEEN ? AND ? 
    ORDER BY report_date ASC;
  `,
  FIND_BY_DATE: "SELECT * FROM reports WHERE report_date = ?;",
};

// ============================================================
// Repository Class
// ============================================================

export class ReportRepository {
  constructor(private db: DatabaseConnection) {}

  public async save(report: Report): Promise<void> {
    await this.db.run(SQL_QUERIES.CREATE_OR_UPDATE, [
      report.report_date,
      report.report_data_json,
    ]);
  }

  public findByDate(date: string): Promise<Report | null> {
    return this.db.get<Report>(SQL_QUERIES.FIND_BY_DATE, [date]);
  }

  public findByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<Report[]> {
    return this.db.getAll<Report>(SQL_QUERIES.FIND_BY_DATE_RANGE, [
      startDate,
      endDate,
    ]);
  }
}
