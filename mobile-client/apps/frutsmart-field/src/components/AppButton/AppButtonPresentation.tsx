import type React from "react";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import Animated from "react-native-reanimated";

import { THEME } from "@src/theme";

type PressableProps = React.ComponentProps<typeof Pressable>;

interface PresentationProps extends PressableProps {
  disabled: boolean;
  onPress: () => void;
  children?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  animatedStyle?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const AppButtonPresentation = ({ children, ...props }: PresentationProps) => {
  return (
    <AnimatedPressable
      onPress={props.onPress}
      disabled={props.disabled}
      onPressIn={props.onPressIn}
      onPressOut={props.onPressOut}
      style={[styles.button, props.animatedStyle, props.containerStyle]}
    >
      {children}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: { ...THEME.components.AppButton.base },
});

export default AppButtonPresentation;
