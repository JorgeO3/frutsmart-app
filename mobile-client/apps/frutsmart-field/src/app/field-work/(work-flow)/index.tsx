import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { Alert } from "react-native";

import {
  useLots,
  type Tab,
  useCenters,
  useVersion,
  useHasCompleteSelection,
  useSelectionActions,
} from "@stores/qualitySelection";
import { useDebounce } from "@hooks/useDebounce";
import { searchService } from "@services/search/searchService";
import { useFieldWorkActions } from "@stores/fieldWork";
import { usePaginatedSearch } from "@hooks/usePaginatedSearch";
import { useResetNavigation } from "@hooks/useResetNavigation";
import { useOnBackNavigation } from "@hooks/useOnBackNavigation";

import AppView from "@components/AppView";
import WarningCard from "@components/WarningCard";
import SelectionForm from "@components/field-work/index/SelectionForm";

const PAGE_SIZE = 20;

function useStaleWhileLoading<T>(
  data: T[],
  loading: boolean,
  resetKey: unknown,
): T[] {
  const prevRef = useRef<T[]>([]);
  /* Cuando se cambia de pestaña se descartan los datos previos */
  // biome-ignore lint/correctness/useExhaustiveDependencies: this is valid
  useEffect(() => {
    prevRef.current = [];
  }, [resetKey]);

  /* Cuando la petición finaliza se actualiza la caché */
  useEffect(() => {
    if (!loading) prevRef.current = data;
  }, [data, loading]);

  /* Mientras la petición está “en vuelo” se devuelven los datos previos */
  return loading ? prevRef.current : data;
}

export default function QualitySelectionScreen() {
  const navigate = useResetNavigation();

  const [tab, setTab] = useState<Tab>("lot");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSwitchedOnce, setHasSwitchedOnce] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 300);

  const lots = useLots();
  const centers = useCenters();
  const version = useVersion();
  const hasCompleteSelection = useHasCompleteSelection();

  const { setTraceability } = useFieldWorkActions();
  const { toggle, clearCenters, clearAll } = useSelectionActions();

  useOnBackNavigation(clearAll); // Handle back navigation to clear selection

  // --- Refs para estabilizar los callbacks de UI ---
  const stateRef = useRef({
    tab,
    lots,
    centers,
    hasCompleteSelection,
    isCenterTabDisabled: lots.size !== 1,
  });
  stateRef.current = {
    tab,
    lots,
    centers,
    hasCompleteSelection,
    isCenterTabDisabled: lots.size !== 1,
  };

  // --- Lógica de Búsqueda Separada ---
  const selectedLotId = useMemo(
    () => (lots.size === 1 ? Array.from(lots)[0] : undefined),
    [lots],
  );

  const lotQueryFn = useCallback(
    (query: string, page: number, limit: number) => {
      return searchService.searchLots(query, page, limit);
    },
    [],
  );
  const lotSearch = usePaginatedSearch(tab === "lot" ? debouncedQuery : "", {
    queryFn: lotQueryFn,
    pageSize: PAGE_SIZE,
  });

  const centerQueryFn = useCallback(
    (query: string, page: number, limit: number) => {
      if (selectedLotId) {
        return searchService.searchCenters(query, page, limit, selectedLotId);
      }
      return Promise.resolve([]);
    },
    [selectedLotId],
  );
  const centerSearch = usePaginatedSearch(
    tab === "center" ? debouncedQuery : "",
    { queryFn: centerQueryFn, pageSize: PAGE_SIZE },
  );

  const activeSearch = tab === "lot" ? lotSearch : centerSearch;

  const stableData = useStaleWhileLoading(
    activeSearch.data,
    activeSearch.loading,
    tab, // resetKey
  );

  const items = useMemo(
    () => stableData.map(({ id, name }) => ({ id, label: name })),
    [stableData],
  );

  const selected = useMemo(
    () => (tab === "lot" ? lots : centers),
    [tab, lots, centers],
  );

  // --- Callbacks 100% Estables ---
  const handleToggle = useCallback(
    (id: string) => {
      if (stateRef.current.tab === "lot" && stateRef.current.centers.size > 0) {
        clearCenters();
      }
      toggle(stateRef.current.tab, id);
    },
    [toggle, clearCenters],
  );

  const handleTabChange = useCallback((newTab: Tab) => {
    if (newTab === "center" && stateRef.current.isCenterTabDisabled) {
      return Alert.alert(
        "Selección requerida",
        "Por favor, seleccione un único lote antes de continuar.",
      );
    }
    setTab(newTab);
    setSearchQuery("");
  }, []);

  const handleContinue = useCallback(async () => {
    const { hasCompleteSelection, lots, centers } = stateRef.current;

    if (!hasCompleteSelection) {
      return Alert.alert(
        "Selección incompleta",
        "Por favor selecciona al menos un Lote y un Centro.",
      );
    }

    const [lotId] = Array.from(lots);
    const [centerId] = Array.from(centers);

    const lot = lotSearch.data.find((item) => item.id === lotId);
    const center = centerSearch.data.find((item) => item.id === centerId);

    setTraceability({
      lot: lot ? { id: lotId, name: lot.name } : null,
      center: center ? { id: centerId, name: center.name } : null,
    });

    navigate("/field-work/(work-flow)/(external)/overview");
  }, [setTraceability, navigate, lotSearch.data, centerSearch.data]);

  // --- Efectos Secundarios ---
  useEffect(() => {
    if (lots.size === 1 && !hasSwitchedOnce) {
      const timerId = setTimeout(() => {
        setTab("center");
        setSearchQuery("");
        setHasSwitchedOnce(true);
      }, 200);
      return () => clearTimeout(timerId);
    }
  }, [lots.size, hasSwitchedOnce]);

  // --- Memos de UI ---
  // biome-ignore lint/correctness/useExhaustiveDependencies: this is valid
  const disabledTabs = useMemo<Tab[]>(
    () => (stateRef.current.isCenterTabDisabled ? ["center"] : []),
    [lots.size],
  );

  return (
    <AppView legalTextActive={false}>
      <SelectionForm
        tab={tab}
        onTabChange={handleTabChange}
        disabledTabs={disabledTabs}
        searchText={searchQuery}
        onSearchTextChange={setSearchQuery}
        items={items}
        loading={activeSearch.loading}
        selectedSet={selected}
        toggle={handleToggle}
        version={version}
        onLoadMore={activeSearch.loadMore}
        hasMore={activeSearch.hasMore}
        continueDisabled={!hasCompleteSelection}
        onContinue={handleContinue}
      />
      <WarningCard />
    </AppView>
  );
}
