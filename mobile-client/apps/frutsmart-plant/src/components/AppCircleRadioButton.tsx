import {
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { font, s } from "@utils/responsive";

import AppText from "@components/AppText";

// Constantes de diseño
const CIRCLE_SIZE = 24;
const INNER_CIRCLE_SIZE = 14;
const BORDER_RADIUS = CIRCLE_SIZE / 2;
const INNER_BORDER_RADIUS = INNER_CIRCLE_SIZE / 2;
const BORDER_WIDTH = 2;
const HIT_SLOP = 15;
const ACTIVE_OPACITY = 0.7;
const LABEL_MARGIN = 10;

// Colores
const COLORS = {
  white: "#FFFFFF",
  selected: "#F6A623",
  border: "#FFFFFF",
} as const;

interface RadioButtonProps {
  selected: boolean;
  label?: string;
  onPress: () => void;
  outerCircleStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

const AppCircleRadioButton = ({
  selected,
  label,
  onPress,
  outerCircleStyle,
  disabled = false,
}: RadioButtonProps) => {
  const innerCircleStyle = [
    styles.innerCircle,
    {
      backgroundColor: selected ? COLORS.selected : COLORS.white,
    },
  ];

  const labelStyle = [
    styles.label,
    selected && styles.labelSelected,
    disabled && styles.labelDisabled,
  ];

  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.containerDisabled]}
      onPress={onPress}
      activeOpacity={ACTIVE_OPACITY}
      hitSlop={HIT_SLOP}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
    >
      <View style={[styles.outerCircle, outerCircleStyle]}>
        <View style={innerCircleStyle} />
      </View>

      {label && <AppText.ControlL style={labelStyle}>{label}</AppText.ControlL>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  containerDisabled: {
    opacity: 0.5,
  },
  outerCircle: {
    width: s(CIRCLE_SIZE),
    height: s(CIRCLE_SIZE),
    borderRadius: s(BORDER_RADIUS),
    borderWidth: s(BORDER_WIDTH),
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  innerCircle: {
    width: s(INNER_CIRCLE_SIZE),
    height: s(INNER_CIRCLE_SIZE),
    borderRadius: s(INNER_BORDER_RADIUS),
  },
  label: {
    color: COLORS.white,
    fontSize: font.scale(16),
    marginLeft: s(LABEL_MARGIN),
  },
  labelSelected: {
    fontWeight: "700",
  },
  labelDisabled: {
    opacity: 0.6,
  },
});

export default AppCircleRadioButton;
