import React, { useEffect, memo, useMemo, type FC } from "react";
import {
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  useWindowDimensions,
} from "react-native";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  Easing,
} from "react-native-reanimated";
import { normalizeFont, scale } from "../utils/responsive";

// --- Tipos ---
interface StepperProps {
  totalSteps: number;
  currentStep: number; // Índice base 0 (0 para el primer paso, 1 para el segundo, etc.)
  activeColor?: string;
  inactiveColor?: string;
  stepSize?: number;
  lineHeight?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  inactiveTextStyle?: StyleProp<TextStyle>;
  activeTextStyle?: StyleProp<TextStyle>;
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
}

interface StepLineProps {
  index: number;
  currentStep: number;
  activeColor: string;
  inactiveColor: string;
  flexWidth: number;
  height: number;
}

// --- Constantes ---
const DEFAULT_ACTIVE_COLOR = "#F27C00"; // Naranja
const DEFAULT_INACTIVE_COLOR = "#E0E0E0"; // Gris claro
const DEFAULT_STEP_SIZE = scale(70);
const DEFAULT_LINE_HEIGHT = 8;
const ANIMATION_DURATION = 300; // Duración de la animación en ms

// ---------------------------------------------------------------------------------
// SUBCOMPONENTE: StepCircle
// Usamos React.memo para evitar re-renders si sus props no cambian
// ---------------------------------------------------------------------------------
const StepCircle: FC<StepCircleProps> = memo(
  ({
    index,
    currentStep,
    activeColor,
    inactiveColor,
    size,
    textStyle,
    inactiveTextStyle,
    activeTextStyle,
  }) => {
    const isActive = index === currentStep;
    const isCompleted = index < currentStep;

    // Valor animado: 0 = inactivo, 1 = completado, 2 = activo
    const status = useSharedValue(isCompleted ? 1 : isActive ? 2 : 0);

    useEffect(() => {
      const targetValue = isCompleted ? 1 : isActive ? 2 : 0;
      status.value = withTiming(targetValue, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.quad),
      });
    }, [isActive, isCompleted, status]);

    // Animación de color de fondo
    const animatedStyle = useAnimatedStyle(() => {
      const backgroundColor = interpolateColor(
        status.value,
        [0, 1, 2], // inactivo, completado, activo
        [inactiveColor, activeColor, activeColor],
      );
      return { backgroundColor };
    });

    // Animación de color de texto
    const animatedTextStyle = useAnimatedStyle(() => {
      // Extraemos color por si te interesa personalizar
      const defInactiveColor =
        (inactiveTextStyle as TextStyle)?.color ?? "#A0A0A0";
      const defActiveColor = (activeTextStyle as TextStyle)?.color ?? "#FFFFFF";

      const color = interpolateColor(
        status.value,
        [0, 1, 2],
        [
          String(defInactiveColor),
          String(defActiveColor),
          String(defActiveColor),
        ],
      );
      return { color };
    });

    return (
      <Animated.View
        style={[
          styles.stepCircle,
          { width: size, height: size, borderRadius: size / 2 },
          animatedStyle,
        ]}
      >
        <Animated.Text style={[styles.stepText, textStyle, animatedTextStyle]}>
          {index + 1}
        </Animated.Text>
      </Animated.View>
    );
  },
  // Comparación personalizada, para que solo re-renderice si cambian props relevantes
  (prevProps, nextProps) => {
    return (
      prevProps.index === nextProps.index &&
      prevProps.currentStep === nextProps.currentStep &&
      prevProps.activeColor === nextProps.activeColor &&
      prevProps.inactiveColor === nextProps.inactiveColor &&
      prevProps.size === nextProps.size &&
      prevProps.textStyle === nextProps.textStyle &&
      prevProps.inactiveTextStyle === nextProps.inactiveTextStyle &&
      prevProps.activeTextStyle === nextProps.activeTextStyle
    );
  },
);

// ---------------------------------------------------------------------------------
// SUBCOMPONENTE: StepLine
// También lo memorizamos
// ---------------------------------------------------------------------------------
const StepLine: FC<StepLineProps> = memo(
  ({ index, currentStep, activeColor, inactiveColor, height, flexWidth }) => {
    const isCompleted = index < currentStep;
    const progress = useSharedValue(isCompleted ? 1 : 0); // 0 = inactivo, 1 = completado

    useEffect(() => {
      progress.value = withTiming(isCompleted ? 1 : 0, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.quad),
      });
    }, [isCompleted, progress]);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        width: `${progress.value * 100}%`,
      };
    });

    return (
      <View
        style={[
          styles.lineInactive,
          { height, backgroundColor: inactiveColor, width: flexWidth },
        ]}
      >
        <Animated.View
          style={[
            styles.lineActive,
            { height, backgroundColor: activeColor },
            animatedStyle,
          ]}
        />
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.index === nextProps.index &&
      prevProps.currentStep === nextProps.currentStep &&
      prevProps.activeColor === nextProps.activeColor &&
      prevProps.inactiveColor === nextProps.inactiveColor &&
      prevProps.height === nextProps.height
    );
  },
);

// ---------------------------------------------------------------------------------
// COMPONENTE PRINCIPAL: StepperClassification
// ---------------------------------------------------------------------------------
function StepperClassification({
  totalSteps,
  currentStep,
  activeColor = DEFAULT_ACTIVE_COLOR,
  inactiveColor = DEFAULT_INACTIVE_COLOR,
  stepSize = DEFAULT_STEP_SIZE,
  lineHeight = DEFAULT_LINE_HEIGHT,
  style,
  textStyle,
  inactiveTextStyle = styles.stepTextInactive,
  activeTextStyle = styles.stepTextActive,
}: StepperProps) {
  const { width: screenWidth } = useWindowDimensions();
  const H_PADDING = 20 * 2;
  const usableWidth = screenWidth - H_PADDING;
  const maxCircleSize = usableWidth / (totalSteps * 1.2);
  const circleSize = Math.min(stepSize, maxCircleSize);

  const lineFlexUnit =
    totalSteps > 1
      ? (usableWidth - totalSteps * circleSize) / (totalSteps - 1)
      : 0;

  // Precomputamos el array de índices para los pasos
  // Si totalSteps cambia poco, useMemo ayuda a no recrearlo en cada render
  const steps = useMemo(() => {
    return Array.from({ length: totalSteps }, (_, i) => i);
  }, [totalSteps]);

  if (totalSteps <= 1) {
    return null; // Evitamos renderizar si no hay pasos
  }

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
            inactiveTextStyle={inactiveTextStyle}
            activeTextStyle={activeTextStyle}
          />
          {stepIndex < totalSteps - 1 && (
            <StepLine
              index={stepIndex}
              height={lineHeight}
              flexWidth={lineFlexUnit}
              currentStep={currentStep}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

// Para ayudar a prevenir renders innecesarios a nivel de StepperClassification
export default memo(StepperClassification, (prev, next) => {
  // Re-render solo si cambian props relevantes
  return (
    prev.totalSteps === next.totalSteps &&
    prev.currentStep === next.currentStep &&
    prev.activeColor === next.activeColor &&
    prev.inactiveColor === next.inactiveColor &&
    prev.stepSize === next.stepSize &&
    prev.lineHeight === next.lineHeight &&
    prev.style === next.style &&
    prev.textStyle === next.textStyle &&
    prev.inactiveTextStyle === next.inactiveTextStyle &&
    prev.activeTextStyle === next.activeTextStyle
  );
});

// ---------------------------------------------------------------------------------
// ESTILOS
// ---------------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", // Distribuye el espacio uniformemente
    paddingHorizontal: 10, // Ajusta según tu layout
    width: "100%",
  },
  stepCircle: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: DEFAULT_INACTIVE_COLOR,
    zIndex: 1, // Asegura que el círculo esté por encima de la línea
  },
  stepText: {
    fontWeight: "bold",
    fontSize: normalizeFont(25),
  },
  stepTextInactive: {
    color: "#A0A0A0",
  },
  stepTextActive: {
    color: "#FFFFFF",
  },
  lineInactive: {
    flex: 1,
    backgroundColor: DEFAULT_INACTIVE_COLOR,
    marginHorizontal: -DEFAULT_STEP_SIZE / 4, // Solapa con el círculo
  },
  lineActive: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
