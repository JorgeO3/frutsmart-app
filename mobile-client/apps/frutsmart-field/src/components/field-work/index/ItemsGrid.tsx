import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, useWindowDimensions, View } from "react-native";

import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";

import { s, vs } from "@utils/responsiveV2";

import Card from "./Card";
import { useWhyDidYouUpdate } from "@/src/hooks/useWhyDidYouUpdate";

interface Item {
  id: string;
  label: string;
}

interface GridProps {
  items: Item[];
  selectedSet: Set<string>;
  toggle(id: string): void;
  version: number;
  onLoadMore(): void;
  hasMore: boolean;
  isLoading: boolean;
}

const ListFooter = React.memo(({ hasMore }: { hasMore: boolean }) =>
  hasMore ? <ActivityIndicator style={{ marginVertical: vs(20) }} /> : null,
);

export function ItemsGrid(props: GridProps) {
  useWhyDidYouUpdate("ItemsGrid", props);
  const {
    items,
    selectedSet,
    toggle,
    version,
    onLoadMore,
    hasMore,
    isLoading,
  } = props;

  const { width } = useWindowDimensions();
  const keyExtractor = useCallback((i: { id: string }) => i.id, []);

  const estimatedSize = useMemo(() => {
    const numColumns = 2;
    const parentPadding = s(16); // Padding del componente padre (SelectionForm)
    const listPadding = s(40); // Padding del contentContainerStyle de FlashList
    const cardMargin = s(4); // Margen horizontal de cada Card

    // 1. Ancho disponible para la FlashList, considerando el padding de su padre.
    const listWidth = width - parentPadding * 2;

    // 2. Ancho disponible para el contenido de las columnas, restando el padding interno de la lista.
    const contentWidthForColumns = listWidth - listPadding * 2;

    // 3. FlashList divide este espacio en celdas de columna.
    const columnCellWidth = contentWidthForColumns / numColumns;

    // 4. El ancho del componente Card en sí es el ancho de la celda menos sus propios márgenes.
    const cardItselfWidth = columnCellWidth - cardMargin * 2;

    // 5. Como la Card tiene un aspectRatio de 1, su altura es igual a su ancho.
    const cardItselfHeight = cardItselfWidth;

    // 6. El tamaño que FlashList necesita estimar es la altura total de la celda,
    // que es la altura del Card más sus márgenes verticales.
    return Math.ceil(cardItselfHeight);
  }, [width]);

  console.log({ estimatedSize, width });

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Item>) => {
      const isSelected = selectedSet.has(item.id);
      return (
        <Card
          id={item.id}
          label={item.label}
          isSelected={isSelected}
          onPress={toggle}
        />
      );
    },
    [selectedSet, toggle], // Dependencias estables
  );

  if (isLoading && items.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#227C26" />
      </View>
    );
  }

  return (
    <FlashList
      data={items}
      extraData={{ version, selectedSize: selectedSet.size }}
      keyExtractor={keyExtractor}
      numColumns={2}
      estimatedItemSize={estimatedSize}
      renderItem={renderItem}
      renderToHardwareTextureAndroid
      showsVerticalScrollIndicator={false}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ paddingHorizontal: s(40) }}
      ListFooterComponent={<ListFooter hasMore={hasMore} />}
      removeClippedSubviews={false}
    />
  );
}
