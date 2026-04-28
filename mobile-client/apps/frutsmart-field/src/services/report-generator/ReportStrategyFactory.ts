import type { IReportStrategy } from "./strategies/IReportStrategy";
import { SummaryReportStrategy } from "./strategies/summary"; // Importa desde el index.ts del módulo
import { DetailReportStrategy } from "./strategies/detail"; // Importa desde el index.ts del módulo

export type ReportType = "summary" | "detail";

export class ReportStrategyFactory {
  public static create(type: ReportType): IReportStrategy {
    switch (type) {
      case "summary":
        // La clase SummaryReportStrategy ahora vive en su propio módulo
        return new SummaryReportStrategy();
      case "detail":
        return new DetailReportStrategy();
      default:
        throw new Error(`Tipo de reporte no soportado: '${type}'`);
    }
  }
}
