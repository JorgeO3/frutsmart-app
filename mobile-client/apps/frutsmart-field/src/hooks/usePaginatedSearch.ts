import { useReducer, useRef, useCallback, useEffect } from "react";
import { useDebounce } from "@hooks/useDebounce"; // Asegúrate de que la ruta sea correcta

interface PaginatedOpts<T> {
  /**
   * Función asíncrona que obtiene los datos.
   * Debe aceptar el término de búsqueda, la página, el límite y una señal de aborto.
   */
  queryFn: (term: string, page: number, limit: number, signal?: AbortSignal) => Promise<T[]>;
  /** Tamaño de la página. Por defecto es 20. */
  pageSize?: number;
}

interface State<T> {
  data: T[];
  page: number;
  loading: boolean;
  hasMore: boolean;
  error: unknown | null;
}

type Action<T> =
  | { type: "START_FRESH" }
  | { type: "START_MORE" }
  | { type: "SUCCESS_FRESH"; payload: { results: T[]; pageSize: number } }
  | { type: "SUCCESS_MORE"; payload: { results: T[]; pageSize: number } }
  | { type: "ERROR"; payload: unknown };

const initialState = <T>(): State<T> => ({
  data: [],
  page: 0, // Inicia en 0 para que la primera petición sea la página 1
  loading: false,
  hasMore: true,
  error: null,
});

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case "START_FRESH":
      return { ...initialState<T>(), loading: true };
    case "START_MORE":
      return { ...state, loading: true };
    case "SUCCESS_FRESH": {
      const { results, pageSize } = action.payload;
      return {
        ...state,
        loading: false,
        data: results,
        page: 1,
        hasMore: results.length === pageSize,
        error: null,
      };
    }
    case "SUCCESS_MORE": {
      const { results, pageSize } = action.payload;
      return {
        ...state,
        loading: false,
        data: [...state.data, ...results],
        page: state.page + 1,
        hasMore: results.length === pageSize,
        error: null,
      };
    }
    case "ERROR":
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
}

/**
 * Hook para búsqueda paginada, con debounce y cancelación de peticiones.
 */
export function usePaginatedSearch<T>(term: string, opts: PaginatedOpts<T>) {
  const { queryFn, pageSize = 20 } = opts;
  const debouncedTerm = useDebounce(term, 300);

  const [state, dispatch] = useReducer(reducer<T>, undefined, initialState);

  const stateRef = useRef(state);
  stateRef.current = state;

  const abortRef = useRef<AbortController | null>(null);

  const fetcher = useCallback(
    async (pageToFetch: number, isFreshSearch: boolean) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      dispatch({ type: isFreshSearch ? "START_FRESH" : "START_MORE" });

      try {
        const results = await queryFn(
          debouncedTerm,
          pageToFetch,
          pageSize,
          abortRef.current.signal,
        );

        const actionType = isFreshSearch ? "SUCCESS_FRESH" : "SUCCESS_MORE";
        dispatch({ type: actionType, payload: { results, pageSize } });

      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          dispatch({ type: "ERROR", payload: err });
        }
      }
    },
    [debouncedTerm, queryFn, pageSize], // ✅ Dependencias estables.
  );

  useEffect(() => {
    fetcher(1, true);
    return () => abortRef.current?.abort();
  }, [fetcher]);

  const loadMore = useCallback(() => {
    // Usa la ref para leer el estado actual sin causar que este callback se recree.
    if (!stateRef.current.loading && stateRef.current.hasMore) {
      const nextPage = stateRef.current.page + 1;
      fetcher(nextPage, false);
    }
  }, [fetcher]); // ¡Ahora es estable!

  return { ...state, loadMore };
}