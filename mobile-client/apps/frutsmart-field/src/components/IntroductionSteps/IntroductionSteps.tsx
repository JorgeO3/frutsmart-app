import type React from "react";
import { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";

import Animated, {
  withTiming,
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import StepCard from "./StepCard";
import StepArrow from "./StepArrow";
import { FONT_FAMILTY } from "@src/constants/Font";

export type Step = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

interface IntroductionStepsProps {
  steps: Step[];
  onComplete?: () => void;
}

const IntroductionSteps = ({ steps, onComplete }: IntroductionStepsProps) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 800 });
    translateY.value = withTiming(0, { duration: 800 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  const handleStepComplete = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      const newCompletedSteps = [...completedSteps, stepId];
      setCompletedSteps(newCompletedSteps);

      // Check if all steps are completed
      if (newCompletedSteps.length === steps.length && onComplete) {
        onComplete();
      }
    }
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.scrollView}>
        {steps.map((step, index) => (
          <View key={step.id} style={styles.stepWrapper}>
            <StepCard
              step={step}
              index={index}
              delay={index * 300}
              isCompleted={completedSteps.includes(step.id)}
              onComplete={() => handleStepComplete(step.id)}
            />

            {index < steps.length - 1 && (
              <StepArrow
                delay={(index + 1) * 300}
                isActive={completedSteps.includes(step.id)}
              />
            )}
          </View>
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginVertical: 20,
  },
  scrollView: {
    width: "100%",
  },
  scrollContent: {
    paddingBottom: 20,
  },
  stepWrapper: {
    width: "100%",
    marginBottom: 10,
  },
  finishButton: {
    width: "100%",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e94e1a",
    marginTop: 20,
  },
  finishButtonText: {
    color: "#fff",
    fontSize: 20,
    padding: 15,
    fontFamily: FONT_FAMILTY,
  },
});

export default IntroductionSteps;
