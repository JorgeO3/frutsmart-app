import { database } from "@adapters/repository/Database";
import type {
  ClassificationSummaryRow,
  HarvestCriteriaRow,
} from "@adapters/repository/types";

// Define la estructura de datos que el servicio devolverá.
export interface DailySummary {
  totalBunches: number;
  externalClassification: ClassificationSummaryRow[];
  harvestCriteria: HarvestCriteriaRow[];
  internalClassification: ClassificationSummaryRow[];
}

class SummaryService {
  /**
   * Obtiene todos los datos de resumen necesarios para la pantalla de fin de día.
   * @param date - La fecha para la cual se generará el resumen, en formato 'YYYY-MM-DD'.
   * @returns Un objeto con todos los datos de resumen.
   */
  public async getDailySummary(date: string): Promise<DailySummary> {
    const { reportQueries } = database;

    try {
      // 1. Ejecuta todas las consultas de resumen en paralelo para mayor eficiencia.
      const [externalClassification, harvestCriteria, internalClassification] =
        await Promise.all([
          reportQueries.getExternalClassificationTotal(date),
          reportQueries.getHarvestCriteriaTotal(date),
          reportQueries.getInternalClassificationTotal(date),
        ]);

      // 2. Calcula el número total de racimos clasificados.
      // Se puede inferir de la suma de las clasificaciones externas.
      const totalBunches = externalClassification.reduce(
        (sum, row) => sum + row.count,
        0,
      );

      // 3. Devuelve el objeto de datos consolidado.
      return {
        totalBunches,
        externalClassification,
        harvestCriteria,
        internalClassification,
      };
    } catch (error) {
      console.error("Error al obtener el resumen diario:", error);
      // Relanza el error para que la UI pueda manejarlo.
      throw new Error("No se pudieron cargar los datos del resumen.");
    }
  }
}

// Se exporta una única instancia del servicio (patrón Singleton).
export const summaryService = new SummaryService();
