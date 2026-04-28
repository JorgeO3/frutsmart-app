/**
 * zIndex scale for layering components.
 */
export const Z_INDEX = {
  dropdown: 1000,
  modal: 1100,
  overlay: 1200,
  popover: 1300,
  tooltip: 1400,
} as const;

export type ZIndexKeys = keyof typeof Z_INDEX;
export type ZIndex = (typeof Z_INDEX)[keyof typeof Z_INDEX];
