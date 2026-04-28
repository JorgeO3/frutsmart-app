/**
 * Define la estructura de datos anidada para una única clasificación,
 * tal como la maneja la lógica de la aplicación antes de ser guardada.
 */
export interface ClassificationDataFromApp {
  traceability: {
    production_center_id: string;
    lot_id: string;
    applicator_id: string;
    verifier_id: string;
  };
  metadata: {
    creation_timestamp: string; // ISO 8601 format
    device: {
      time_of_day: "day" | "night";
      weather: string;
      has_internet: boolean;
    };
    geolocation: {
      latitude: number;
      longitude: number;
    };
    model_versions?: {
      // Opcional, por si no se usa de momento
      detection: string;
      external_classification: string;
      internal_classification: string;
    };
  };
  external_classification: {
    photos: ClassificationPhotos;
    result: ClassificationResultData;
  };
  internal_classification: {
    photos: ClassificationPhotos;
    result: ClassificationResultData;
  };
  harvest_criteria: {
    assigned_criterion: string;
    number_of_applications: number;
    observation: string;
  };
}

// --- Tipos de ayuda para la estructura principal ---

export interface ClassificationPhotos {
  raw_uris: string[];
  segmentation_results: SegmentationResult[];
}

export interface SegmentationResult {
  segmented_uri: string;
  raw_inference_output: object;
}

export interface ClassificationResultData {
  ai_prediction: {
    class_name: string;
    confidence: number;
    raw_inference_output: object;
  };
  human_feedback: {
    is_prediction_correct: boolean;
    corrected_class_name: string | null;
    observation: string;
  };
}
