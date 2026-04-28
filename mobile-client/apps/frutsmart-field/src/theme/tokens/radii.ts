import { scale } from "@utils/responsive";

/**
 * Border radius scale (in pixels).
 */
export const RADII = {
  none: 0,
  sm: scale(4),
  md: scale(8),
  lg: scale(16),
  xl: scale(24),
  full: scale(9999),
} as const;
