import { memo, useCallback, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { Tab } from "@/src/stores/qualitySelection";
import { font, s } from "@utils/responsive";

const INDICATOR_WIDTH = s(100);
const INDICATOR_HEIGHT = s(4);
const HORIZONTAL_PADDING = s(20);

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
  const animatedIndex = useSharedValue(active === "program" ? 0 : 1);

  useDerivedValue(() => {
    animatedIndex.value = withTiming(active === "program" ? 0 : 1, {
      duration: 250,
    });
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  const indicatorStyle = useAnimatedStyle(() => {
    if (containerWidth === 0) return {};

    const tabWidth = containerWidth / 2;
    const tabLot = tabWidth * animatedIndex.value + tabWidth / 2;
    const indicatorLeft = tabLot - INDICATOR_WIDTH / 2;

    return {
      transform: [{ translateX: indicatorLeft }],
    };
  });

  const tabWidth = containerWidth / 2;
  const handleProgramPress = useCallback(() => onSwitch("program"), [onSwitch]);
  const handleLotPress = useCallback(() => onSwitch("lot"), [onSwitch]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container} onLayout={handleLayout}>
        <View style={styles.tabContainer}>
          <TabItem
            title="Programa"
            onPress={handleProgramPress}
            isActive={active === "program"}
            isDisabled={disabledTabs.includes("program")}
          />
          <TabItem
            title="Lote"
            onPress={handleLotPress}
            isActive={active === "lot"}
            isDisabled={disabledTabs.includes("lot")}
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
    marginBottom: s(15),
  },
  container: {
    borderRadius: s(8),
    overflow: "hidden",
  },
  tabContainer: {
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: s(14),
    zIndex: 2,
  },
  txt: {
    color: "#888",
    fontSize: font.scale(16),
    fontFamily: "Montserrat",
    letterSpacing: 0.3,
  },
  txtActive: {
    color: "#e94f1c",
    fontSize: font.scale(16),
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
