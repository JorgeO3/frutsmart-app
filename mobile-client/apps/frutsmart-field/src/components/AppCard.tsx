import type React from "react";
import { StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import Animated from "react-native-reanimated";
import type { ViewProps } from "react-native/Libraries/Components/View/ViewPropTypes";

interface AppCardProps extends ViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function AppCard({ style, children, ...rest }: AppCardProps) {
  return (
    <Animated.View {...rest} style={[styles.container, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DFDEDE",
  },
});
