import { useLayoutEffect, useMemo } from "react";
import { useNavigation } from "expo-router";

type TintColor = "light" | "dark" | string;

/**
 * Screen appearance configuration
 */
type ScreenAppearanceConfig = {
  /** Title for the navigation header */
  title: string;
  /** Background color for the header */
  headerBackgroundColor?: string;
  /** Tint color for header elements */
  headerTintColor?: TintColor;
  /** Show or hide the header bar */
  headerShown?: boolean;
};

/**
 * Hook to configure the appearance of navigation header
 *
 * Uses the root navigator to ensure settings are correctly applied
 * across all Expo Router scenarios.
 *
 * The headerTintColor can be:
 * - "light" (converts to "#FFFFFF")
 * - "dark" (converts to "#000000")
 * - Any valid color string
 *
 * @example
 * useScreenAppearance({
 *   title: "Profile",
 *   headerBackgroundColor: "#1F1F1F",
 *   headerTintColor: "light" // Will use white text
 * });
 */
export function useScreenAppearance({
  title,
  headerBackgroundColor = "#155425",
  headerTintColor = "light",
  headerShown = true,
}: ScreenAppearanceConfig): void {
  const navigation = useNavigation();

  // Convert 'light'/'dark' to actual colors or use the provided color
  const finalTintColor = useMemo(() => {
    if (headerTintColor === "light") return "#FFFFFF";
    if (headerTintColor === "dark") return "#000000";
    return headerTintColor;
  }, [headerTintColor]);

  useLayoutEffect(() => {
    let rootNav = navigation;
    while (rootNav.getParent?.()) {
      rootNav = rootNav.getParent();
    }

    rootNav.setOptions({
      title,
      headerStyle: { backgroundColor: headerBackgroundColor },
      headerTintColor: finalTintColor,
      headerShown,
      headerShadowVisible: false,
    });
  }, [navigation, title, headerBackgroundColor, finalTintColor, headerShown]);
}
