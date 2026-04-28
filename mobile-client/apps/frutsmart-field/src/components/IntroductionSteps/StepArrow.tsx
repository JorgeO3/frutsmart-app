import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

interface StepArrowProps {
  delay: number;
  isActive: boolean;
}

const StepArrow = ({ delay, isActive }: StepArrowProps) => {
  const lineHeight = useSharedValue(0);
  const opacity = useSharedValue(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (isActive) {
      // Animate the line drawing effect when the step is active
      lineHeight.value = withTiming(40, {
        duration: 600,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    }
  }, [isActive]);

  const animatedLineStyle = useAnimatedStyle(() => {
    return {
      height: lineHeight.value,
      opacity: opacity.value,
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.lineContainer}>
        <Animated.View style={[styles.line, animatedLineStyle]} />
        <View style={styles.dot} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 50,
    alignItems: "center",
    height: 40,
    marginLeft: 20,
  },
  lineContainer: {
    width: 2,
    height: 40,
    justifyContent: "flex-start",
    alignItems: "center",
    overflow: "hidden",
  },
  line: {
    width: 2,
    backgroundColor: "#92b516",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#92b516",
    position: "absolute",
    bottom: 0,
  },
});

export default StepArrow;
