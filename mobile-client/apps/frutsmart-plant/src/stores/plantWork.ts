import { create } from "zustand";
import { useShallow } from "zustand/shallow";

// 1. Constantes y Errores Centralizados
const DOMAIN_CONSTANTS = {
  MAX_ITERATIONS: 3, // Total de 4 iteraciones, índices 0-3
} as const;

const ERRORS = {
  MISSING_DATA_FOR_COMPLETION:
    "Faltan datos de trazabilidad, metadatos o criterios para completar.",
  CLASSIFICATION_INCOMPLETE:
    "Los resultados de la clasificación están incompletos.",
} as const;

// 2. Tipos de Dominio Mejorados
export type Provider = "own" | "third-party";

export interface Program {
  id: string;
  name: string;
}

export interface Lot {
  id: string;
  name: string;
}

interface TraceabilityOwnData {
  provider: "own";
  qrCode: string;
  truckPlate: string;
  consecutiveNumber: string;
  ownData: { lots: Lot[]; program: Program };
  thirdPartyData?: null;
}

interface TraceabilityThirdPartyData {
  provider: "third-party";
  qrCode: string;
  truckPlate: string;
  consecutiveNumber: string;
  thirdPartyData: { vendor: string; subVendor: string };
  ownData?: null;
}

export type Traceability = TraceabilityOwnData | TraceabilityThirdPartyData;

export interface ClassifiedSegment {
  uri: string;
  bestConfidence: number;
  bestClassName: string;
  confidences: number[];
}

interface ExternalClassification {
  rawPhotoUri: string;
  classifiedSegments: ClassifiedSegment[];
}

export interface AiPrediction {
  className: string;
  confidence: number;
  rawConfidences: number[];
}

export interface HumanFeedback {
  isCorrect: boolean;
  correctedClassName: string | null;
  observation: string;
}

interface InternalClassification {
  rawPhotoUri: string;
  segmentedPhotoUri: string;
  aiPrediction: AiPrediction;
  humanFeedback?: HumanFeedback;
}

export interface Classification {
  external: ExternalClassification;
  internal?: InternalClassification;
}

export interface Metadata {
  creationTimestamp: string;
  device: {
    timeOfDay: "day" | "night";
    weather: string;
    hasInternet: boolean;
  };
  geolocation: {
    latitude: number;
    longitude: number;
  };
  modelVersions?: {
    detection: string;
    externalClassification: string;
    internalClassification: string;
  };
}

export interface HarvestCriteria {
  rb: number;
  rv: number;
  rsm: number;
  rmf: number;
  rpl: number;
  pas: number;
  vac: number;
}

export interface ClassificationResultSummary {
  external: {
    aiSummary: Record<string, number>;
    humanSummary?: Record<string, number>;
  };
  internal: Record<string, number>;
}

// 3. Estado y Acciones
export interface PlantWorkState {
  traceability: Partial<Traceability>;
  metadata: Metadata | null;
  harvestCriteria: HarvestCriteria | null;
  qualityClassifications: Classification[];
  summary: ClassificationResultSummary | null;
  currentIteration: number;
  isCompleted: boolean;
  actions: PlantWorkActions;
}

export interface PlantWorkActions {
  updateTraceability(data: Partial<Traceability>): void;
  setMetadata(metadata: Metadata): void;
  setHarvestCriteria(criteria: HarvestCriteria): void;
  setExternalSummary(data: {
    aiSummary?: Record<string, number>;
    humanSummary?: Record<string, number>;
  }): void;
  setInternalSummary(internalData: Record<string, number>): void;
  updateCurrentClassification(data: Partial<Classification>): void;
  updateInternalFeedback(feedback: HumanFeedback): void;
  nextIteration(): void;
  complete(): void;
  reset(): void;
}

// 4. Helpers de Lógica Pura
const createEmptyClassification = (): Classification => ({
  external: { rawPhotoUri: "", classifiedSegments: [] },
  internal: {
    rawPhotoUri: "",
    segmentedPhotoUri: "",
    aiPrediction: { className: "", confidence: 0, rawConfidences: [] },
    humanFeedback: {
      isCorrect: false,
      correctedClassName: null,
      observation: "",
    },
  },
});

const createInitialState = (): Omit<PlantWorkState, "actions"> => ({
  traceability: {
    provider: "own",
    qrCode: "",
    truckPlate: "",
    consecutiveNumber: "",
    ownData: { lots: [], program: { id: "", name: "" } },
  },
  metadata: null,
  harvestCriteria: null,
  qualityClassifications: [createEmptyClassification()],
  summary: null,
  currentIteration: 0,
  isCompleted: false,
});

// 5. El Store (No se exporta directamente)
export const usePlantWorkStoreBase = create<PlantWorkState>((set, get) => ({
  ...createInitialState(),
  actions: {
    updateTraceability: (data) => {
      set((state) => {
        const currentTraceability = state.traceability;
        const newTraceability = { ...currentTraceability, ...data };

        if (data.provider) {
          if (data.provider === "own") {
            delete newTraceability.thirdPartyData;
            newTraceability.ownData = {
              lots: [],
              program: { id: "", name: "" },
            };
          } else {
            delete newTraceability.ownData;
            newTraceability.thirdPartyData = { vendor: "", subVendor: "" };
          }
        }

        // Le decimos a TS: "Confía en mí, este objeto es un Partial<Traceability> válido"
        return { traceability: newTraceability as Partial<Traceability> };
      });
    },
    setMetadata: (metadata) => set({ metadata }),
    setHarvestCriteria: (criteria) => set({ harvestCriteria: criteria }),
    setExternalSummary: (data) => {
      set((state) => {
        const currentExternal = state.summary?.external ?? {
          aiSummary: {},
          humanSummary: undefined,
        };

        return {
          summary: {
            ...(state.summary ?? {
              external: { aiSummary: {}, humanSummary: undefined },
              internal: {},
            }),
            external: {
              aiSummary: data.aiSummary ?? currentExternal.aiSummary,
              humanSummary: data.humanSummary ?? currentExternal.humanSummary,
            },
          },
        };
      });
    },
    setInternalSummary: (internalData) => {
      set((state) => ({
        summary: {
          ...(state.summary ?? { external: { aiSummary: {} }, internal: {} }),
          internal: internalData,
        },
      }));
    },
    updateCurrentClassification: (data) => {
      set((state) => {
        const classifications = [...state.qualityClassifications];
        const currentIndex = state.currentIteration;
        classifications[currentIndex] = {
          ...classifications[currentIndex],
          ...data,
          internal: data.internal
            ? { ...classifications[currentIndex]?.internal, ...data.internal }
            : classifications[currentIndex]?.internal,
        };
        return { qualityClassifications: classifications };
      });
    },
    updateInternalFeedback: (feedback) => {
      set((state) => {
        const classifications = [...state.qualityClassifications];
        const current = classifications[state.currentIteration];
        if (current?.internal) {
          current.internal.humanFeedback = feedback;
        }
        return { qualityClassifications: classifications };
      });
    },
    nextIteration: () => {
      set((state) => {
        const next = Math.min(
          state.currentIteration + 1,
          DOMAIN_CONSTANTS.MAX_ITERATIONS,
        );
        const classifications = [...state.qualityClassifications];
        if (!classifications[next]) {
          classifications[next] = createEmptyClassification();
        }
        return {
          currentIteration: next,
          qualityClassifications: classifications,
        };
      });
    },
    complete: () => {
      const {
        traceability,
        metadata,
        harvestCriteria,
        qualityClassifications,
      } = get();

      console.log("Completing with state:", {
        traceability,
        metadata,
        harvestCriteria,
        qualityClassifications,
      });

      if (!traceability || !metadata || !harvestCriteria) {
        throw new Error(ERRORS.MISSING_DATA_FOR_COMPLETION);
      }
      if (qualityClassifications.length < DOMAIN_CONSTANTS.MAX_ITERATIONS + 1) {
        throw new Error(ERRORS.CLASSIFICATION_INCOMPLETE);
      }
      set({ isCompleted: true });
    },
    reset: () => set(createInitialState()),
  },
}));

// 6. Hooks Públicos (Acciones unificadas, Selectores atómicos)
// --- ACCIONES ---
export const usePlantWorkActions = () =>
  usePlantWorkStoreBase((state) => state.actions);

// --- ESTADO GLOBAL ---
export const useCurrentIteration = () =>
  usePlantWorkStoreBase((state) => state.currentIteration);
export const useIsCompleted = () =>
  usePlantWorkStoreBase((state) => state.isCompleted);

// --- TRAZABILIDAD (Atómicos) ---
export const useTraceabilityProvider = () =>
  usePlantWorkStoreBase((state) => state.traceability.provider);
export const useTraceabilityData = () =>
  usePlantWorkStoreBase(useShallow((state) => state.traceability));

// --- METADATOS Y CRITERIOS (Atómicos) ---
export const useMetadata = () =>
  usePlantWorkStoreBase((state) => state.metadata);
export const useHarvestCriteria = () =>
  usePlantWorkStoreBase((state) => state.harvestCriteria);

// --- CLASIFICACIÓN (Atómicos) ---
export const useCurrentExternalClassification = () =>
  usePlantWorkStoreBase(
    useShallow(
      (state) => state.qualityClassifications[state.currentIteration]?.external,
    ),
  );
export const useCurrentInternalClassification = () =>
  usePlantWorkStoreBase(
    useShallow(
      (state) => state.qualityClassifications[state.currentIteration]?.internal,
    ),
  );

// AÑADIDOS: Selectores atómicos para las fotos de la clasificación actual
export const useCurrentExternalPhotoUris = () =>
  usePlantWorkStoreBase(
    useShallow(
      (state) =>
        state.qualityClassifications[
          state.currentIteration
        ]?.external?.classifiedSegments.map((segment) => segment.uri) ?? [],
    ),
  );

export const useCurrentInternalPhotoUri = () =>
  usePlantWorkStoreBase(
    (state) =>
      state.qualityClassifications[state.currentIteration]?.internal
        ?.segmentedPhotoUri ?? null,
  );

// --- RESUMEN (Atómicos) ---
export const useExternalSummary = () =>
  usePlantWorkStoreBase(useShallow((state) => state.summary?.external));
export const useInternalSummary = () =>
  usePlantWorkStoreBase(useShallow((state) => state.summary?.internal));

// --- ESTADO COMPLETO (Para Debugging/Pantalla Final) ---
export const useEntirePlantWorkState = () =>
  usePlantWorkStoreBase((state) => state);
