import type React from "react";
import {
  View,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
  type TextStyle,
} from "react-native";

import { THEME } from "@src/theme";
import AppText from "@components/AppText";
import AppIcon, { type Icon } from "@components/AppIcon";

type AlertVariant = keyof typeof THEME.components.AppAlert.container.variants;

interface Props {
  title?: string;
  message: string;
  variant: AlertVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const VARIANT_TO_ICON: Record<AlertVariant, Icon> = {
  info: AppIcon.InfoCircle,
  error: AppIcon.AlertCircle,
  success: AppIcon.CircleCheck,
  warning: AppIcon.AlertCircle,
} as const;

const AppAlert = (props: Props) => {
  const backgroundColor =
    THEME.components.AppAlert.container.variants[props.variant];

  const IconComponent = VARIANT_TO_ICON[props.variant];
  const iconColor = THEME.components.AppAlert.icon.variants[props.variant];
  const titleColor = iconColor;

  const AlertTitle = props.title && (
    <AppText.ControlM style={[styles.title, titleColor]}>
      {props.title}
    </AppText.ControlM>
  );

  return (
    <View style={[styles.container, backgroundColor, props.style]}>
      <View style={styles.iconContainer}>
        <IconComponent size={30} color={iconColor.color} />
      </View>
      <View style={styles.textContainer}>
        {AlertTitle}

        <AppText.BodyS style={[styles.message, props.textStyle]}>
          {props.message}
        </AppText.BodyS>
      </View>
    </View>
  );
};

export default AppAlert;

const styles = StyleSheet.create({
  title: { ...THEME.components.AppAlert.title.base },
  container: { ...THEME.components.AppAlert.container.base },

  iconContainer: THEME.components.AppAlert.iconContainer,
  textContainer: THEME.components.AppAlert.textContainer,

  message: THEME.components.AppAlert.message,
});
