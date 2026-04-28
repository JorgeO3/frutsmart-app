import type { Center, Lot } from "src/adapters/repository/types-backup";

/**
 * Representa un único resultado en una lista de búsqueda unificada.
 * La propiedad `type` nos permite diferenciar entre un Lote y un Centro en la UI.
 */
export type SearchResultItem =
  | (Lot & { type: "lot" })
  | (Center & { type: "center" });
