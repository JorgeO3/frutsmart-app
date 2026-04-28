import { Dimensions, PixelRatio } from "react-native";

/**
 * This file provides a robust set of scaling utilities for creating responsive
 * React Native layouts. It is a hybrid approach that combines the best of
 * `react-native-size-matters` for layout dimensions and a custom, accessibility-focused
 * solution for font scaling.
 *
 * @module ScalingUtils
 */

// Get the screen's width and height
const { width, height } = Dimensions.get("window");

// Determine the short and long dimensions of the screen
const [shortDimension, longDimension] =
  width < height ? [width, height] : [height, width];
const aspectRatio = height / width;

/**
 * A boolean constant that is `true` if the device has an "ultra-tall" aspect
 * ratio (e.g., > 2.2, common in Sony phones and foldable cover screens).
 * This allows for creating adaptive layouts by applying conditional styles.
 *
 * @example
 * import { IS_ULTRA_TALL } from './scalingUtils';
 *
 * const styles = StyleSheet.create({
 * card: {
 * flexDirection: IS_ULTRA_TALL ? 'column' : 'row',
 * }
 * });
 */
export const IS_ULTRA_TALL = aspectRatio > 2.2;

// --- Guideline Sizes ---
// These are the baseline dimensions of the design.
// A common choice is the screen size of an iPhone 11/12/13.
const GUIDELINE_BASE_WIDTH = 375;
const GUIDELINE_BASE_HEIGHT = 812;

/**
 * Scales a size based on the screen's short dimension (usually the width).
 * This is the standard for scaling horizontal properties like `width`, `marginHorizontal`, etc.
 *
 * @remarks
 * A special use case for `s` is to maintain the aspect ratio of a component.
 * By using `s` for both `width` and `height`, you ensure the component scales proportionally,
 * preventing deformation (e.g., a circle becoming an oval). This is essential for components
 * like icons, avatars, or any element that must preserve its intrinsic shape.
 *
 * @param size The original size from the design.
 * @returns The scaled size for the current device's screen.
 * @example
 * // 1. General use for horizontal scaling:
 * const styles = StyleSheet.create({
 *   container: {
 *     paddingHorizontal: s(20),
 *   },
 * });
 *
 * // 2. Special use for maintaining a component's aspect ratio:
 * const styles = StyleSheet.create({
 *   avatar: {
 *     width: s(60),
 *     height: s(60), // Use s() for height to keep it a perfect square/circle
 *     borderRadius: s(30), // s(60) / 2
 *   },
 * });
 */
export const s = (size: number): number =>
  (shortDimension / GUIDELINE_BASE_WIDTH) * size;

/**
 * Scales a size based on the screen's long dimension (usually the height).
 * This is ideal for vertical properties like `height`, `marginVertical`, `paddingVertical`, `top`, `bottom`, etc.
 *
 * @param size The original size from the design.
 * @returns The scaled size for the current device's screen.
 * @example
 * const styles = StyleSheet.create({
 *   header: {
 *     height: vs(80), // Scales 80px vertically
 *     marginTop: vs(20),
 *   },
 * });
 */
export const vs = (size: number): number =>
  (longDimension / GUIDELINE_BASE_HEIGHT) * size;

/**
 * Provides a "moderate" scale. It's a dampened version of the horizontal scale,
 * applying only a fraction of the scaling factor. This is useful for elements
 * that should not scale as aggressively as the layout, such as `borderRadius` or icons.
 *
 * @param size The original size from the design.
 * @param factor The moderation factor. 0 = no scaling, 1 = full `s()` scaling. Defaults to 0.5.
 * @returns The moderately scaled size.
 * @example
 * const styles = StyleSheet.create({
 *   card: {
 *     borderRadius: ms(12), // Gently scales the border radius
 *   },
 * });
 */
export const ms = (size: number, factor = 0.5): number =>
  size + (s(size) - size) * factor;

/**
 * A private helper function to clamp a number between a minimum and a maximum value.
 */
const clamp = (num: number, min: number, max: number): number =>
  Math.min(Math.max(num, min), max);

/**
 * The definitive, "smart" function for scaling font sizes adaptively.
 *
 * It solves the problem of text wrapping excessively on narrow screens by allowing
 * the font to scale down to a minimum size. It also prevents fonts from becoming
 * too large on tablets by capping them at a maximum size.
 *
 * This function is the key to creating fluid typography that feels right on any device.
 * It also correctly respects the user's system-level accessibility font settings.
 *
 * @param size The base font size from the design (e.g., 16).
 * @param options An object to control scaling limits.
 * @param options.min The absolute minimum font size. Prevents text from becoming illegible.
 * @param options.max The absolute maximum font size. Prevents text from becoming gigantic.
 * @returns The final, accessible, and adaptive font size.
 *
 * @example
 * const styles = StyleSheet.create({
 * title: {
 * // Base size 24, won't go below 20 or above 30
 * fontSize: font.scale(24, { min: 20, max: 30 }),
 * },
 * body: {
 * // Base size 16, won't go below 14. No max limit.
 * fontSize: font.scale(16, { min: 14 }),
 * },
 * });
 */
function smartScale(
  size: number,
  options: { min?: number; max?: number } = {},
): number {
  // Scale the font size based on the screen width
  const scaledSize = s(size);

  // Clamp the scaled size between the provided min and max limits
  const finalSize = clamp(
    scaledSize,
    options.min ?? 12, // Default min to 12 if not provided
    options.max ?? 100, // Default max to 100 if not provided
  );

  // The CORRECT way to handle accessibility.
  // We calculate our ideal size for a 1x fontScale, then let React Native's
  // engine apply the system's fontScale multiplier to it.
  // We divide by the scale here ONLY if we want our `size` to be the final
  // visually-perceived size, which can be unpredictable. The simplest, most
  // robust method is to let the system handle it. However, if compensating
  // is the goal, this is a common pattern:
  // return PixelRatio.roundToNearestPixel(finalSize / PixelRatio.getFontScale());

  // For simplicity and robustness, we return the calculated size and let the RN engine do the rest.
  // The old `fontScale` had a bug where it double-scaled. This is the fix.
  return PixelRatio.roundToNearestPixel(finalSize);
}

/**
 * A namespaced object for font-related utilities to keep the API clean.
 * @property {function} scale - The main function for scaling fonts adaptively.
 */
export const font = {
  scale: smartScale,
};
