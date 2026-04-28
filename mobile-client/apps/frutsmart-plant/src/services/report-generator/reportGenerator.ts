import { type ReportType, createReportStrategy } from "./ReportStrategyFactory";
import type { ReportParams } from "./strategies/IReportStrategy";

export class ReportGeneratorService {
  /**
   * Genera un reporte basado en un tipo y parámetros.
   * Utiliza una fábrica para crear la estrategia adecuada.
   * @param type - El tipo de reporte a generar ('summary', 'detail', etc.).
   * @param params - Los parámetros para ese reporte.
   * @returns El string HTML del reporte generado.
   */
  public async generateReport(
    type: ReportType,
    params: ReportParams,
  ): Promise<string> {
    console.log(`Iniciando generación para el tipo de reporte: '${type}'`);
    try {
      // 1. La fábrica crea la instancia correcta.
      const strategy = createReportStrategy(type);

      // 2. El servicio ejecuta la estrategia.
      const reportHtml = await strategy.execute(params);

      console.log("Generación con estrategia completada.");
      return reportHtml;
    } catch (error) {
      console.error(
        `Error durante la generación del reporte tipo '${type}':`,
        error,
      );
      throw error;
    }
  }
}

export const reportGeneratorService = new ReportGeneratorService();
