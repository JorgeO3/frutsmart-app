import React, { memo, useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
  TouchableWithoutFeedback,
} from "react-native";

import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  useDerivedValue,
} from "react-native-reanimated";

import { scale, normalizeFont } from "@utils/responsive";
import type { Tab } from "@/src/stores/qualitySelection";

const INDICATOR_WIDTH = scale(100);
const INDICATOR_HEIGHT = scale(4);
const HORIZONTAL_PADDING = scale(20);

interface TabItemProps {
  title: string;
  isActive: boolean;
  isDisabled: boolean;
  onPress: () => void;
}

const TabItem = memo(
  ({ title, isActive, isDisabled, onPress }: TabItemProps) => {
    return (
      <View style={styles.tab} onTouchEnd={isDisabled ? undefined : onPress}>
        <Text
          style={[
            styles.txt,
            isActive && styles.txtActive,
            isDisabled && styles.txtDisabled,
          ]}
        >
          {title}
        </Text>
      </View>
    );
  },
);

interface TabBarProps {
  active: Tab;
  onSwitch(t: Tab): void;
  disabledTabs?: Tab[];
}

function TabBar({ active, onSwitch, disabledTabs = [] }: TabBarProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const animatedIndex = useSharedValue(active === "lot" ? 0 : 1);

  useDerivedValue(() => {
    animatedIndex.value = withTiming(active === "lot" ? 0 : 1, {
      duration: 250,
    });
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  const indicatorStyle = useAnimatedStyle(() => {
    if (containerWidth === 0) return {};

    const tabWidth = containerWidth / 2;
    const tabCenter = tabWidth * animatedIndex.value + tabWidth / 2;
    const indicatorLeft = tabCenter - INDICATOR_WIDTH / 2;

    return {
      transform: [{ translateX: indicatorLeft }],
    };
  });

  const tabWidth = containerWidth / 2;
  const handleLotPress = useCallback(() => onSwitch("lot"), [onSwitch]);
  const handleCenterPress = useCallback(() => onSwitch("center"), [onSwitch]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container} onLayout={handleLayout}>
        <View style={styles.tabContainer}>
          <TabItem
            title="Lote"
            onPress={handleLotPress}
            isActive={active === "lot"}
            isDisabled={disabledTabs.includes("lot")}
          />
          <TabItem
            title="Centro"
            onPress={handleCenterPress}
            isActive={active === "center"}
            isDisabled={disabledTabs.includes("center")}
          />
        </View>
        {/* CAPA DE INDICADORES */}
        <View style={styles.indicatorLayer}>
          {/* Indicadores grises fijos */}
          {containerWidth > 0 &&
            [0, 1].map((index) => (
              <View
                key={index}
                style={[
                  styles.inactiveIndicator,
                  {
                    left: tabWidth * index + tabWidth / 2 - INDICATOR_WIDTH / 2,
                  },
                ]}
              />
            ))}

          {/* Indicador verde animado */}
          <Animated.View style={[styles.activeIndicator, indicatorStyle]} />
        </View>
      </View>
    </View>
  );
}

export default memo(TabBar);

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: scale(15),
  },
  container: {
    borderRadius: scale(8),
    overflow: "hidden",
  },
  tabContainer: {
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: scale(14),
    zIndex: 2,
  },
  txt: {
    color: "#888",
    fontSize: normalizeFont(16),
    fontFamily: "Montserrat",
    letterSpacing: 0.3,
  },
  txtActive: {
    color: "#e94f1c",
    fontSize: normalizeFont(16),
    fontWeight: "700",
    fontFamily: "Montserrat-SemiBold",
    letterSpacing: 0.3,
  },
  txtDisabled: {
    color: "#C0C0C0", // Lighter grey for disabled text
  },
  indicatorLayer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: INDICATOR_HEIGHT,
  },
  inactiveIndicator: {
    position: "absolute",
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    backgroundColor: "#E5E5E5",
  },
  activeIndicator: {
    position: "absolute",
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    backgroundColor: "#227c26",
    zIndex: 1,
  },
});
