export interface Program {
  id: string;
  external_id: string;
  name: string;
}

export interface Lot {
  id: string;
  external_id: string;
  name: string;
  program_id: string;
}

export interface Pagination<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Report {
  id: string; // Internal UUID of the report
  quality_analysis_id: string;
  report_date: string; // Format: "2025-09-08"
  report_id: string; // Format: "ID-250908-A4F1B0E3"
}

export interface QualityClassification {
  id: string;
  quality_analysis_id: string;
  iteration_index: number;
  external_raw_photo_uri: string;
  internal_raw_photo_uri: string | null;
  internal_segmented_photo_uri: string | null;
  internal_ai_class_name: string | null;
  internal_ai_confidence: number | null;
  internal_ai_raw_confidences_json: string | null; // JSON string containing raw confidence values
  internal_hf_is_correct: boolean | null;
  internal_hf_corrected_class_name: string | null;
  internal_hf_observation: string | null;
}

// Input data required to create a new classification
export type QualityClassificationInput = Omit<
  QualityClassification,
  "id" | "quality_analysis_id"
>;

export interface ClassifiedSegment {
  id: string;
  quality_classification_id: string;
  uri: string;
  best_class_name: string;
  best_confidence: number;
  confidences_json: string; // JSON string containing confidence values
}

// Input data required to create a new segment
export type ClassifiedSegmentInput = Omit<
  ClassifiedSegment,
  "id" | "quality_classification_id"
>;

/** Traceability data for a new analysis. */
export interface TraceabilityInput {
  provider: "own" | "third-party";
  qr_code: string | null;
  truck_plate: string;
  consecutive_number: string;
  program_id?: string;
  vendor?: string;
  sub_vendor?: string;
}

/** Device and session metadata for a new analysis. */
export interface MetadataInput {
  creation_timestamp: string;
  session_id: string | null;
  device_time_of_day: "day" | "night";
  device_weather: string;
  device_has_internet: boolean;
  geo_latitude: number;
  geo_longitude: number;
  model_detection_id: string | null;
  model_external_id: string | null;
  model_internal_id: string | null;
}

/** Harvest criteria for a new analysis. */
export interface CriteriaInput {
  rb: number;
  rv: number;
  rsm: number;
  rmf: number;
  rpl: number;
  pas: number;
  vac: number;
}

/** Pre-serialized summaries as JSON strings. */
export interface SummaryInput {
  external_summary_json: string;
  internal_summary_json: string;
}

/** Represents an input classification with its nested segments. */
export interface ClassificationWithSegmentsInput
  extends QualityClassificationInput {
  segments: ClassifiedSegmentInput[];
}

// --- Main Input Types (Clean Interface) ---

/**
 * Complete and clean object that the repository receives to save a new analysis.
 */
export interface FullAnalysisInput {
  traceability: TraceabilityInput;
  metadata: MetadataInput;
  criteria: CriteriaInput;
  summary: SummaryInput;
  lotIds: string[];
  classifications: ClassificationWithSegmentsInput[];
}

// --- Subtypes and Main Output Types (Read Operations) ---

/** Represents a classification read from the database with its nested segments. */
export interface ClassificationWithSegments extends QualityClassification {
  segments: ClassifiedSegment[];
}

/**
 * Represents a complete row from the 'quality_analyses' table.
 * This is the base object for a quality analysis.
 */
export interface QualityAnalysis {
  id: string;
  creation_timestamp: string;
  session_id: string | null;

  // Provider information and traceability
  provider: "own" | "third-party";
  qr_code: string | null;
  truck_plate: string;
  consecutive_number: string;

  // Own provider specifics
  program_id: string | null;

  // Third-party provider specifics
  vendor: string | null;
  sub_vendor: string | null;

  // Device metadata
  device_time_of_day: "day" | "night";
  device_weather: string;
  device_has_internet: boolean;
  geo_latitude: number;
  geo_longitude: number;

  // AI model version tracking
  model_detection_id: string | null;
  model_external_id: string | null;
  model_internal_id: string | null;

  // Harvest criteria values
  criteria_rb: number | null;
  criteria_rv: number | null;
  criteria_rsm: number | null;
  criteria_rmf: number | null;
  criteria_rpl: number | null;
  criteria_pas: number | null;
  criteria_vac: number | null;

  // Analysis summaries stored as JSON
  external_summary_json: string | null;
  internal_summary_json: string | null;

  // Finalization status
  is_finalized: boolean;
}

/**
 * Represents the complete object of an analysis read from the database.
 */
export interface FullAnalysis extends QualityAnalysis {
  lots: Lot[];
  classifications: ClassificationWithSegments[];
}

export interface AvailableReportRow {
  id: string; // ID del reporte (de la tabla reports)
  report_id: string; // ID legible del reporte
  report_date: string; // Fecha del reporte
  quality_analysis_id: string; // ID del análisis al que pertenece
  truck_plate: string; // Placa del vehículo de ese análisis
  provider: "own" | "third-party"; // Proveedor de ese análisis
}
export interface ReportIteration {
  iteration_index: number;
  internal_photo_uri: string | null;
  external_photo_uris: string[]; // Todas las fotos de los segmentos
}

export interface ReportData extends QualityAnalysis {
  program: { id: string; name: string } | null;
  lots: Lot[];
  iterations: ReportIteration[];
}

export type UploadJobPipelineStep =
  | "create_session"
  | "upload"
  | "complete_session"
  | "evaluation"
  | "done";

export type UploadJobStatus =
  | "pending"
  | "running"
  | "success"
  | "failed";

export type UploadJobRow = {
  id: string;
  quality_analysis_id: string | null;
  domain: "plant" | "field";
  client_batch_id: string;
  backend_session_id: string | null;
  skybolt_session_id: string | null;
  pipeline_step: UploadJobPipelineStep;
  step_status: UploadJobStatus;
  total_files: number;
  completed_files: number;
  total_bytes: number;
  uploaded_bytes: number;
  last_error: string | null;
  attempts_count: number;
  last_attempt_at: string | null;
  created_at: string;
  updated_at: string;
};