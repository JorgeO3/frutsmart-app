import React from "react";
import { StyleSheet, View } from "react-native";

import { IconChecks, IconChevronRight } from "@tabler/icons-react-native";

import { scale } from "@/src/utils/responsive";
import { s, vs } from "@/src/utils/responsiveV2";

interface ChecksIconProps {
  isCompleted: boolean;
  iconColor: string;
}

const ChecksIcon = ({ isCompleted, iconColor }: ChecksIconProps) => {
  const Icon = isCompleted ? IconChecks : IconChevronRight;
  return (
    <View style={[styles.container, { borderColor: iconColor }]}>
      <Icon size={scale(20)} color={iconColor} strokeWidth={2} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: scale(8),
    bottom: scale(8),
    width: s(24),
    height: s(24),
    borderWidth: s(2),
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ChecksIcon;
