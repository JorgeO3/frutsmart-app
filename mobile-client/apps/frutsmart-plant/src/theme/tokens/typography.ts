import { font } from "@utils/responsive";

export const FONT_FAMILY = "Montserrat";

export const FONT_WEIGHT = {
  regular: "400",
  medium: "500",
  semiBold: "600",
  bold: "700",
  extraBold: "800",
  black: "900",
} as const;

export const FONT_STYLE = {
  normal: "normal",
  italic: "italic",
} as const;

export const FONT_SIZE = {
  xxs: font.scale(12, { min: 12, max: 14 }),
  xs: font.scale(14, { min: 14, max: 16 }),
  sm: font.scale(16, { min: 14, max: 19 }),
  md: font.scale(18, { min: 16, max: 22 }),
  lg: font.scale(20, { min: 17, max: 24 }),
  xl: font.scale(24, { min: 20, max: 30 }),
  xxl: font.scale(30, { min: 24, max: 38 }),
} as const;

export const LINE_HEIGHT = {
  tight: 1.2,
  normal: 1.5,
  loose: 1.8,
} as const;

export const TYPOGRAPHY = {
  fontFamily: FONT_FAMILY,
  fontWeight: FONT_WEIGHT,
  fontSize: FONT_SIZE,
  lineHeight: LINE_HEIGHT,
} as const;
