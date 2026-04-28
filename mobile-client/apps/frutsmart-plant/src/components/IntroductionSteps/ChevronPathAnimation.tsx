import type React from "react";
import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";

import {
  Easing,
  withTiming,
  useSharedValue,
  type EasingFunction,
  type EasingFunctionFactory,
} from "react-native-reanimated";

import { AnimatedSvgPath } from "./AnimatedPath";
import { ChevronFollower, type ChevronKeyframe } from "./ChevronFollower";

type EasingFn = EasingFunction | EasingFunctionFactory;

interface ChevronPathAnimationProps {
  pathDefinition: string;
  pathTotalLength: number;
  chevronKeyframes: ChevronKeyframe[];
  strokeColor?: string;
  strokeWidth?: number;
  animationDuration?: number;
  easingFunction?: EasingFn;
  chevronSvg?: React.ReactNode;
  chevronSize?: number;
  chevronColor?: string;
  svgWidth?: number;
  svgHeight?: number;
  containerStyle?: ViewStyle;
  svgStyle?: ViewStyle;
  chevronContainerStyle?: ViewStyle;
}

export const ChevronPathAnimation = ({
  pathDefinition,
  pathTotalLength,
  chevronKeyframes,
  strokeColor = "black",
  strokeWidth = 2,
  animationDuration = 4000,
  easingFunction = Easing.bezier(0.25, 0.1, 0.25, 1.0),
  chevronSvg,
  chevronSize = 24,
  chevronColor = "black",
  svgWidth = 300,
  svgHeight = 300,
  containerStyle,
  svgStyle,
  chevronContainerStyle,
}: ChevronPathAnimationProps) => {
  const animationProgress = useSharedValue(0);

  useEffect(() => {
    animationProgress.value = 0;
    animationProgress.value = withTiming(1, {
      duration: animationDuration,
      easing: easingFunction,
    });
  }, [animationDuration, easingFunction, animationProgress]);

  return (
    <View
      style={[
        { position: "relative", width: svgWidth, height: svgHeight },
        containerStyle,
      ]}
    >
      <AnimatedSvgPath
        pathDefinition={pathDefinition}
        pathTotalLength={pathTotalLength}
        animationProgress={animationProgress}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        svgWidth={svgWidth}
        svgHeight={svgHeight}
        svgStyle={svgStyle}
      />
      <ChevronFollower
        animationProgress={animationProgress}
        keyframes={chevronKeyframes}
        chevronSize={chevronSize}
        chevronColor={chevronColor}
        chevronSvg={chevronSvg}
        containerStyle={chevronContainerStyle}
      />
    </View>
  );
};
