import { create } from "zustand";
import { useShallow } from "zustand/shallow";

// --- TIPOS DE DOMINIO ---

export interface ClassifiedSegment {
  rawUri: string;
  segmentedUri: string;
  bestConfidence: number;
  bestClassName: string;
  confidences: number[];
}

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

export interface ClassificationData {
  segments: ClassifiedSegment[];
  result: ClassificationResult | null;
}

export interface HarvestCriteria {
  assignedCriterion: string;
  applicationCount: number;
  clusterWeight: number;
  observation: string;
}

export interface DeviceMetadata {
  timeOfDay: "day" | "night";
  weather: string;
  hasInternet: boolean;
}

export interface Geolocation {
  latitude: number;
  longitude: number;
}

export interface ModelVersions {
  detection: string;
  externalClassification: string;
  internalClassification: string;
}

export interface Metadata {
  creationTimestamp: string;
  device: DeviceMetadata;
  geolocation: Geolocation;
  modelVersions?: ModelVersions;
}

export interface TraceabilityData {
  lot: { id: string; name: string } | null;
  center: { id: string; name: string } | null;
}

// --- STORE STATE & ACTIONS ---

export interface FieldWorkState {
  traceability: TraceabilityData;
  externalClassification: ClassificationData;
  internalClassification: ClassificationData;
  harvestCriteria: HarvestCriteria | null;
  metadata: Metadata | null;
  isCompleted: boolean;
  externalIteration: number;
  internalIteration: number;
}

interface FieldWorkActions {
  // Setters básicos
  setTraceability: (data: Partial<TraceabilityData>) => void;
  setHarvestCriteria: (criteria: HarvestCriteria) => void;
  setMetadata: (metadata: Metadata) => void;

  // Actualizaciones de clasificación
  updateExternalSegment: (segment: ClassifiedSegment) => void;
  updateExternalResult: (result: Partial<ClassificationResult>) => void;

  updateInternalSegment: (segment: ClassifiedSegment) => void;
  updateInternalResult: (result: Partial<ClassificationResult>) => void;

  // Control de flujo
  nextExternalIteration: () => void;
  complete: () => void;

  // Reseteos
  reset: () => void;
  resetClassificationData: () => void;
  resetMetadata: () => void;
  resetTraceability: () => void;
}

type FieldWorkStore = FieldWorkState & { actions: FieldWorkActions };

// --- HELPERS Y ESTADO INICIAL ---

const createEmptyClassificationData = (): ClassificationData => ({
  segments: [],
  result: null,
});

const createEmptyResult = (): ClassificationResult => ({
  aiPrediction: { className: "", confidence: 0, rawInference: {} },
  humanFeedback: { isCorrect: false, correctedClassName: null, observation: "" },
});

const createPlaceholderSegment = (): ClassifiedSegment => ({
  rawUri: '',
  segmentedUri: '',
  bestConfidence: 0,
  bestClassName: 'pending', // O 'unclassified', lo que prefieras
  confidences: [],
});


const classificationInitialState = {
  externalClassification: createEmptyClassificationData(),
  internalClassification: createEmptyClassificationData(),
  externalIteration: 0,
  internalIteration: 0,
  isCompleted: false,
  harvestCriteria: null,
};

const initialState: Omit<FieldWorkState, 'actions'> = {
  traceability: { lot: null, center: null },
  metadata: null,
  ...classificationInitialState,
};

// --- STORE PRINCIPAL ---

export const useFieldWorkStoreBase = create<FieldWorkStore>((set) => ({
  ...initialState,

  actions: {
    // Setters básicos
    setTraceability: (data) => set((state) => ({ traceability: { ...state.traceability, ...data } })),
    setHarvestCriteria: (harvestCriteria) => set({ harvestCriteria }),
    setMetadata: (metadata) => set({ metadata }),

    // Actualizaciones de clasificación
    updateExternalSegment: (newSegment) =>
      set((state) => {
        // Creamos una copia del array de segmentos para no mutar el estado original
        const newSegments = [...state.externalClassification.segments];

        // Colocamos el nuevo segmento en el índice que indica la iteración actual
        newSegments[state.externalIteration] = newSegment;

        return {
          externalClassification: {
            ...state.externalClassification,
            segments: newSegments,
          },
        };
      }),

    updateExternalResult: (partialResult) =>
      set((state) => ({
        externalClassification: {
          ...state.externalClassification,
          result: {
            ...(state.externalClassification.result ?? createEmptyResult()),
            ...partialResult,
          } as ClassificationResult,
        },
      })),

    updateInternalSegment: (newSegment) =>
      set((state) => {
        // Creamos una copia del array
        const newSegments = [...state.internalClassification.segments];

        // Usamos el contador de la iteración interna como índice
        newSegments[state.internalIteration] = newSegment;

        return {
          internalClassification: {
            ...state.internalClassification,
            segments: newSegments,
          },
        };
      }),

    updateInternalResult: (partialResult) =>
      set((state) => ({
        internalClassification: {
          ...state.internalClassification,
          result: {
            ...(state.internalClassification.result ?? createEmptyResult()),
            ...partialResult,
          } as ClassificationResult,
        },
      })),

    // Control de flujo
    nextExternalIteration: () =>
      set((state) => {
        const newSegments = [...state.externalClassification.segments];

        if (newSegments[state.externalIteration] === undefined) {
          newSegments[state.externalIteration] = createPlaceholderSegment();
        }

        return {
          externalClassification: { ...state.externalClassification, segments: newSegments },
          externalIteration: state.externalIteration + 1,
        };
      }),

    complete: () => set({ isCompleted: true }),

    // Reseteos
    reset: () => set(initialState),
    resetClassificationData: () => set((state) => ({ ...state, ...classificationInitialState })),
    resetMetadata: () => set({ metadata: null }),
    resetTraceability: () => set({ traceability: { lot: null, center: null } }),
  },
}));

// --- HOOKS SELECTORES ---

export const useFieldWorkActions = () =>
  useFieldWorkStoreBase((state) => state.actions);

export const useExternalIteration = () =>
  useFieldWorkStoreBase((state) => state.externalIteration);

export const useExternalClassification = () =>
  useFieldWorkStoreBase(useShallow((state) => state.externalClassification));

export const useInternalClassification = () =>
  useFieldWorkStoreBase(useShallow((state) => state.internalClassification));

export const useExternalSegments = () =>
  useFieldWorkStoreBase(useShallow(state => state.externalClassification.segments));

export const useInternalSegments = () =>
  useFieldWorkStoreBase(useShallow(state => state.internalClassification.segments));

export const useTraceability = () =>
  useFieldWorkStoreBase(useShallow((state) => state.traceability));

export const useHarvestCriteria = () =>
  useFieldWorkStoreBase((state) => state.harvestCriteria);

export const useMetadata = () =>
  useFieldWorkStoreBase(useShallow((state) => state.metadata));

export const useIsCompleted = () =>
  useFieldWorkStoreBase((state) => state.isCompleted);

// --- NUEVOS SELECTORES PARA FOTOS ORIGINALES ---

/** Devuelve un array con las URIs de las fotos originales de la clasificación externa (sin duplicados). */
export const useExternalRawUris = () =>
  useFieldWorkStoreBase(
    useShallow((state) => {
      const uris = state.externalClassification.segments.map(seg => seg.rawUri);
      return [...new Set(uris)]; // Devuelve solo las URIs únicas
    })
  );

/** Devuelve un array con las URIs de las fotos originales de la clasificación interna (sin duplicados). */
export const useInternalRawUris = () =>
  useFieldWorkStoreBase(
    useShallow((state) => {
      const uris = state.internalClassification.segments.map(seg => seg.rawUri);
      return [...new Set(uris)]; // Devuelve solo las URIs únicas
    })
  );

// este metodo es para obtener toda la data del store
export const useFieldWorkData = () =>
  useFieldWorkStoreBase((state) => state);