import type { IReportStrategy } from "./strategies/IReportStrategy";
import { PlantDetailReportStrategy } from "./strategies/plant"; // Importa desde el index.ts del módulo

export type ReportType = "plant";

export function createReportStrategy(type: ReportType): IReportStrategy {
  switch (type) {
    case "plant":
      return new PlantDetailReportStrategy();
    default:
      throw new Error(`Tipo de reporte no soportado: '${type}'`);
  }
}
