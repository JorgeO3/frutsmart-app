import type { ColorValue } from "react-native";

/**
 * Elevation and shadow presets for React Native (Android & iOS).
 */
export const SHADOWS = {
  none: {
    elevation: 0,
    shadowColor: "#000" as ColorValue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  sm: {
    elevation: 1,
    shadowColor: "#000" as ColorValue,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
  },
  md: {
    elevation: 2,
    shadowColor: "#000" as ColorValue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  lg: {
    elevation: 4,
    shadowColor: "#000" as ColorValue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  xl: {
    elevation: 8,
    shadowColor: "#000" as ColorValue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
  },
} as const;
