import { StyleSheet, View } from "react-native";

// import { IconChecks, IconChevronRight } from "@tabler/icons-react-native";

import { s } from "@utils/responsive";
import Svg, { Path } from "react-native-svg";

const IconChevronRight = ({ color, size }: { color: string; size: number }) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <Path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <Path d="M9 6l6 6l-6 6" />
    </Svg>
  );
};

const IconChecks = ({ color, size }: { color: string; size: number }) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <Path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <Path d="M7 12l5 5l10 -10" />
      <Path d="M2 12l5 5m5 -5l5 -5" />
    </Svg>
  );
};

interface ChecksIconProps {
  isCompleted: boolean;
  iconColor: string;
}

const ChecksIcon = ({ isCompleted, iconColor }: ChecksIconProps) => {
  const Icon = isCompleted ? IconChecks : IconChevronRight;
  return (
    <View style={[styles.container, { borderColor: iconColor }]}>
      <Icon size={s(20)} color={iconColor} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: s(8),
    bottom: s(8),
    width: s(24),
    height: s(24),
    borderWidth: s(2),
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ChecksIcon;
