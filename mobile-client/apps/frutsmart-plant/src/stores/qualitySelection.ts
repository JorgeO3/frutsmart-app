import { create } from "zustand";

export type Tab = "program" | "lot";

interface SelectionState {
  // State
  programs: Set<string>;
  lots: Set<string>;
  version: number;

  // Actions
  actions: {
    toggle: (tab: Tab, id: string) => void;
    clearLots: () => void;
    clearAll: () => void;
  };
}

/**
 * Zustand store for managing quality selection state.
 * Not exported directly to prevent unnecessary subscriptions.
 */
const useSelectionStore = create<SelectionState>((set) => ({
  // State
  programs: new Set(),
  lots: new Set(),
  version: 0,

  // Actions
  actions: {
    toggle: (tab, id) => {
      if (tab === "program") {
        // Para programas: solo uno seleccionado a la vez
        set((state) => {
          const newPrograms = new Set<string>();
          if (!state.programs.has(id)) {
            newPrograms.add(id);
          }
          return { programs: newPrograms, version: state.version + 1 };
        });
      } else {
        // Para lotes: permitir múltiples selecciones (toggle real)
        set((state) => {
          const newLots = new Set(state.lots);
          if (state.lots.has(id)) {
            newLots.delete(id);
          } else {
            newLots.add(id);
          }
          return { lots: newLots, version: state.version + 1 };
        });
      }
    },

    clearLots: () =>
      set((state) => {
        if (state.lots.size === 0) return state;
        return { lots: new Set(), version: state.version + 1 };
      }),

    clearAll: () =>
      set((state) => {
        if (state.programs.size === 0 && state.lots.size === 0) return state;
        return { programs: new Set(), lots: new Set(), version: 0 };
      }),
  },
}));

// Public hooks

// Atomic selectors for state properties
export const usePrograms = () => useSelectionStore((state) => state.programs);
export const useLots = () => useSelectionStore((state) => state.lots);
export const useVersion = () => useSelectionStore((state) => state.version);

/**
 * Hook for accessing all actions.
 * The actions object never changes, preventing unnecessary re-renders.
 */
export const useSelectionActions = () =>
  useSelectionStore((state) => state.actions);

/**
 * Derived state selector.
 * Returns true when both programs and lots have selections.
 */
export const useHasCompleteSelection = () =>
  useSelectionStore((state) => state.programs.size > 0 && state.lots.size > 0);
