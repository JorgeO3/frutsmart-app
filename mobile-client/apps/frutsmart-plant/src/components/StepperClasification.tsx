import { font, s } from "@utils/responsive";
import React, { memo, useEffect, useMemo } from "react";
import isEqual from "react-fast-compare";
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import AppImage from "./AppImage";

const AnimatedAppImage = Animated.createAnimatedComponent(AppImage);

// --- Tipos ---
interface StepperProps {
  totalSteps: number;
  currentStep: number;
  activeColor?: string;
  inactiveColor?: string;
  lineHeight?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  inactiveTextStyle?: StyleProp<TextStyle>;
  activeTextStyle?: StyleProp<TextStyle>;
  stepImageSource: ImageSourcePropType;
}

interface StepCircleProps {
  index: number;
  currentStep: number;
  activeColor: string;
  inactiveColor: string;
  size: number;
  textStyle?: StyleProp<TextStyle>;
  inactiveTextStyle?: StyleProp<TextStyle>;
  activeTextStyle?: StyleProp<TextStyle>;
  imageSource: ImageSourcePropType;
  inactiveImageOpacity?: number;
}

interface StepLineProps {
  index: number;
  currentStep: number;
  activeColor: string;
  inactiveColor: string;
  width: number;
  height: number;
}

// --- Constantes ---
const DEFAULTS = {
  ACTIVE_COLOR: "#F27C00",
  INACTIVE_COLOR: "#E0E0E0",
  LINE_HEIGHT: 8,
  ANIMATION_DURATION: 300,
  H_PADDING: s(40) + s(8),
  CIRCLE_TO_SPACE_RATIO: 0.65,
  MAX_CIRCLE_SIZE: s(100),
  MIN_CIRCLE_SIZE: s(35),
} as const;

const STEP_STATUS = {
  INACTIVE: 0,
  COMPLETED: 1,
  ACTIVE: 2,
} as const;

// --- Utilidades ---
const getStepStatus = (index: number, currentStep: number) => {
  if (index < currentStep) return STEP_STATUS.COMPLETED;
  if (index === currentStep) return STEP_STATUS.ACTIVE;
  return STEP_STATUS.INACTIVE;
};

const createTimingConfig = (duration = DEFAULTS.ANIMATION_DURATION) => ({
  duration,
  easing: Easing.out(Easing.quad),
});

// ---------------------------------------------------------------------------------
// SUBCOMPONENTE: StepCircle
// ---------------------------------------------------------------------------------
const StepCircleComponent = (props: StepCircleProps) => {
  const {
    index,
    currentStep,
    activeColor,
    inactiveColor,
    size,
    textStyle,
    inactiveTextStyle,
    activeTextStyle,
    inactiveImageOpacity = 0.1,
  } = props;

  const stepStatus = getStepStatus(index, currentStep);
  const isStepInactive = stepStatus === STEP_STATUS.INACTIVE;

  const isStepActiveOrCompleted =
    stepStatus === STEP_STATUS.ACTIVE || stepStatus === STEP_STATUS.COMPLETED;

  const animationProgress = useSharedValue(isStepInactive ? 0 : 1);

  useEffect(() => {
    animationProgress.value = withTiming(
      isStepInactive ? 0 : 1,
      createTimingConfig(),
    );
  }, [isStepInactive, animationProgress]);

  const animatedCircleStyle = useAnimatedStyle(() => ({
    backgroundColor: isStepActiveOrCompleted ? activeColor : inactiveColor,
  }));

  const animatedTextStyle = useAnimatedStyle(() => {
    const inactiveTextColor =
      (inactiveTextStyle as TextStyle)?.color ?? "#A0A0A0";
    const activeTextColor = (activeTextStyle as TextStyle)?.color ?? "#FFFFFF";
    return {
      color: isStepActiveOrCompleted ? activeTextColor : inactiveTextColor,
    };
  });

  const animatedImageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animationProgress.value,
      [0, 1], // Inactivo -> Activo/Completado
      [inactiveImageOpacity, 1], // Usamos la prop para el valor inicial
    ),
  }));

  const circleStyle = useMemo(
    () => [
      styles.stepCircle,
      { width: size, height: size, borderRadius: size / 2 },
      animatedCircleStyle,
    ],
    [size, animatedCircleStyle],
  );

  const textStyleMemo = useMemo(
    () => [styles.stepText, textStyle, animatedTextStyle],
    [textStyle, animatedTextStyle],
  );

  return (
    <View style={styles.stepCircleContainer}>
      <Animated.View style={circleStyle}>
        <Animated.Text style={[styles.stepNumber, textStyleMemo]}>
          {index + 1}
        </Animated.Text>

        <View style={styles.stepImageContainer}>
          <AnimatedAppImage
            // style={{ opacity: 0.5 }}
            source={props.imageSource}
            style={[
              {
                width: "100%",
                height: "100%",
              },
              animatedImageStyle,
            ]}
            contentFit="contain"
            alt={`Step ${index + 1} Image`}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const StepCircle = memo(StepCircleComponent, isEqual);
StepCircle.displayName = "StepCircle";

// ---------------------------------------------------------------------------------
// SUBCOMPONENTE: StepLine
// ---------------------------------------------------------------------------------
const StepLineComponent = (props: StepLineProps) => {
  const { index, currentStep, activeColor, inactiveColor, height, width } =
    props;

  const isCompleted = index < currentStep;
  const progress = useSharedValue(isCompleted ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isCompleted ? 1 : 0, createTimingConfig());
  }, [isCompleted, progress]);

  const animatedLineStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const containerStyle = useMemo(
    () => [
      styles.lineContainer,
      { height, backgroundColor: inactiveColor, width },
    ],
    [height, inactiveColor, width],
  );

  const activeLineStyle = useMemo(
    () => [
      styles.lineActive,
      { height, backgroundColor: activeColor },
      animatedLineStyle,
    ],
    [height, activeColor, animatedLineStyle],
  );

  return (
    <View style={containerStyle}>
      <Animated.View style={activeLineStyle} />
    </View>
  );
};

const StepLine = memo(StepLineComponent, isEqual);
StepLine.displayName = "StepLine";

// ---------------------------------------------------------------------------------
// HOOK PERSONALIZADO: Cálculos de dimensiones
// ---------------------------------------------------------------------------------
const useStepperDimensions = (totalSteps: number) => {
  const { width: screenWidth } = useWindowDimensions();

  return useMemo(() => {
    const usableWidth = screenWidth - DEFAULTS.H_PADDING;
    const totalSpaceForCircles = usableWidth * DEFAULTS.CIRCLE_TO_SPACE_RATIO;
    const calculatedSize =
      totalSteps > 0 ? totalSpaceForCircles / totalSteps : 0;

    const circleSize = Math.max(
      DEFAULTS.MIN_CIRCLE_SIZE,
      Math.min(calculatedSize, DEFAULTS.MAX_CIRCLE_SIZE),
    );

    const lineWidth =
      totalSteps > 1
        ? (usableWidth - totalSteps * circleSize) / (totalSteps - 1)
        : 0;

    return { circleSize, lineWidth };
  }, [screenWidth, totalSteps]);
};

// ---------------------------------------------------------------------------------
// COMPONENTE PRINCIPAL: StepperClassification
// ---------------------------------------------------------------------------------
const StepperClassificationComponent = (props: StepperProps) => {
  const {
    totalSteps,
    currentStep,
    activeColor = DEFAULTS.ACTIVE_COLOR,
    inactiveColor = DEFAULTS.INACTIVE_COLOR,
    lineHeight = DEFAULTS.LINE_HEIGHT,
    style,
    textStyle,
    stepImageSource,
    inactiveTextStyle = styles.stepTextInactive,
    activeTextStyle = styles.stepTextActive,
  } = props;

  const { circleSize, lineWidth } = useStepperDimensions(totalSteps);

  const steps = useMemo(
    () => Array.from({ length: totalSteps }, (_, i) => i),
    [totalSteps],
  );

  if (totalSteps <= 1) return null;

  return (
    <View style={[styles.container, style]}>
      {steps.map((stepIndex) => (
        <React.Fragment key={`step_${stepIndex}`}>
          <StepCircle
            index={stepIndex}
            currentStep={currentStep}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
            size={circleSize}
            textStyle={textStyle}
            imageSource={stepImageSource}
            inactiveTextStyle={inactiveTextStyle}
            activeTextStyle={activeTextStyle}
          />
          {stepIndex < totalSteps - 1 && (
            <StepLine
              index={stepIndex}
              height={lineHeight}
              width={lineWidth}
              currentStep={currentStep}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

const StepperClassification = memo(StepperClassificationComponent, isEqual);

export default memo(StepperClassification, isEqual);

// ---------------------------------------------------------------------------------
// ESTILOS
// ---------------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: s(8),
    width: "100%",
  },
  stepCircleContainer: {
    justifyContent: "center",
    alignItems: "center",
    flexGrow: 1,
    position: "relative",
  },
  stepCircle: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: DEFAULTS.INACTIVE_COLOR,
    zIndex: 1,
  },
  stepNumber: {
    position: "absolute",
    top: -s(17),
    left: "38%",
  },
  stepImageContainer: {
    position: "absolute",
    top: "5%",
    left: -s(5),
    width: s(60),
    height: s(60),
  },
  stepText: {
    fontWeight: "bold",
    fontSize: font.scale(25),
  },
  stepTextInactive: {
    color: "#A0A0A0",
  },
  stepTextActive: {
    color: "#FFFFFF",
  },
  lineContainer: {
    backgroundColor: DEFAULTS.INACTIVE_COLOR,
    overflow: "hidden",
  },
  lineActive: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
