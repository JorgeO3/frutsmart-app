import { database } from "@adapters/repository/Database";
import type { Lot, Program, QualityAnalysis } from "@adapters/repository/types";

/**
 * Proporciona una API centralizada para realizar búsquedas en la base de datos de "Planta".
 * Desacopla la lógica de búsqueda de los componentes de la UI y los repositorios.
 */
export class SearchService {
  /**
   * Busca programas de forma paginada.
   * @param term El término de búsqueda.
   * @param page El número de página actual.
   * @param limit El número de resultados por página.
   * @returns Una promesa que resuelve a un array de Programas.
   */
  public async searchPrograms(
    term: string,
    page: number,
    limit: number,
  ): Promise<Program[]> {
    // Llama al método del repositorio que devuelve un objeto de paginación completo.
    const result = await database.programs.search(term, page, limit);

    // Devuelve solo el array de 'items', que es lo que el hook de UI esperaría.
    return result.items;
  }

  /**
   * Busca lotes dentro de un programa específico de forma paginada.
   * @param term El término de búsqueda.
   * @param page El número de página actual.
   * @param limit El número de resultados por página.
   * @param programId El ID del programa por el cual filtrar los lotes.
   * @returns Una promesa que resuelve a un array de Lotes.
   */
  public async searchLots(
    term: string,
    page: number,
    limit: number,
    programId: string,
  ): Promise<Lot[]> {
    const result = await database.lots.search(term, page, limit, programId);
    return result.items;
  }

  /**
   * Busca análisis de calidad de forma paginada.
   * @param term El término de búsqueda (ej. placa, QR, consecutivo).
   * @param page El número de página actual.
   * @param limit El número de resultados por página.
   * @returns Una promesa que resuelve a un array de QualityAnalysis.
   */
  public async searchAnalyses(
    term: string,
    page: number,
    limit: number,
  ): Promise<QualityAnalysis[]> {
    // Nota: Esto asume que existe un método .search() en QualityAnalysisRepository.
    // const result = await database.qualityAnalyses.search(term, page, limit);
    // return result.items;
    return []; // Placeholder hasta que se implemente la búsqueda real.
  }
}

/**
 * Instancia única del servicio de búsqueda para ser usada en toda la aplicación.
 */
export const searchService = new SearchService();
