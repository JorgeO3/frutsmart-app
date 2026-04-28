import React from "react";
import { StyleSheet, ActivityIndicator } from "react-native";

import { scale } from "@utils/responsive";

import AppButton from "@components/AppButton";
import AppText from "@components/AppText";

import { TabBar } from "./TabBar";
import type { Item } from "./types";
import { ItemsGrid } from "./ItemGrid";
import { SearchInputFilter } from "./SearchInputFilter";

export type TabType = "lote" | "centro";

const SPACING = 8;

export interface SelectionProps {
  title: string;

  // Props que vienen del estado del padre (IndexScreen) basado en el tab activo
  activeItems: Item[];
  isLoadingActive: boolean;
  activeSelected: string[];
  searchText: string;
  activeTab: TabType;

  // Handlers pasados del padre (IndexScreen)
  onTabChange: (tab: TabType) => void;
  onSearchChange: (searchText: string) => void;
  onToggleItem: (id: string) => void; // Nuevo handler para alternar ítem
  onPressContinue: () => void; // Handler para el botón continuar
  continueButtonDisabled: boolean; // Prop para deshabilitar el botón continuar
  onLoadMore?: () => void; // Handler opcional para cargar más ítems
  hasMore?: boolean; // Prop opcional para indicar si hay más ítems para cargar
}

export default function SelectionTabsFilter(props: SelectionProps) {
  const {
    title,
    activeTab,
    searchText,
    activeItems,
    onTabChange,
    onToggleItem,
    onSearchChange,
    activeSelected,
    isLoadingActive,
    onPressContinue,
    continueButtonDisabled,
  } = props;

  const handlePressContinue = () => {
    onPressContinue();
  };

  // Handler para el toggle de un ítem (simplemente llama al handler del padre)
  const handleToggleItemPress = (id: string) => {
    onToggleItem(id);
  };

  return (
    <>
      <AppText.BodyM style={{ textAlign: "center", marginBottom: scale(16) }}>
        {title}
      </AppText.BodyM>

      {/* Tabs */}
      <TabBar active={activeTab} onSwitch={onTabChange} />

      {/* Search Bar */}
      <SearchInputFilter value={searchText} onChange={onSearchChange} />

      {/* Data list */}
      {isLoadingActive ? ( // Usar el estado de carga del tab activo
        <ActivityIndicator style={styles.loader} />
      ) : (
        <ItemsGrid
          items={activeItems} // Pasar los ítems del tab activo
          selected={activeSelected} // Pasar la selección del tab activo
          toggle={handleToggleItemPress} // Pasar el nuevo handler para alternar ítem
          onLoadMore={props.onLoadMore} // Pasar el handler opcional para cargar más
          hasMore={props.hasMore} // Pasar la prop opcional para indicar si hay más ítems
        />
      )}

      {/* Continue Button */}
      <AppButton
        color="primary"
        title="Continuar"
        onPress={handlePressContinue} // Usar el handler local que llama al del padre
        style={styles.continueBtn}
        disabled={continueButtonDisabled} // Usar el prop para deshabilitar
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: scale(SPACING * 2),
  },
  loader: {
    flex: 1,
    marginTop: scale(SPACING * 2),
  },
  continueBtn: {
    marginTop: scale(15),
  },
});
