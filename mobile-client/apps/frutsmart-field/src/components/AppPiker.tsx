import type React from "react";
import { useState } from "react";
import { Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  useAnimatedReaction,
  runOnJS,
} from "react-native-reanimated";
import { IconChevronUp } from "@tabler/icons-react-native";

import { scale } from "@utils/responsive";

interface Option {
  label: string;
  value: string | number;
}

interface AppPikerProps {
  options: Option[];
  onSelect: (value: Option) => void;
  placeholder?: string;
  defaultValue?: Option;
  // Añadimos una función para notificar el cambio de altura al componente padre
  onHeightChange?: (height: number) => void;
}

const ITEM_HEIGHT = scale(50);

const AppPiker = ({
  options,
  onSelect,
  defaultValue,
  placeholder = "Seleccione una opción",
  onHeightChange,
}: AppPikerProps) => {
  const [selectedOption, setSelectedOption] = useState<Option | undefined>(
    defaultValue,
  );
  const [isOpen, setIsOpen] = useState(false);
  const progress = useSharedValue(0);
  // Valor compartido para la altura del dropdown
  const dropdownHeight = useSharedValue(0);

  // Función para notificar el cambio de altura al componente padre
  const notifyHeightChange = (height: number) => {
    if (onHeightChange) {
      onHeightChange(height);
    }
  };

  // Reacción animada para actualizar la altura cuando cambia el progreso
  useAnimatedReaction(
    () => dropdownHeight.value,
    (height) => {
      runOnJS(notifyHeightChange)(height);
    },
  );

  const toggleDropdown = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    progress.value = withTiming(newIsOpen ? 1 : 0, {
      duration: 300,
    });
  };

  const selectOption = (option: Option) => {
    setSelectedOption(option);
    onSelect(option);
    toggleDropdown();
  };

  const animatedDropdownStyle = useAnimatedStyle(() => {
    const height = interpolate(
      progress.value,
      [0, 1],
      [0, options.length * ITEM_HEIGHT],
      Extrapolation.CLAMP,
    );

    // Actualizamos el valor de la altura
    dropdownHeight.value = height;

    const opacity = interpolate(
      progress.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      height,
      opacity,
      overflow: "hidden",
    };
  });

  const animatedChevronStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          rotate: withTiming(progress.value === 1 ? "180deg" : "0deg", {
            duration: 300,
          }),
        },
      ],
    };
  });

  // Estilo animado para el contenedor principal
  const animatedContainerStyle = useAnimatedStyle(() => {
    const reservedSpace = interpolate(
      progress.value,
      [0, 1],
      [0, options.length * ITEM_HEIGHT],
      Extrapolation.CLAMP,
    );
    return {
      marginBottom: reservedSpace,
    };
  });

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <TouchableOpacity style={styles.selectContainer} onPress={toggleDropdown}>
        <Text style={styles.selectedText}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Animated.View style={animatedChevronStyle}>
          <IconChevronUp color="gray" size={scale(20)} />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View style={[styles.dropdown, animatedDropdownStyle]}>
        {options.map((option, index) => (
          <TouchableOpacity
            key={option.value.toString()}
            style={[
              styles.dropdownItem,
              index === 0 && styles.firstItem,
              index === options.length - 1 && styles.lastItem,
              index > 0 && index < options.length - 1 && styles.middleItem,
            ]}
            onPress={() => selectOption(option)}
          >
            <Text>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignSelf: "center",
    zIndex: 10,
  },
  selectContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: scale(8),
    padding: scale(12),
    backgroundColor: "white",
    zIndex: 11,
  },
  selectedText: {
    color: "#333",
  },
  dropdown: {
    position: "absolute",
    top: 50,
    width: "100%",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    zIndex: 9,
  },
  dropdownItem: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: scale(12),
  },
  firstItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  middleItem: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  lastItem: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
});

export { AppPiker };
