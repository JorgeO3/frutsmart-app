import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
} from "react-native-reanimated";

import { FONT_FAMILTY } from "@src/constants/Font";

import type { Step } from "./IntroductionSteps";

interface StepCardProps {
  step: Step;
  index: number;
  isCompleted: boolean;
  onComplete: () => void;
  delay: number;
}

const StepCard = ({
  step,
  index,
  isCompleted,
  onComplete,
  delay,
}: StepCardProps) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const checkScale = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 600 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 600 }));
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (isCompleted) {
      // Animate check mark appearance with bounce
      checkScale.value = withSpring(1, { damping: 12, stiffness: 90 });

      // Flash animation for card
      flashOpacity.value = withSequence(
        withTiming(0.3, { duration: 100 }),
        withTiming(0, { duration: 300 }),
      );
    }
  }, [isCompleted]);

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  const animatedCheckStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkScale.value }],
      opacity: checkScale.value,
    };
  });

  const flashAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: flashOpacity.value,
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "#92b516",
      borderRadius: 12,
    };
  });

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onComplete}
      disabled={isCompleted}
    >
      <Animated.View style={[styles.container, animatedCardStyle]}>
        <View style={styles.circleContainer}>
          <View style={[styles.circle, isCompleted && styles.completedCircle]}>
            <Text style={styles.circleText}>{index + 1}</Text>
          </View>
        </View>

        <View style={styles.cardContainer}>
          <Animated.View style={flashAnimatedStyle} />

          <View style={styles.iconContainer}>{step.icon}</View>

          <View style={styles.contentContainer}>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.description}>{step.description}</Text>
          </View>

          {isCompleted && (
            <Animated.View style={[styles.checkContainer, animatedCheckStyle]}>
              <Text style={styles.checkText}>✅</Text>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 5,
    width: "100%",
  },
  circleContainer: {
    width: 50,
    alignItems: "center",
    marginRight: 10,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#92b516",
    justifyContent: "center",
    alignItems: "center",
  },
  completedCircle: {
    backgroundColor: "#92b516",
    borderWidth: 2,
    borderColor: "#fff",
  },
  circleText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: FONT_FAMILTY,
  },
  cardContainer: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: "relative",
    overflow: "hidden",
  },
  iconContainer: {
    marginRight: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    color: "#92b516",
    fontFamily: FONT_FAMILTY,
    marginBottom: 5,
  },
  description: {
    fontSize: 14,
    color: "#555",
    fontFamily: FONT_FAMILTY,
  },
  checkContainer: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  checkText: {
    fontSize: 20,
  },
});

export default StepCard;
