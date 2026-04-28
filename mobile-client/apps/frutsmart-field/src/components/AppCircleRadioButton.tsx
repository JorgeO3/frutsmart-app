import {
  TouchableOpacity,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import AppText from "./AppText";
import { normalizeFont, scale } from "../utils/responsive";

interface CheckboxProps {
  selected: boolean;
  label?: string;
  onPress: () => void;
  outerCircleStyle?: StyleProp<ViewStyle>;
}

const AppCircleRadioButton = ({
  label,
  selected,
  onPress,
  outerCircleStyle,
}: CheckboxProps) => {
  return (
    <TouchableOpacity
      style={styles.option}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={15}
    >
      <View style={[styles.outerCircle, outerCircleStyle]}>
        <View
          style={[
            styles.innerCircle,
            { backgroundColor: selected ? "#F6A623" : "#FFFFFF" },
          ]}
        />
      </View>
      {label && (
        <AppText.ControlL
          style={[styles.label, selected && styles.labelSelected]}
        >
          {label}
        </AppText.ControlL>
      )}
    </TouchableOpacity>
  );
};

export default AppCircleRadioButton;

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
  },
  outerCircle: {
    width: scale(24),
    height: scale(24),
    borderRadius: 12,
    borderWidth: scale(2),
    borderColor: "white",
    alignItems: "center",
    backgroundColor: "white",
    justifyContent: "center",
  },
  innerCircle: {
    width: scale(14),
    height: scale(14),
    borderRadius: 7,
  },
  label: {
    color: "white",
    fontSize: normalizeFont(16),
    marginLeft: scale(10),
  },
  labelSelected: {
    fontWeight: "700",
  },
});
