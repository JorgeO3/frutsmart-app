/**
 * Color system for the application
 * Definition of palettes for light and dark mode with TypeScript support
 */

// Type definitions for better autocompletion and type safety
export type ColorTheme = {
  tint: string;

  background: string;
  backgroundSecondary: string;
  icon: string;
  navigation: string;
  tabIconDefault: string;
  tabIconSelected: string;
  border: string;

  // Button colors
  btnPrimary: string;
  btnSecondary: string;
  btnTertiary: string;

  // Text colors
  text: string;
  textSecondary: string;
  title: string;
  titleSecondary: string;

  // States
  disabled: string;

  success: string;
  successLight: string;
  successLighter: string;
  error: string;
  errorLight: string;
  errorLighter: string;
  warning: string;
  warningLight: string;
  warningLighter: string;
  info: string;
  infoLight: string;
  infoLighter: string;
};

type ThemeColors = {
  light: ColorTheme;
  dark: ColorTheme;
};

type ExcludedTextKeys =
  | "icon"
  | "border"
  | "button"
  | "background"
  | "tabIconDefault"
  | "tabIconSelected"
  | "buttonSecondary"
  | "buttonTertiary"
  | "backgroundSecondary";

export type TextColors = Exclude<keyof ColorTheme, ExcludedTextKeys>;

const tintColor = "hsl(15, 82%, 51%)"; // Accent color for light mode

// Common base colors shared across themes
const commonColors = {
  tint: tintColor,
  navigation: "hsl(135, 60%, 21%)",

  // Button colors
  btnPrimary: tintColor, // Primary button color
  btnSecondary: "hsl(204, 56%, 7%)", // Secondary button color
  btnTertiary: "	hsl(210, 1%, 69%)", // Tertiary button color

  // States
  success: "hsl(73, 78%, 40%)",
  successLight: "hsl(73, 60%, 70%)",
  successLighter: "hsl(73, 40%, 86%)",
  error: "hsl(0, 82%, 51%)",
  errorLight: "hsl(0, 65%, 75%)",
  errorLighter: "hsl(0, 45%, 86%)",
  warning: "hsl(31, 100%, 47%)",
  warningLight: "hsl(31, 80%, 70%)",
  warningLighter: "hsl(31, 60%, 86%)",
  info: "hsl(210, 75%, 55%)",
  infoLight: "hsl(210, 60%, 70%)",
  infoLighter: "hsl(210, 40%, 86%)",
};

const lightTheme = {
  background: "hsl(0, 0%, 100%)", // Clean white background for readability
  backgroundSecondary: "hsl(123, 58%, 31%)", // Slightly off-white for secondary backgrounds
  text: "hsl(0, 0%, 0%)", // Black text for maximum contrast
  textSecondary: "hsl(0, 0%, 100%)", // Light text for secondary elements
  title: commonColors.tint, // Accent color for titles
  titleSecondary: "hsl(0, 0%, 100%)", // Secondary text color for less emphasis
  icon: commonColors.tint, // Consistent accent color for icons
  tabIconDefault: "hsl(0, 0%, 100%)",
  border: "hsl(0, 0%, 82%)", // Subtle borders to delimit components without overwhelming content
  disabled: "hsl(210, 1%, 69%)", // Disabled elements to indicate inactivity
};

// Theme-specific colors
const themeSpecificColors = {
  light: {
    ...lightTheme,
  },
  dark: {
    // TODO: Currently dark mode is not planned
    // but this is a placeholder for future implementation
    ...lightTheme,
  },
};

// Helper function to generate derived colors
const generateTheme = (theme: "light" | "dark"): ColorTheme => {
  return {
    ...commonColors,
    ...themeSpecificColors[theme],
    tabIconSelected: commonColors.tint, // Selected icons highlighted with accent color
  };
};

// Complete color definition
export const Colors: ThemeColors = {
  light: generateTheme("light"),
  dark: generateTheme("dark"),
} as const;
