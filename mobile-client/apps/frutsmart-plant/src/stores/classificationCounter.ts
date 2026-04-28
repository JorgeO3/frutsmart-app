import { create } from "zustand";

interface ClassificationCounterStoreState {
  currentStep: number;
  maxSteps: number;
}

interface ClassificationCounterActions {
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
}

interface ClassificationCounterStore extends ClassificationCounterStoreState {
  actions: ClassificationCounterActions;
}

const initialState: ClassificationCounterStoreState = {
  currentStep: 0,
  maxSteps: 3,
};

export const useClassificationCounterStore = create<ClassificationCounterStore>(
  (set) => ({
    ...initialState,
    actions: {
      nextStep: () =>
        set((state) => ({
          currentStep: Math.min(state.currentStep + 1, state.maxSteps),
        })),
      prevStep: () =>
        set((state) => ({
          currentStep: Math.max(state.currentStep - 1, 0),
        })),
      reset: () => set(initialState),
    },
  }),
);

export const useCurrentStep = () =>
  useClassificationCounterStore((state) => state.currentStep);

export const useMaxSteps = () =>
  useClassificationCounterStore((state) => state.maxSteps);

export const useClassificationCounterActions = () =>
  useClassificationCounterStore((state) => state.actions);
