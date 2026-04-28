import React from "react";
import { ActivityIndicator, useWindowDimensions } from "react-native";

import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { FlashList } from "@shopify/flash-list";
import type { FlashListProps } from "@shopify/flash-list";

import { scale } from "@utils/responsive";

import type { Item } from "./types";
import { AnimatedCard } from "./AnimatedCard";

const SPACING = scale(8);

// Componente animado para la FlashList
const AnimatedFlashList =
  Animated.createAnimatedComponent<FlashListProps<Item>>(FlashList);

interface ItemsGridProps {
  items: Item[];
  selected: string[];
  toggle: (id: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function ItemsGrid({
  items,
  selected,
  toggle,
  onLoadMore,
  hasMore,
}: ItemsGridProps) {
  const { width } = useWindowDimensions();
  const icon = require("@assets/images/palm-oil-icon.svg");

  return (
    <AnimatedFlashList
      data={items}
      extraData={selected}
      keyExtractor={(i) => i.id}
      numColumns={2}
      estimatedItemSize={width * 0.5}
      showsVerticalScrollIndicator={false}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        hasMore ? (
          <Animated.View style={{ padding: SPACING }}>
            <ActivityIndicator size="small" color="#0000ff" />
          </Animated.View>
        ) : null
      }
      renderItem={({ item, index }) => {
        const isLeft = index % 2 === 0;
        const isSel = selected.includes(item.id);
        return (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            layout={LinearTransition.springify()}
            style={[
              {
                flex: 1,
                aspectRatio: 1,
                marginBottom: SPACING,
              },
              // margen horizontal para separar columnas
              isLeft
                ? { marginRight: SPACING / 2 }
                : { marginLeft: SPACING / 2 },
            ]}
          >
            <AnimatedCard
              imgSrc={icon}
              label={item.label}
              isSelected={isSel}
              onPress={() => toggle(item.id)}
            />
          </Animated.View>
        );
      }}
    />
  );
}
