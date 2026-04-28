import { s } from "@utils/responsive";

/**
 * Border radius scale (in pixels).
 */
export const RADII = {
  none: 0,
  sm: s(4),
  md: s(8),
  lg: s(16),
  xl: s(24),
  full: s(9999),
} as const;
