import React from "react";
import { Text as RNText, StyleSheet } from "react-native";
import type { TextProps, StyleProp, TextStyle } from "react-native";

import { THEME } from "@src/theme";
import { VARIANTS } from "@src/theme/components/AppText";

type TextVariants = (typeof VARIANTS)[number];
type TextColors = keyof typeof THEME.components.AppText.colors;

interface TypographyProps extends TextProps {
  color?: TextColors;
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

export type AppTextComponent = React.MemoExoticComponent<
  React.FC<TypographyProps>
>;

// Tipo para el objeto que contendrá todas las variantes
type AppTextCompound = AppTextComponent & {
  [K in (typeof VARIANTS)[number]]: AppTextComponent;
};

const createTextComponent = (variant: TextVariants = "BodyM") => {
  const Component = React.memo(
    ({ color = "text", children, style, ...rest }: TypographyProps) => {
      const styles = variantStyles[variant];
      const textColor = THEME.components.AppText.colors[color];

      return (
        <RNText
          {...rest}
          allowFontScaling={false}
          style={[styles, textColor, style]}
        >
          {children}
        </RNText>
      );
    },
  );

  const componentName = variant === "BodyM" ? "AppText" : `AppText.${variant}`;
  Component.displayName = componentName;
  return Component;
};

const AppTextBase = createTextComponent();
const AppText = AppTextBase as AppTextCompound;

for (const key of VARIANTS) {
  AppText[key] = createTextComponent(key);
}

const variantStyles = StyleSheet.create(THEME.components.AppText.variants);

export default AppText;
