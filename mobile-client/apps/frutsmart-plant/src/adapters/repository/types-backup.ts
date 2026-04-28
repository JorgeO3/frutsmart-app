/**
 * Este archivo define las interfaces y tipos para la capa de acceso a datos (repositorios).
 * Estas estructuras mapean directamente las tablas de la base de datos SQLite y los
 * contratos de datos que los repositorios exponen a la capa de servicios.
 */

// ============================================================
// Tipos de Entidades de Catálogo (Tablas de Consulta)
// ============================================================

/** Representa una fila en la tabla 'models'. */
export interface Model {
  id: string;
  name: string;
  version_tag: string;
  type: "detection" | "external_classification" | "internal_classification";
}

/** Representa una fila en la tabla 'lots'. */
export interface Lot {
  id: string;
  name: string;
}

/** Representa una fila en la tabla 'centers'. */
export interface Center {
  id: string;
  name: string;
  lot_id: string;
}

/** Representa una fila en la tabla 'reports'. */
export interface Report {
  report_date: string; // Formato: 'YYYY-MM-DD'
  report_data_json: string;
}

// ============================================================
// Tipos de Entidades Transaccionales (Tablas de Datos Principales)
// ============================================================

/**
 * Representa una fila en la tabla 'quality_classifications'.
 * Nota cómo esta estructura es plana, a diferencia del tipo anidado antiguo.
 */
export interface QualityClassification {
  quality_classification_id: string;
  creation_timestamp: string; // Formato ISO 8601
  session_id: string; // ID de sesión de la aplicación

  // Trazabilidad
  lot_id: string;
  center_id: string;

  // Metadatos del Dispositivo
  device_time_of_day: string | null;
  device_weather: string | null;
  device_has_internet: boolean; // El repositorio maneja la conversión a 0/1
  geo_latitude: number | null;
  geo_longitude: number | null;

  // IDs de los Modelos
  model_detection_id: string | null;
  model_external_id: string | null;
  model_internal_id: string | null;

  // Criterios de Cosecha
  harvest_assigned_criterion: string | null;
  harvest_number_of_applications: number | null;
  harvest_observation: string | null;
  harvest_cluster_weight: number | null;
}

/**
 * Representa una fila en la tabla 'classification_photos'.
 */
export interface ClassificationPhoto {
  id: string;
  quality_classification_id: string;
  classification_type: ClassificationType;
  photo_type: PhotoType;
  uri: string;
  raw_inference_output_json: string | null;
}

/**
 * Representa una fila en la tabla 'classification_results'.
 * APLANA las estructuras anidadas 'ai_prediction' y 'human_feedback' del tipo antiguo.
 */
export interface ClassificationResult {
  id: string;
  quality_classification_id: string;
  classification_type: ClassificationType;

  // Predicción de la IA
  ai_predicted_class_name: string | null;
  ai_confidence: number | null;
  ai_raw_inference_output_json: string | null;

  // Feedback Humano
  human_feedback_is_correct: boolean | null; // El repositorio maneja la conversión
  human_feedback_corrected_class: string | null;
  human_feedback_observation: string | null;
}

// ============================================================
// Tipos de Agregados y Payloads (para la Fachada del Repositorio)
// ============================================================

/**
 * Define el payload para crear una clasificación completa a través de la fachada
 * `QualityClassificationRepository`.
 */
export interface CreateClassificationPayload {
  classification: Omit<QualityClassification, "quality_classification_id">;
  results: Omit<ClassificationResult, "id" | "quality_classification_id">[];
  photos: Omit<ClassificationPhoto, "id" | "quality_classification_id">[];
}

/**
 * Representa el agregado completo de una clasificación, incluyendo sus entidades hijas.
 * Es el tipo de dato que devuelve `qualityClassifications.findById()`.
 */
export interface FullQualityClassification extends QualityClassification {
  results: ClassificationResult[];
  photos: ClassificationPhoto[];
}

// ============================================================
// Tipos Generales y de Utilidad
// ============================================================

/** Tipo para la paginación de resultados. */
export interface Pagination<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Tipos de enumeración para consistencia. */
export type ClassificationType = "external" | "internal";
export type PhotoType = "cropped" | "segmented";

export interface ClassificationSummaryRow {
  class_name: string;
  count: number;
}

export interface HarvestCriteriaRow {
  criterion: string;
  count: number;
}

// Database Row Mappings
export interface QualityClassificationRow {
  quality_classification_id: string;
  creation_timestamp: string;
  lot_id: string;
  lot_name: string;
  center_id: string;
  center_name: string;
  harvest_assigned_criterion: string;
  harvest_number_of_applications: number;
  harvest_cluster_weight: number;
  harvest_observation: string;
}

export interface ClassificationResultRow {
  quality_classification_id: string;
  classification_type: "external" | "internal";
  ai_predicted_class_name: string;
  human_feedback_corrected_class: string | null;
  human_feedback_observation: string | null;
}

export interface ClassificationPhotoRow {
  id: string;
  quality_classification_id: string;
  classification_type: "external" | "internal";
  photo_type: "cropped" | "segmented";
  uri: string;
}

export interface AvailableReportRow {
  id: string; // UUID del reporte
  report_date: string; // Fecha del reporte en formato 'YYYY-MM-DD'
  report_id: string; // Identificador único legible por humanos
}

export interface Session {
  id: string; // UUID de la sesión
  start_timestamp: string; // Fecha y hora de inicio en formato ISO 8601
  end_timestamp: string | null; // Fecha y hora de finalización en formato ISO 8601, puede ser null si la sesión está activa
}
