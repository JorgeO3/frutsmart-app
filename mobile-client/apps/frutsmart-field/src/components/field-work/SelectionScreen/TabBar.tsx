import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
} from "react-native";

import Animated, {
  withTiming,
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import type { TabType } from "./types";
import { normalizeFont, scale } from "@/src/utils/responsive";

const SPACING = 8;
const INDICATOR_WIDTH = scale(100); // Ancho de la línea del indicador

interface TabBarProps {
  active: TabType;
  onSwitch: (t: TabType) => void;
}

export function TabBar({ active, onSwitch }: TabBarProps) {
  // Estado para el ancho total del contenedor de tabs
  const [containerWidth, setContainerWidth] = useState(0);
  const anim = useSharedValue(active === "lote" ? 0 : 1);

  useEffect(() => {
    anim.value = withTiming(active === "lote" ? 0 : 1, { duration: 300 });
  }, [active, anim]);

  // Estilo animado de la línea
  const indicatorStyle = useAnimatedStyle(() => ({
    width: INDICATOR_WIDTH,
    transform: [{ translateX: anim.value * containerWidth + SPACING }],
  }));

  // Capturar ancho al renderizar
  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  return (
    <View style={styles.tabContainer}>
      <View style={styles.tabs}>
        {(["lote", "centro"] as const).map((t) => (
          <Pressable
            key={t}
            style={styles.tab}
            onPress={() => onSwitch(t)}
            onLayout={onLayout}
          >
            <Text
              style={active === t ? styles.tabLabelActive : styles.tabLabel}
            >
              {t === "lote" ? "Lote" : "Centro"}
            </Text>
          </Pressable>
        ))}
      </View>
      {/* Línea absoluta bajo las tabs */}
      <Animated.View style={[styles.indicator, indicatorStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    position: "relative", // para que indicator absolute se mida respecto a este
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: scale(SPACING),
  },
  tab: {
    flex: 1,
    paddingVertical: scale(SPACING),
    alignItems: "center",
  },
  tabLabel: {
    color: "#666",
    fontSize: normalizeFont(16),
  },
  tabLabelActive: {
    color: "#e94f1c",
    fontWeight: "bold",
    fontSize: normalizeFont(16),
  },
  indicator: {
    position: "absolute",
    bottom: 0,
    height: scale(4),
    left: scale(50 - SPACING / 2),
    backgroundColor: "#227c26",
  },
});
