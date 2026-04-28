import type React from "react";
import type { StyleProp, ViewStyle, TextStyle } from "react-native";

import AppText, { type AppTextComponent } from "@components/AppText";

import {
  Easing,
  withTiming,
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { THEME } from "@src/theme";
import AppButtonPresentation from "./AppButtonPresentation";

type AppButtonSize = keyof typeof THEME.components.AppButton.sizes;
type AppButtonColor = keyof typeof THEME.components.AppButton.colors;

const SIZE_TO_FONT: Record<AppButtonSize, AppTextComponent> = {
  sm: AppText.ControlS,
  md: AppText.ControlM,
  lg: AppText.ControlL,
  xl: AppText.ControlXL,
} as const;

interface Props {
  title: string;
  size?: AppButtonSize;
  children?: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
  color?: AppButtonColor;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const AppButtonContainer = (props: Props) => {
  const { disabled = false, color = "primary", size = "md" } = props;

  // 1) Hook de tema para background
  const AppText = SIZE_TO_FONT[size];
  const padding = THEME.components.AppButton.sizes[size];
  const backgroundColor = THEME.components.AppButton.colors[color];

  // 2) Valores compartidos de Reanimated
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // 3) Estilo animado
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.8 : opacity.value,
  }));

  // 4) Configuración de animación
  const timingConfig = { duration: 100, easing: Easing.inOut(Easing.quad) };

  // 5) Handlers de pressIn / pressOut
  const handlePressIn = () => {
    scale.value = withTiming(0.97, timingConfig);
    opacity.value = withTiming(0.9, timingConfig);
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, timingConfig);
    opacity.value = withTiming(1, timingConfig);
  };

  // 6) Contenido por defecto si no hay children
  const content = props.children ?? (
    <AppText style={props.textStyle} color="secondary">
      {props.title}
    </AppText>
  );

  return (
    <AppButtonPresentation
      disabled={disabled}
      onPress={disabled ? () => {} : props.onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      containerStyle={[padding, backgroundColor, props.style]}
      animatedStyle={animatedStyle}
    >
      {content}
    </AppButtonPresentation>
  );
};

export default AppButtonContainer;
