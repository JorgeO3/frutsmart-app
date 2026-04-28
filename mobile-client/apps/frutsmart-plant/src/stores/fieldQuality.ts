import { create } from "zustand";
import { useShallow } from "zustand/shallow";

/**
 * Represents a photo captured during the process, including its
 * original and segmented versions.
 */
export interface CapturedPhoto {
  id: string; // UUID to use as a 'key' in React lists
  rawUri: string;
  segmentedUri?: string; // Added after model processing
  croppedUri?: string; // Optional, used for pdf generation
  inferenceOutput?: object; // Raw data from the segmentation model
}

/**
 * Represents the result of a classification model, including the
 * AI's prediction and subsequent human feedback.
 */
export interface ClassificationResult {
  aiPrediction: {
    className: string;
    confidence: number;
    rawInference: object;
  };
  humanFeedback: {
    isCorrect: boolean;
    correctedClassName: string | null;
    observation: string;
  };
}

/**
 * Contains all the information for a classification phase
 * (either external or internal).
 */
export interface ClassificationData {
  photos: CapturedPhoto[];
  result: ClassificationResult | null; // It's null until the classification model runs
}

/**
 * Contains all information related to harvest criteria.
 */
export interface HarvestCriteria {
  assignedCriterion: string;
  applicationCount: number;
  clusterWeight: number;
  observation: string;
}

/** Metadata related to the device. */
export interface DeviceMetadata {
  timeOfDay: "day" | "night";
  weather: string;
  hasInternet: boolean;
}

/** Geolocation metadata. */
export interface Geolocation {
  latitude: number;
  longitude: number;
}

/** Versions of the AI models used. */
export interface ModelVersions {
  detection: string;
  externalClassification: string;
  internalClassification: string;
}

/** Groups all classification metadata. */
export interface Metadata {
  creationTimestamp: string;
  device: DeviceMetadata;
  geolocation: Geolocation;
  modelVersions?: ModelVersions;
}

export interface Lot {
  id: string;
  name: string;
}

export interface Center {
  id: string;
  name: string;
}

/** Contains all traceability information for the classification. */
export interface TraceabilityData {
  lots: Lot[] | null;
}

/**
 * Represents the complete and cohesive structure of the Zustand state.
 */
export interface FieldQualityState {
  traceability: TraceabilityData;
  externalClassification: ClassificationData;
  internalClassification: ClassificationData;
  harvestCriteria: HarvestCriteria | null;
  metadata: Metadata | null;
  isCompleted: boolean;
}

// biome-ignore format: true
export interface FieldQualityActions {
  setTraceability(data: TraceabilityData): void;
  setHarvestCriteria(criteria: HarvestCriteria): void;
  setMetadata(metadata: Metadata): void;

  // Métodos "upsert" para fotos: añaden si no existen, actualizan si ya existen.
  setExternalPhoto(photo: Partial<CapturedPhoto> & { id: string }): void;
  removeExternalPhoto(photoId: string): void;

  setInternalPhoto(photo: Partial<CapturedPhoto> & { id: string }): void;
  removeInternalPhoto(photoId: string): void;

  // Acciones granulares para los resultados de clasificación
  setExternalAiPrediction(prediction: ClassificationResult["aiPrediction"]): void;
  setExternalHumanFeedback(feedback: ClassificationResult["humanFeedback"]): void;

  setInternalAiPrediction(prediction: ClassificationResult["aiPrediction"]): void;
  setInternalHumanFeedback(feedback: ClassificationResult["humanFeedback"]): void;

  complete(): void;
  reset(): void; // Full store reset
  resetClassificationData(): void; // Partial reset for a new classification
  resetMetadata(): void; // Reset metadata only
  resetTraceability(): void; // Reset traceability data only
}

interface FieldQualityStore extends FieldQualityState {
  actions: FieldQualityActions;
}

const classificationDataInitial = {
  traceability: { lots: [] },
  externalClassification: { photos: [], result: null },
  internalClassification: { photos: [], result: null },
  harvestCriteria: null,
  isCompleted: false,
};

export const initialFieldQualityState: FieldQualityState = {
  ...classificationDataInitial,
  metadata: null,
};

export const useFieldQualityStore = create<FieldQualityStore>((set) => ({
  ...initialFieldQualityState,
  actions: {
    setTraceability: (traceability) => set({ traceability }),
    setHarvestCriteria: (harvestCriteria) => set({ harvestCriteria }),
    setMetadata: (metadata) => set({ metadata }),

    setExternalPhoto: (photoData) =>
      set((s) => {
        const photos = s.externalClassification.photos;
        const existingIndex = photos.findIndex((p) => p.id === photoData.id);
        let newPhotos: CapturedPhoto[];

        if (existingIndex !== -1) {
          // Actualiza una foto existente
          newPhotos = [...photos];
          newPhotos[existingIndex] = {
            ...newPhotos[existingIndex],
            ...photoData,
          };
        } else {
          // Añade una foto nueva, asegurando que tenga los campos mínimos.
          if (!photoData.rawUri) {
            console.error(
              "Error: No se puede añadir una foto nueva sin 'rawUri'.",
            );
            return s; // No hace cambios si falta el campo requerido.
          }
          const newPhoto = photoData as CapturedPhoto;
          newPhotos = [...photos, newPhoto];
        }

        return {
          externalClassification: {
            ...s.externalClassification,
            photos: newPhotos,
          },
        };
      }),
    removeExternalPhoto: (photoId) =>
      set((s) => ({
        externalClassification: {
          ...s.externalClassification,
          photos: s.externalClassification.photos.filter(
            (p) => p.id !== photoId,
          ),
        },
      })),

    setInternalPhoto: (photoData) =>
      set((s) => {
        const photos = s.internalClassification.photos;
        const existingIndex = photos.findIndex((p) => p.id === photoData.id);
        let newPhotos: CapturedPhoto[];

        if (existingIndex !== -1) {
          newPhotos = [...photos];
          newPhotos[existingIndex] = {
            ...newPhotos[existingIndex],
            ...photoData,
          };
        } else {
          if (!photoData.rawUri) {
            console.error(
              "Error: No se puede añadir una foto nueva sin 'rawUri'.",
            );
            return s;
          }
          const newPhoto = photoData as CapturedPhoto;
          newPhotos = [...photos, newPhoto];
        }

        return {
          internalClassification: {
            ...s.internalClassification,
            photos: newPhotos,
          },
        };
      }),
    removeInternalPhoto: (photoId) =>
      set((s) => ({
        internalClassification: {
          ...s.internalClassification,
          photos: s.internalClassification.photos.filter(
            (p) => p.id !== photoId,
          ),
        },
      })),

    setExternalAiPrediction: (aiPrediction) =>
      set((s) => ({
        externalClassification: {
          ...s.externalClassification,
          result: {
            ...(s.externalClassification.result || {
              humanFeedback: {
                isCorrect: false,
                correctedClassName: null,
                observation: "",
              },
            }),
            aiPrediction,
          } as ClassificationResult,
        },
      })),
    setExternalHumanFeedback: (humanFeedback) =>
      set((s) => {
        if (!s.externalClassification.result?.aiPrediction) {
          console.error(
            "No se puede establecer feedback humano antes de que exista una predicción de la IA.",
          );
          return s;
        }
        return {
          externalClassification: {
            ...s.externalClassification,
            result: {
              ...s.externalClassification.result,
              humanFeedback,
            } as ClassificationResult,
          },
        };
      }),

    setInternalAiPrediction: (aiPrediction) =>
      set((s) => ({
        internalClassification: {
          ...s.internalClassification,
          result: {
            ...(s.internalClassification.result || {
              humanFeedback: {
                isCorrect: false,
                correctedClassName: null,
                observation: "",
              },
            }),
            aiPrediction,
          } as ClassificationResult,
        },
      })),
    setInternalHumanFeedback: (humanFeedback) =>
      set((s) => {
        if (!s.internalClassification.result?.aiPrediction) {
          console.error(
            "No se puede establecer feedback humano antes de que exista una predicción de la IA.",
          );
          return s;
        }
        return {
          internalClassification: {
            ...s.internalClassification,
            result: {
              ...s.internalClassification.result,
              humanFeedback,
            } as ClassificationResult,
          },
        };
      }),

    complete: () => set({ isCompleted: true }),
    reset: () => set(initialFieldQualityState),
    resetClassificationData: () =>
      set((state) => ({
        ...classificationDataInitial,
        metadata: state.metadata,
        traceability: state.traceability,
      })),
    resetMetadata: () => set((state) => ({ ...state, metadata: null })),
    resetTraceability: () => set((state) => ({ ...state, traceability: { lots: [] } })),
  },
}));

// --- HOOKS ---

/** Hook to access only the actions object (stable reference). */
export const useFieldQualityActions = () =>
  useFieldQualityStore((state) => state.actions);

/** Hook to access traceability data (lotId, centerId, etc.). */
export const useTraceability = () =>
  useFieldQualityStore(useShallow((state) => state.traceability));

/** Hook to access external classification data. */
export const useExternalClassification = () =>
  useFieldQualityStore(useShallow((state) => state.externalClassification));

/** Hook to access internal classification data. */
export const useInternalClassification = () =>
  useFieldQualityStore(useShallow((state) => state.internalClassification));

/** Hook to access harvest criteria data. */
export const useHarvestCriteria = () =>
  useFieldQualityStore(useShallow((state) => state.harvestCriteria));

/** Hook to access classification metadata. */
export const useMetadata = () =>
  useFieldQualityStore(useShallow((state) => state.metadata));

/** Hook to check if the process has been marked as completed. */
export const useIsCompleted = () =>
  useFieldQualityStore((state) => state.isCompleted);

/** Hook to access the full state (use with caution in components to avoid re-renders). */
export const useFullFieldQualityState = () =>
  useFieldQualityStore(useShallow((state) => state));

export const useFieldQualityData = () =>
  useFieldQualityStore(
    useShallow((state) => ({
      traceability: state.traceability,
      externalClassification: state.externalClassification,
      internalClassification: state.internalClassification,
      harvestCriteria: state.harvestCriteria,
      metadata: state.metadata,
      isCompleted: state.isCompleted,
    })),
  );
