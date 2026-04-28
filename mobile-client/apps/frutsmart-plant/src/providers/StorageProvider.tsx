import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { GLOBAL_LOW_SPACE_THRESHOLD } from "@src/constants/spaceBudgets";
import { getFreeBytes, getTotalBytes } from "@utils/storage";

type StorageState = {
  free: number;
  total: number;
  lowSpace: boolean;
  lastCheckAt: number;
  refresh: () => Promise<void>;
};

const Ctx = createContext<StorageState | null>(null);

export const StorageProvider = ({ children }: { children: ReactNode }) => {
  const [free, setFree] = useState(0);
  const [total, setTotal] = useState(0);
  const [lastCheckAt, setLast] = useState(0);

  const refresh = useCallback(async () => {
    const [f, t] = await Promise.all([getFreeBytes(), getTotalBytes()]);
    setFree(f);
    setTotal(t);
    setLast(Date.now());
  }, []);

  useEffect(() => {
    // Primer chequeo
    refresh();
    // Re-chequear al volver al foreground
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const lowSpace = free > 0 && free < GLOBAL_LOW_SPACE_THRESHOLD;
  return (
    <Ctx.Provider value={{ free, total, lowSpace, lastCheckAt, refresh }}>
      {children}
    </Ctx.Provider>
  );
};

export function useStorage() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStorage must be used within StorageProvider");
  return ctx;
}
