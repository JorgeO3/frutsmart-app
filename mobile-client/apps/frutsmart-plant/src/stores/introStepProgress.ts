import { create } from "zustand";

// 1. Definición de Tipos (Interfaces)
interface IntroStepProgressState {
  currentStep: number; // Paso actual (ej. 1, 2, 3...)
  visitedSteps: number; // Podría ser el paso más alto alcanzado o contador de avances
  totalSteps: number; // Número total de pasos
}

interface IntroStepProgressActions {
  advanceStep: () => void;
  goToStep: (step: number) => void;
  resetProgress: (totalSteps?: number) => void;
  setTotalSteps: (totalSteps: number) => void;
}

interface IntroStepProgressStore extends IntroStepProgressState {
  actions: IntroStepProgressActions;
}

// 2. Estado Inicial
const initialState: IntroStepProgressState = {
  totalSteps: 2, // Por defecto, puede ser configurado
  currentStep: 1, // Asumiendo 1-indexado para la UI
  visitedSteps: 0, // Se actualizará con advanceStep o goToStep
};

// 3. Creación del Store de Zustand
const useInternalIntroStepProgressStore = create<IntroStepProgressStore>(
  (set) => ({
    ...initialState,
    actions: {
      advanceStep: () =>
        set((state) => {
          const prevCurrentStep = state.currentStep; // Guardar el paso actual antes de avanzar
          const nextCurrentStep = Math.min(
            prevCurrentStep + 1,
            state.totalSteps,
          );

          // Lógica de visitedSteps: el paso más alto que ha estado activo (currentStep)
          // o el número de veces que se presionó "avanzar".
          // Optaré por "el paso más alto que ha estado activo"
          const nextVisitedSteps = Math.max(
            state.visitedSteps,
            prevCurrentStep,
          );

          if (nextCurrentStep === prevCurrentStep) {
            // Si no se pudo avanzar (ya estaba en el último paso)
            // Aún así, actualiza visitedSteps si el currentStep (que era el último)
            // es mayor que el visitedSteps anterior.
            if (nextVisitedSteps > state.visitedSteps) {
              return { ...state, visitedSteps: nextVisitedSteps };
            }
            return state; // No hay cambios
          }

          return {
            currentStep: nextCurrentStep,
            visitedSteps: nextVisitedSteps,
          };
        }),

      goToStep: (step) =>
        set((state) => {
          const newCurrentStep = Math.max(1, Math.min(step, state.totalSteps));
          const prevCurrentStep = state.currentStep;

          // Actualizar visitedSteps para reflejar el paso más alto activo
          const newVisitedSteps = Math.max(state.visitedSteps, prevCurrentStep);

          if (newCurrentStep === prevCurrentStep) {
            if (newVisitedSteps > state.visitedSteps) {
              return { ...state, visitedSteps: newVisitedSteps };
            }
            return state; // No hay cambio en currentStep
          }

          return {
            currentStep: newCurrentStep,
            visitedSteps: newVisitedSteps,
          };
        }),

      resetProgress: (totalSteps?: number) =>
        set({
          ...initialState, // Restablece a los valores base
          currentStep: 1, // Siempre empieza en el paso 1 al resetear
          visitedSteps: 0, // Resetea los pasos visitados
          totalSteps:
            totalSteps !== undefined
              ? Math.max(1, totalSteps)
              : initialState.totalSteps, // Permite reconfigurar totalSteps o usa el default
        }),

      setTotalSteps: (totalSteps) =>
        set((state) => {
          const newTotalSteps = Math.max(1, totalSteps); // totalSteps debe ser al menos 1
          return {
            totalSteps: newTotalSteps,
            currentStep: Math.min(state.currentStep, newTotalSteps), // Ajusta currentStep si es necesario
            // visitedSteps no se modifica aquí directamente, se actualiza con advance/goToStep
          };
        }),
    },
  }),
);

// 4. Exportación de Hooks Personalizados
export const useCurrentIntroStep = () =>
  useInternalIntroStepProgressStore((state) => state.currentStep);

export const useVisitedIntroSteps = () =>
  useInternalIntroStepProgressStore((state) => state.visitedSteps);

export const useTotalIntroSteps = () =>
  useInternalIntroStepProgressStore((state) => state.totalSteps);

export const useIntroStepProgressActions = () =>
  useInternalIntroStepProgressStore((state) => state.actions);
