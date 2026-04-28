import type React from "react";
import { useMemo } from "react";
import type { ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
  interpolate,
  Extrapolation
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

export interface ChevronKeyframe {
  progressPercentage: number;
  x: number;
  y: number;
  rotation?: number;
}

interface ChevronFollowerProps {
  animationProgress: SharedValue<number>;
  keyframes: ChevronKeyframe[];
  chevronSize?: number;
  chevronColor?: string;
  chevronSvg?: React.ReactNode;
  containerStyle?: ViewStyle;
}

const sortKeyframes = (keyframes: ChevronKeyframe[]): ChevronKeyframe[] => {
  return [...keyframes].sort(
    (a, b) => a.progressPercentage - b.progressPercentage
  );
};

const buildInterpolationRanges = (sortedKeyframes: ChevronKeyframe[]) => {
  const linearInputRange = sortedKeyframes.map(kf => kf.progressPercentage / 100);
  const linearOutputRangeX = sortedKeyframes.map(kf => kf.x);
  const linearOutputRangeY = sortedKeyframes.map(kf => kf.y);

  const epsilon = 0.0001;
  const steppedRotationInput: number[] = [];
  const steppedRotationOutput: number[] = [];

  for (let i = 0; i < sortedKeyframes.length; i++) {
    const currentKf = sortedKeyframes[i];
    const currentProgress = currentKf.progressPercentage / 100;
    const currentRotation = currentKf.rotation || 0;

    steppedRotationInput.push(currentProgress);
    steppedRotationOutput.push(currentRotation);

    if (i < sortedKeyframes.length - 1) {
      const nextKf = sortedKeyframes[i + 1];
      const nextRotation = nextKf.rotation || 0;
      
      if (currentRotation !== nextRotation) {
        steppedRotationInput.push(currentProgress + epsilon);
        steppedRotationOutput.push(nextRotation);
      }
    }
  }

  return {
    linearInputRange,
    linearOutputRangeX,
    linearOutputRangeY,
    steppedRotationInput,
    steppedRotationOutput
  };
};

export const ChevronFollower = ({
  animationProgress,
  keyframes: originalKeyframes,
  chevronSize = 24,
  chevronColor = "black",
  chevronSvg,
  containerStyle,
}: ChevronFollowerProps) => {
  const sortedKeyframes = useMemo(() => sortKeyframes(originalKeyframes), [originalKeyframes]);
  
  const {
    linearInputRange,
    linearOutputRangeX,
    linearOutputRangeY,
    steppedRotationInput,
    steppedRotationOutput
  } = useMemo(() => buildInterpolationRanges(sortedKeyframes), [sortedKeyframes]);

  const animatedStyle = useAnimatedStyle(() => {
    const interpolatedX = interpolate(
      animationProgress.value,
      linearInputRange,
      linearOutputRangeX,
      Extrapolation.CLAMP
    );

    const interpolatedY = interpolate(
      animationProgress.value,
      linearInputRange,
      linearOutputRangeY,
      Extrapolation.CLAMP
    );

    const interpolatedRotation = interpolate(
      animationProgress.value,
      steppedRotationInput,
      steppedRotationOutput,
      Extrapolation.CLAMP
    );

    return {
      position: "absolute",
      left: interpolatedX - chevronSize / 2,
      top: interpolatedY - chevronSize / 2,
      transform: [{ rotate: `${interpolatedRotation}deg` }],
    };
  });

  return (
    <Animated.View style={[animatedStyle, containerStyle]}>
      <Svg width={chevronSize} height={chevronSize} viewBox="0 0 24 24">
        {chevronSvg || (
          <Path
            d="M9 6l6 6l-6 6"
            fill="none"
            stroke={chevronColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </Animated.View>
  );
};