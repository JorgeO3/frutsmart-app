import type React from "react";
import type { ViewStyle } from "react-native";

import Animated, {
  useAnimatedProps,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface AnimatedPathProps {
  pathDefinition: string;
  pathTotalLength: number;
  animationProgress: SharedValue<number>;
  strokeColor?: string;
  strokeWidth?: number;
  svgWidth?: number;
  svgHeight?: number;
  svgStyle?: ViewStyle;
}

export const AnimatedSvgPath = ({
  pathDefinition,
  pathTotalLength,
  animationProgress,
  strokeColor = "black",
  strokeWidth = 2,
  svgWidth = 300,
  svgHeight = 300,
  svgStyle,
}: AnimatedPathProps) => {
  const animatedPathProps = useAnimatedProps(() => {
    const strokeDashoffset = pathTotalLength * (1 - animationProgress.value);
    return { strokeDashoffset };
  });

  return (
    <Svg width={svgWidth} height={svgHeight} style={svgStyle}>
      <AnimatedPath
        d={pathDefinition}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathTotalLength}
        animatedProps={animatedPathProps}
      />
    </Svg>
  );
};