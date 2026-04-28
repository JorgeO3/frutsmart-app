import { scale } from "@/src/utils/responsive";

/**
 * Spacing scale (in pixels) for margin, padding, etc.
 * Follows a 4px base grid.
 */
export const SPACING = {
  0: 0,
  xxs: scale(4),
  xs: scale(6),
  sm: scale(8),
  md: scale(10),
  lg: scale(12),
  xl: scale(16),
  xxl: scale(20),
  xxxl: scale(24),
  xxxxl: scale(32),
} as const;

export type SpacingKeys = keyof typeof SPACING;
