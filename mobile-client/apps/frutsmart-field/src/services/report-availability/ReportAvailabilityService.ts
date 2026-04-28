import { database } from "@adapters/repository/Database";
import type { AvailableReportRow } from "@adapters/repository/types";

import type { AvailableReport } from "./types";

class ReportAvailabilityService {
  /**
   * Obtiene la lista de reportes que se pueden generar, con opción de filtrado.
   * @param startDate - Opcional. Si se provee una fecha, busca reportes desde esa fecha en adelante.
   */
  public async getAvailableReports(
    startDate?: Date,
  ): Promise<AvailableReport[]> {
    try {
      const dateString = this._formatDateForQuery(startDate);
      const rawReports = await this._fetchRawReports(dateString);

      // Mapea los resultados utilizando una función auxiliar
      return rawReports.map(this._mapRowToAvailableReport);
    } catch (error) {
      console.error(
        "Error al obtener las fechas de reportes disponibles:",
        error,
      );
      return [];
    }
  }

  /**
   * Formatea una fecha opcional al string YYYY-MM-DD requerido por la query.
   * @private
   */
  private _formatDateForQuery(date?: Date): string | undefined {
    return date ? date.toISOString().split("T")[0] : undefined;
  }

  /**
   * Obtiene los datos crudos de los reportes desde la base de datos.
   * @private
   */
  private async _fetchRawReports(
    dateString?: string,
  ): Promise<AvailableReportRow[]> {
    return database.reportQueries.getAvailableReports(dateString);
  }

  /**
   * Mapea una fila de la base de datos al formato de UI `AvailableReport`.
   * @private
   */
  private _mapRowToAvailableReport(row: AvailableReportRow): AvailableReport {
    // Se crea una fecha compatible con iOS/Android reemplazando guiones
    const date = new Date(row.report_date.replace(/-/g, "/"));

    return {
      id: row.id,
      reportId: row.report_id,
      reportDate: row.report_date,
      displayName: `Reporte del ${date.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`,
    };
  }
}

export const reportAvailabilityService = new ReportAvailabilityService();
