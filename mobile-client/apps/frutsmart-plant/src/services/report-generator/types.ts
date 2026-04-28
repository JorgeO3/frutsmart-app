import type { Lot, QualityAnalysis } from "@adapters/repository/types"; // Asumiendo la importación de los tipos base

// =============================================================================
// SECTION 1: CORE DATA MODELS
// Tipos que representan la estructura de datos que devuelve el ReportQueryRepository.
// =============================================================================

/**
 * Representa una de las 4 iteraciones (lanzamientos) de un análisis,
 * incluyendo sus fotos asociadas.
 */
export interface ReportIteration {
  iteration_index: number;
  internal_photo_uri: string | null;
  external_photo_uris: string[]; // URIs de los segmentos
}

/**
 * Representa el objeto de datos completo y anidado para un único reporte de análisis,
 * tal como lo construye el ReportQueryRepository.
 */
export interface ReportData extends QualityAnalysis {
  program: { id: string; name: string } | null;
  lots: Lot[];
  iterations: ReportIteration[];
}

// =============================================================================
// SECTION 2: VIEW-MODEL & HTML HELPER TYPES
// Tipos que se usan para pasar datos a las funciones que construyen el HTML.
// =============================================================================

/**
 * Objeto "View-Model" que agrupa todos los datos ya procesados y listos
 * para ser pasados al método principal que construye el cuerpo del HTML.
 */
export interface HtmlBodyPayload {
  generalInfo: ReportData; // La tabla de info general necesita casi todo el objeto ReportData
  externalSummary: Record<string, number>;
  internalSummary: Record<string, number>;
  criteriaSummary: Record<string, number | null>;
  iterations: ReportIteration[];
}

/**
 * Representa una fila en una tabla de resumen de clasificación (externa o interna).
 */
export interface ClassificationSummary {
  className: string;
  count: number;
}

/**
 * Representa una fila en la tabla de resumen de criterios de cosecha.
 */
export interface HarvestCriteriaSummary {
  criterion: string;
  count: number;
}

// =============================================================================
// SECTION 3: UTILITY & ASSET TYPES
// =============================================================================

/**
 * Define los posibles temas de color para las tablas en el reporte.
 */
export type TableVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "quaternary"
  | "details";

/**
 * Define la estructura del objeto que contiene las rutas a los assets
 * estáticos (CSS, logos, fuentes) necesarios para el reporte.
 */
export interface ReportAssets {
  logo: string;
  styles: string;
  principalFont: string;
  logoFont: string;
}
