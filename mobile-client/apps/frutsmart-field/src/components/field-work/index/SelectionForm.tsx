import React, { memo, useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import isEqual from "react-fast-compare";

import type { Tab } from "@/src/stores/qualitySelection";

import AppText from "@components/AppText";
import AppButton from "@components/AppButton";

import TabBar from "./TabBar";
import { ItemsGrid } from "./ItemsGrid";
import ItemsGridSkeleton from "./ItemsGridSkeleton";
import { SearchInputFilter } from "./SearchInputFilter";
import { s } from "@/src/utils/responsiveV2";
import { useWhyDidYouUpdate } from "@/src/hooks/useWhyDidYouUpdate";

interface Props {
  tab: Tab;
  disabledTabs?: Tab[];
  onTabChange(t: Tab): void;
  searchText: string;
  onSearchTextChange(s: string): void;
  onSearchSubmit?: () => void;
  items: { id: string; label: string }[];
  loading: boolean;
  selectedSet: Set<string>;
  toggle(id: string): void;
  version: number;
  onLoadMore(): void;
  hasMore: boolean;
  continueDisabled: boolean;
  onContinue(): void;
}

const SelectionForm = (p: Props) => {
  useWhyDidYouUpdate("SelectionForm", p);

  const showLoader = p.loading && p.items.length === 0;
  return (
    <View style={styles.container}>
      {/* Estos componentes son ligeros y se renderizan inmediatamente */}
      <AppText.BodyS style={styles.title}>
        A continuación, escoja las opciones que correspondan.
      </AppText.BodyS>

      <TabBar
        active={p.tab}
        onSwitch={p.onTabChange}
        disabledTabs={p.disabledTabs}
      />

      <SearchInputFilter
        value={p.searchText}
        placeholder="Busca..."
        onChange={p.onSearchTextChange}
        onSubmit={p.onSearchSubmit}
      />

      {showLoader ? (
        <ItemsGridSkeleton />
      ) : (
        <ItemsGrid
          items={p.items}
          toggle={p.toggle}
          version={p.version}
          hasMore={p.hasMore}
          onLoadMore={p.onLoadMore}
          selectedSet={p.selectedSet}
          isLoading={p.loading}
        />
      )}

      <AppButton
        title="Iniciar Captura"
        color="primary"
        style={styles.continue}
        disabled={p.continueDisabled}
        onPress={p.onContinue}
      />
    </View>
  );
};

export default memo(SelectionForm, isEqual);

const styles = StyleSheet.create({
  container: { flex: 1, padding: s(16) },
  title: { textAlign: "center", marginBottom: s(16) },
  continue: { marginTop: s(15) },
});
