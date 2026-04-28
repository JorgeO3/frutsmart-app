import { s } from "@/src/utils/responsive";

/**
 * Spacing scale (in pixels) for margin, padding, etc.
 * Follows a 4px base grid.
 */
export const SPACING = {
  0: 0,
  xxs: s(4),
  xs: s(6),
  sm: s(8),
  md: s(10),
  lg: s(12),
  xl: s(16),
  xxl: s(20),
  xxxl: s(24),
  xxxxl: s(32),
} as const;

export type SpacingKeys = keyof typeof SPACING;
