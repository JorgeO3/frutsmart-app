import { create } from "zustand";

interface ExtClassificationStoreState {
  currentStep: number;
  maxSteps: number;
}

interface ExtClassificationActions {
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
}

interface ExtClassificationStore extends ExtClassificationStoreState {
  actions: ExtClassificationActions;
}

const initialState: ExtClassificationStoreState = {
  currentStep: 0,
  maxSteps: 2,
};

export const useExtClassificationStore = create<ExtClassificationStore>(
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

export const useExtCurrentStep = () =>
  useExtClassificationStore((state) => state.currentStep);

export const useExtMaxSteps = () =>
  useExtClassificationStore((state) => state.maxSteps);

export const useExtClassificationActions = () =>
  useExtClassificationStore((state) => state.actions);
