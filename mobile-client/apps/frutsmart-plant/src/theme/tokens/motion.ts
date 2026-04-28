import { Easing, type EasingFunction } from "react-native-reanimated";

/**
 * Spring configuration for Reanimated.
 */
export interface SpringConfig {
  damping: number;
  stiffness?: number;
  mass?: number;
}

/**
 * Motion tokens for animations using Reanimated.
 */
export const MOTION = {
  durations: {
    // Overlays
    modal: 300,
    alertBanner: 200,
    toast: 300,
    popover: 150,
    // Collapsible
    accordion: 200,
    iconRotate: 150,
    // Inputs & controls
    buttonPress: 100,
    checkbox: 120,
    toggle: 150,
    sliderRelease: 150,
    // Tabs
    tabsContent: 200,
    tabIndicator: 150,
    // Calendar
    calendarMonth: 300,
    calendarSelect: 100,
    // Feedback
    skeletonPulse: 800,
    skeletonShimmer: 1000,
    pagination: 200,
  } as const,
  easings: {
    default: Easing.inOut(Easing.quad) as EasingFunction,
  } as const,
  springs: {
    // Swipe to dismiss toasts and alerts
    swipeDismiss: { damping: 18 } as SpringConfig,
    // Menu/tab indicator
    menuIndicator: { damping: 20 } as SpringConfig,
    // Inertia for carousels
    inertia: { damping: 15, mass: 1 } as SpringConfig,
    // Checkbox mixed state
    checkboxMixed: { damping: 10, stiffness: 100 } as SpringConfig,
    // Slider thumb drag
    sliderThumb: { stiffness: 180 } as SpringConfig,
  } as const,
} as const;
