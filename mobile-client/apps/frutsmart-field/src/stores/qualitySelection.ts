import { create } from "zustand";

export type Tab = "lot" | "center";

// Interfaz que define la estructura del estado, separando datos y acciones.
interface SelectionState {
  // --- STATE ---
  lots: Set<string>;
  centers: Set<string>;
  version: number;

  // --- ACTIONS ---
  actions: {
    /**
     * Alterna la selección de un lote o centro basado en la pestaña activa.
     * Centraliza la lógica de negocio.
     */
    toggle: (tab: Tab, id: string) => void;
    /** Limpia todos los centros seleccionados. */
    clearCenters: () => void;
    /** Limpia toda la selección. */
    clearAll: () => void;
  };
}

/**
 * 🐻 Store base de Zustand.
 * No se exporta directamente para evitar suscripciones a todo el store.
 */
const useSelectionStore = create<SelectionState>((set, get) => ({
  // --- STATE ---
  lots: new Set(),
  centers: new Set(),
  version: 0,

  // --- ACTIONS ---
  // Agrupadas en su propio 'namespace' para un selector estable.
  actions: {
    toggle: (tab, id) => {
      if (tab === "lot") {
        // Lógica de selección única para lotes
        set((state) => {
          const newLots = new Set<string>();
          // Si no estaba seleccionado, se añade. Si estaba, queda vacío (toggle off).
          if (!state.lots.has(id)) {
            newLots.add(id);
          }
          return { lots: newLots, version: state.version + 1 };
        });
      } else {
        // Lógica de selección única para centros
        set((state) => {
          const newCenters = new Set<string>();
          if (!state.centers.has(id)) {
            newCenters.add(id);
          }
          return { centers: newCenters, version: state.version + 1 };
        });
      }
    },

    clearCenters: () =>
      set((state) => {
        // Optimización: no actualiza si ya está vacío
        if (state.centers.size === 0) return state;
        return { centers: new Set(), version: state.version + 1 };
      }),

    clearAll: () =>
      set((state) => {
        if (state.lots.size === 0 && state.centers.size === 0) return state;
        return { lots: new Set(), centers: new Set(), version: 0 };
      }),
  },
}));

// --- HOOKS PÚBLICOS ---

// 💡 Selectores atómicos para cada pieza del estado.
// Evitan re-renders innecesarios al suscribirse solo a lo que el componente necesita.
export const useLots = () => useSelectionStore((state) => state.lots);
export const useCenters = () => useSelectionStore((state) => state.centers);
export const useVersion = () => useSelectionStore((state) => state.version);

/**
 * 🚀 Hook único y estable para acceder a todas las acciones.
 * Como el objeto `actions` nunca cambia, este hook no causa re-renders.
 */
export const useSelectionActions = () => useSelectionStore((state) => state.actions);

/**
 * Selector de estado derivado.
 * Calcula un valor booleano basado en el estado actual.
 */
export const useHasCompleteSelection = () =>
  useSelectionStore((state) => state.lots.size > 0 && state.centers.size > 0);