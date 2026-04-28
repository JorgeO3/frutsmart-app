import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";

import { useDebounce } from "@hooks/useDebounce";
import { useOnBackNavigation } from "@hooks/useOnBackNavigation";
import { usePaginatedSearch } from "@hooks/usePaginatedSearch";
import { useResetNavigation } from "@hooks/useResetNavigation";
import { searchService } from "@services/search/SearchService";
import { usePlantWorkActions, type Lot } from "@stores/plantWork";
import {
  useHasCompleteSelection,
  useLots,
  usePrograms,
  useSelectionActions,
  useVersion,
  type Tab,
} from "@stores/qualitySelection";

import AppView from "@components/AppView";
import WarningCard from "@components/WarningCard";
import SelectionForm from "@components/app/plant-work/work-flow/harvest-origin/SelectionForm";

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

  const [tab, setTab] = useState<Tab>("program");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSwitchedOnce, setHasSwitchedOnce] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 300);

  const programs = usePrograms();
  const lots = useLots();
  const version = useVersion();
  const hasCompleteSelection = useHasCompleteSelection();

  const { updateTraceability } = usePlantWorkActions();
  const { toggle, clearLots, clearAll } = useSelectionActions();

  useOnBackNavigation(clearAll); // Handle back navigation to clear selection

  // --- Refs para estabilizar los callbacks de UI ---
  const stateRef = useRef({
    tab,
    lots,
    programs,
    hasCompleteSelection,
    isLotTabDisabled: programs.size !== 1,
  });
  stateRef.current = {
    tab,
    lots,
    programs,
    hasCompleteSelection,
    isLotTabDisabled: programs.size !== 1,
  };

  // --- Lógica de Búsqueda Separada ---
  const selectedProgramId = useMemo(
    () => (programs.size === 1 ? Array.from(programs)[0] : undefined),
    [programs],
  );

  const programQueryFn = useCallback(
    (query: string, page: number, limit: number) => {
      return searchService.searchPrograms(query, page, limit);
    },
    [],
  );
  const programSearch = usePaginatedSearch(
    tab === "program" ? debouncedQuery : "",
    {
      queryFn: programQueryFn,
      pageSize: PAGE_SIZE,
    },
  );

  const lotQueryFn = useCallback(
    (query: string, page: number, limit: number) => {
      if (selectedProgramId) {
        return searchService.searchLots(query, page, limit, selectedProgramId);
      }
      return Promise.resolve([]);
    },
    [selectedProgramId],
  );
  const lotSearch = usePaginatedSearch(tab === "lot" ? debouncedQuery : "", {
    queryFn: lotQueryFn,
    pageSize: PAGE_SIZE,
  });

  const activeSearch = tab === "program" ? programSearch : lotSearch;

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
    () => (tab === "program" ? programs : lots),
    [tab, lots, programs],
  );

  // --- Callbacks 100% Estables ---
  const handleToggle = useCallback(
    (id: string) => {
      // Si estamos en el tab de programa y ya hay lotes seleccionados,
      // limpiar los lotes antes de cambiar de programa
      const isProgramTab = stateRef.current.tab === "program";
      const hasLotsSelected = stateRef.current.lots.size > 0;
      const isDeselectingOnlyProgram =
        stateRef.current.programs.has(id) &&
        stateRef.current.programs.size === 1;

      // Si estamos en el tab de programa y ya hay lotes seleccionados,
      // limpiar los lotes antes de cambiar de programa
      if (isProgramTab && hasLotsSelected) {
        clearLots();
      }

      // Si estamos deseleccionando el único programa, también limpiar lotes
      if (isProgramTab && isDeselectingOnlyProgram) {
        clearLots();
      }

      toggle(stateRef.current.tab, id);
    },
    [toggle, clearLots],
  );

  const handleTabChange = useCallback((newTab: Tab) => {
    if (newTab === "lot" && stateRef.current.isLotTabDisabled) {
      return Alert.alert(
        "Selección requerida",
        "Por favor, seleccione un único programa antes de continuar.",
      );
    }
    setTab(newTab);
    setSearchQuery("");
  }, []);

  const handleContinue = useCallback(async () => {
    const { hasCompleteSelection, programs, lots } = stateRef.current;

    if (!hasCompleteSelection) {
      return Alert.alert(
        "Selección incompleta",
        "Por favor selecciona al menos un Programa y un Lote.",
      );
    }

    const programId = Array.from(programs)[0];
    const program = programSearch.data.find((item) => item.id === programId);
    const lotsData: Lot[] = Array.from(lots)
      .map((lotId) => lotSearch.data.find((l) => l.id === lotId))
      .filter((l): l is NonNullable<typeof l> => l != null)
      .map(({ id, name }) => ({ id, name }));

    updateTraceability({
      ownData: {
        program: { id: programId, name: program ? program.name : "N/A" },
        lots: lotsData,
      },
    });

    navigate("/plant-work/work-flow/entry-form");
  }, [updateTraceability, navigate, programSearch.data, lotSearch.data]);

  // --- Efectos Secundarios ---
  useEffect(() => {
    // Cambiar automáticamente al tab de lotes cuando se selecciona exactamente un programa
    if (programs.size === 1 && !hasSwitchedOnce && tab === "program") {
      const timerId = setTimeout(() => {
        setTab("lot");
        setSearchQuery("");
        setHasSwitchedOnce(true);
      }, 200);
      return () => clearTimeout(timerId);
    }

    // Volver al tab de programa si no hay ningún programa seleccionado
    if (programs.size === 0 && tab === "lot") {
      setTab("program");
      setSearchQuery("");
      setHasSwitchedOnce(false);
    }
  }, [programs.size, hasSwitchedOnce, tab]);

  // --- Memos de UI ---
  // biome-ignore lint/correctness/useExhaustiveDependencies: this is valid
  const disabledTabs = useMemo<Tab[]>(
    () => (stateRef.current.isLotTabDisabled ? ["lot"] : []),
    [programs.size],
  );

  console.log({ items });

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
