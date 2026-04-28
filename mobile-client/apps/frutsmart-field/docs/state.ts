export interface InitialFormData {
  centers: string[];
  batches: string[];
}

export interface Photo {
  uri: string;
  modelData: unknown;
}

export interface ClassificationResultData {
  name: string;
  description: string;
  modelData: unknown;
  isValidClassification: boolean;
}

export interface ExternalClassificationData {
  photos: Photo[];
  classificationResult: ClassificationResultData;
}

export interface InternalClassificationData {
  photos: Photo[];
  classificationResult: ClassificationResultData;
}

export type FieldData = {
  initialForm?: InitialFormData;
  externalClassification?: ExternalClassificationData;
  harvestCriteria?: string;
  internalClassification?: InternalClassificationData;
  // Para claves verdaderamente dinámicas (usar con precaución)
  [key: string]: unknown;
};

interface Metadata {
  metadata: {
    creation_timestamp: "2025-06-13T15:26:00.000-05:00";
    device: {
      time_of_day: "day";
      weather: "sunny";
      has_internet: true;
    };
    geolocation: {
      latitude: 3.25;
      longitude: -76.228;
    };
    model_versions?: {
      detection: "v1.1-yolo";
      external_classification: "v1.1-yolo-classifier";
      internal_classification: "v1.1-yolo-classifier";
    };
  };
}

interface ClassificationDetails {
  production_center_id: string;
  lot_id: string;
  applicator_id: string;
  verifier_id: string;
}

interface FieldQualityStoreState {
  data: FieldData;
  classificationDetails: ClassificationDetails;
  metadata: Metadata;
  isCompleted: boolean;
}
