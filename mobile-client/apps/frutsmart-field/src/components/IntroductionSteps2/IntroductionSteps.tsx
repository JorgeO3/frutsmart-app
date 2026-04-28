import { useEffect } from "react";
import { View } from "react-native";

import { StepCard } from "./StepCard";

import {
  useCurrentIntroStep,
  useVisitedIntroSteps,
} from "@stores/introStepProgress";
import { scale } from "@utils/responsive";

export type Step = {
  id: string;
  title: string;
  imgSrc: string;
  description: string;
  onPress: () => void;
};

interface IntroductionStepsProps {
  steps: Step[];
  onComplete?: () => void;
}

function IntroductionSteps({ steps, onComplete }: IntroductionStepsProps) {
  const currentStep = useCurrentIntroStep();
  const visitedSteps = useVisitedIntroSteps();

  useEffect(() => {
    if (onComplete && visitedSteps === steps.length) {
      onComplete();
    }
  }, [visitedSteps, onComplete, steps.length]);

  return (
    <View style={{ flex: 1, gap: scale(25), marginVertical: scale(20) }}>
      {steps.map(({ id, description, imgSrc, title, onPress }, index) =>
        index + 1 <= currentStep ? (
          <StepCard
            key={id}
            title={title}
            imgSrc={imgSrc}
            index={index + 1}
            description={description}
            isCompleted={index + 1 <= visitedSteps}
            onPress={onPress}
          />
        ) : null,
      )}
    </View>
  );
}

export { IntroductionSteps };
