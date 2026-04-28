import type React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";

import Animated, {
  Easing,
  withTiming,
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { IconChevronDown } from "@tabler/icons-react-native";

import AppText from "@components/AppText";
import { useThemeColor } from "@hooks/useThemeColor";
import { scale, normalizeFont } from "@/src/utils/responsive";

interface Props {
  title: string;
  children: React.ReactNode;
  isInitiallyExpanded?: boolean;
}

export default function AppAccordionItem({
  title,
  children,
  isInitiallyExpanded = false,
}: Props) {
  // Valores compartidos
  const expanded = useSharedValue(isInitiallyExpanded ? 1 : 0);
  const maxHeight = useSharedValue(0);
  const highlight = useSharedValue(0);

  // Duraciones
  const CONTENT_DUR = 200;
  const HL_DUR = 75;

  // Toggle: resalte rápido + expand/colapse
  const toggleExpand = () => {
    // 1) highlight header
    highlight.value = withTiming(highlight.value === 0 ? 0.04 : 0, {
      duration: HL_DUR,
      easing: Easing.inOut(Easing.quad),
    });
    // 2) expand/collapse contenido
    expanded.value = withTiming(expanded.value === 0 ? 1 : 0, {
      duration: CONTENT_DUR,
      easing: Easing.inOut(Easing.quad),
    });
  };

  // 2) Valores derivados para altura y opacidad
  const animatedHeight = useDerivedValue(() =>
    withTiming(expanded.value ? maxHeight.value : 0, {
      duration: 200,
      easing: Easing.inOut(Easing.quad),
    }),
  );

  const animatedOpacity = useDerivedValue(() =>
    withTiming(expanded.value, {
      duration: 200,
      easing: Easing.inOut(Easing.quad),
    }),
  );

  // 3) Valor derivado para rotación
  const rotation = useDerivedValue(() =>
    withTiming(expanded.value * 180, {
      duration: 150,
      easing: Easing.inOut(Easing.quad),
    }),
  );

  // Contenedor colapsable
  const contentStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value, // <-- número, no objeto
    opacity: animatedOpacity.value, // <-- número, no objeto
  }));

  // Icono chevron
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Animación de fondo del header
  const headerStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(233,233,233,${highlight.value})`,
  }));

  const chevronColor = useThemeColor({}, "tint");

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggleExpand} activeOpacity={0.8}>
        <Animated.View style={[styles.header, headerStyle]}>
          <AppText.H4 color="primary">{title}</AppText.H4>
          <Animated.View style={chevronStyle}>
            <IconChevronDown size={scale(24)} color={chevronColor} />
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>

      {/* Medición invisible */}
      <View
        style={styles.hiddenMeasure}
        onLayout={(e) => {
          maxHeight.value = e.nativeEvent.layout.height;
        }}
      >
        <View style={styles.innerContainer}>{children}</View>
      </View>

      {/* Contenido colapsable */}
      <Animated.View style={[styles.contentContainer, contentStyle]}>
        <View style={styles.innerContainer}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: scale(10),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E1E1E1",
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: scale(16),
    borderBottomColor: "#E1E1E1",
    backgroundColor: "#ffffff",
  },
  headerTitle: {
    fontSize: normalizeFont(16),
    fontWeight: "600",
    color: "#155425",
  },
  contentContainer: {
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  innerContainer: {
    padding: scale(16),
  },
  hiddenMeasure: {
    position: "absolute",
    opacity: 0,
    zIndex: -1,
    width: "100%",
  },
});
