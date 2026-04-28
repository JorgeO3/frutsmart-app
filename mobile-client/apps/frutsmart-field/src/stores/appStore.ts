import { create } from "zustand";

// ============================================================
// Definición de la Interfaz del Estado y las Acciones
// ============================================================

interface AppStore {
  sessionId: string | null;
  date: string;

  actions: {
    setSessionId: (sessionId: string) => void;
    clearSession: () => void;
  };
}

const getDate = () =>
  new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

// ============================================================
// Creación del Store de Zustand (Sin Lógica de Negocio)
// ============================================================

export const useAppStore = create<AppStore>((set) => ({
  sessionId: null,
  date: getDate(),

  actions: {
    setSessionId: (sessionId: string) => set({ sessionId }),
    clearSession: () => set({ sessionId: null }),
  },
}));

// ============================================================
// Selectores Personalizados
// ============================================================

export const useDate = () => useAppStore((state) => state.date);
export const useSessionId = () => useAppStore((state) => state.sessionId);
export const useAppActions = () => useAppStore((state) => state.actions);
