import type React from "react";
import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type LayoutChangeEvent,
} from "react-native";

import Animated, {
  useSharedValue,
  useDerivedValue,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import { IconChevronDown } from "@tabler/icons-react-native";

interface AccordionItemProps {
  /** Título visible en el header del acordeón */
  title: string;
  /** Contenido JSX que se muestra al expandir */
  children: React.ReactNode;
  /** Duración de la animación en milisegundos (opcional) */
  duration?: number;
}

/**
 * AccordionItem:
 * Muestra un encabezado con título e ícono, y un contenido
 * que se expande/colapsa con animaciones de Reanimated.
 */
const AppAccordion = ({
  title,
  children,
  duration = 300,
}: AccordionItemProps) => {
  const [expanded, setExpanded] = useState(false);

  // Almacena la altura del contenido interno
  const contentHeight = useSharedValue(0);

  // Al medir la altura del contenido, la guardamos en el sharedValue
  const onLayoutContent = (e: LayoutChangeEvent) => {
    contentHeight.value = e.nativeEvent.layout.height;
  };

  // Calcula la altura animada (de 0 a contentHeight)
  const animatedHeight = useDerivedValue(() => {
    return withTiming(expanded ? contentHeight.value : 0, {
      duration,
    });
  });

  // Estilo animado para el contenedor del contenido
  const containerStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
    overflow: "hidden",
  }));

  // Rotación del ícono (0 a 180 grados)
  const rotate = useDerivedValue(() => {
    return withTiming(expanded ? 180 : 0, { duration });
  });

  // Aplicamos la rotación al estilo del ícono
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const toggleAccordion = () => {
    setExpanded((prev) => !prev);
  };

  return (
    <View style={styles.accordionContainer}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggleAccordion}
        activeOpacity={0.7}
      >
        <Text style={styles.headerText}>{title}</Text>
        {/* Icono rotado con Animated */}
        <Animated.View style={iconStyle}>
          <IconChevronDown size={24} color="#155425" />
        </Animated.View>
      </TouchableOpacity>

      {/* Contenido animado */}
      <Animated.View style={[styles.animatedContent, containerStyle]}>
        <View onLayout={onLayoutContent} style={styles.contentWrapper}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
};

export default AppAccordion;

const styles = StyleSheet.create({
  accordionContainer: {
    borderWidth: 1,
    borderColor: "#E1E1E1",
    marginBottom: 12,
    borderRadius: 4,
  },
  header: {
    flexDirection: "row",
    backgroundColor: "#e9e9e9",
    borderColor: "#E1E1E1",
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "space-between",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  headerText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#155425",
  },
  animatedContent: {
    // Se muestra/oculta con la propiedad 'height' animada
    overflow: "hidden",
  },
  contentWrapper: {
    // Separación interna del contenido
    padding: 16,
  },
});
