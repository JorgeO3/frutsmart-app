import { database } from "@adapters/repository/Database";
import type { Lot, Center } from "@adapters/repository/types";
import type { SearchResultItem } from "./types";

/**
 * Proporciona una API centralizada para realizar búsquedas en la base de datos.
 * Desacopla la lógica de búsqueda de los componentes de la UI y los repositorios.
 */
export class SearchService {
  /**
   * Busca lotes de forma paginada y adapta la respuesta para el hook `usePaginatedSearch`.
   * @param term El término de búsqueda.
   * @param page El número de página actual.
   * @param limit El número de resultados por página.
   * @returns Una promesa que resuelve a un array de Lotes.
   */
  public async searchLots(
    term: string,
    page: number,
    limit: number,
  ): Promise<Lot[]> {
    // Llama al método del repositorio que devuelve un objeto de paginación completo.
    const result = await database.lots.search(term, page, limit);

    // Devuelve solo el array de 'items', que es lo que el hook `usePaginatedSearch` espera.
    return result.items;
  }

  /**
   * Busca centros de forma paginada y adapta la respuesta para el hook `usePaginatedSearch`.
   * @param term El término de búsqueda.
   * @param page El número de página actual.
   * @param limit El número de resultados por página.
   * @param lotId El ID del lote por el cual filtrar los centros (opcional).
   * @returns Una promesa que resuelve a un array de Centros.
   */
  public async searchCenters(
    term: string,
    page: number,
    limit: number,
    lotId?: string, // Opcional, si se quiere filtrar por un lote específico
  ): Promise<Center[]> {
    const result = await database.centers.search(term, page, limit, lotId);
    return result.items;
  }

  /**
   * Realiza una búsqueda unificada de Lotes y Centros.
   * @param term El término de búsqueda.
   * @param page El número de página actual.
   * @param limit El número de resultados por página.
   * @returns Una promesa que resuelve a un array de `SearchResultItem`.
   */
  public async searchUnified(
    term: string,
    page: number,
    limit: number,
  ): Promise<SearchResultItem[]> {
    // Divide el límite de la página para obtener resultados de ambas fuentes.
    const halfLimit = Math.ceil(limit / 2);

    // Realiza ambas búsquedas en paralelo para mayor eficiencia.
    const [lotResults, centerResults] = await Promise.all([
      database.lots.search(term, page, halfLimit),
      database.centers.search(term, page, halfLimit),
    ]);

    // Mapea los resultados para añadirles una propiedad 'type' que los identifique.
    const lotsWithType: SearchResultItem[] = lotResults.items.map((lot) => ({
      ...lot,
      type: "lot",
    }));
    const centersWithType: SearchResultItem[] = centerResults.items.map(
      (center) => ({ ...center, type: "center" }),
    );

    // Combina y devuelve los resultados.
    // Podrías añadir lógica de ordenamiento aquí si fuera necesario.
    return [...lotsWithType, ...centersWithType];
  }
}

/**
 * Instancia única del servicio de búsqueda para ser usada en toda la aplicación.
 */
export const searchService = new SearchService();
