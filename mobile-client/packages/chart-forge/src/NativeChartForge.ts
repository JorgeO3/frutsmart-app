import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Native module name registered on Android and iOS.
 *
 * This value must match:
 * - Android: NativeChartForgeModule.NAME / getName()
 * - iOS: +moduleName / RCT_EXPORT_MODULE name
 */
export const MODULE_NAME = 'NativeChartForge';

/**
 * Represents a single chart data point.
 *
 * For a pie chart, each item represents one slice.
 */
export type NativeChartDataPoint = {
  /**
   * Numeric value used to compute the chart segment size.
   *
   * Expected to be a finite positive number.
   */
  value: number;

  /**
   * Human-readable label associated with the data point.
   *
   * This value may be used by the native renderer for legends,
   * accessibility labels, or debug output.
   */
  label: string;

  /**
   * Slice color encoded as a hexadecimal string.
   *
   * Expected formats:
   * - "#RGB"
   * - "#ARGB"
   * - "#RRGGBB"
   * - "#AARRGGBB"
   *
   * Example: "#E84C16"
   */
  color: string;
};

/**
 * Configuration object used to generate a native chart image.
 *
 * Important:
 * React Native Codegen has limited support for string literal unions in
 * TurboModule specs. Therefore, fields such as `format` and `uriType` are
 * intentionally typed as `string` and must be validated by the native layer.
 */
export type NativeChartConfig = {
  /**
   * Stable unique identifier used to derive the output file name.
   *
   * The native implementation should sanitize this value before using it as a
   * file name. Recommended allowed characters: letters, numbers, "-", "_".
   */
  id: string;

  /**
   * Output bitmap width in physical pixels.
   *
   * Must be greater than zero.
   */
  width: number;

  /**
   * Output bitmap height in physical pixels.
   *
   * Must be greater than zero.
   */
  height: number;

  /**
   * Data points used to render the chart.
   *
   * Must contain at least one item.
   */
  data: Array<NativeChartDataPoint>;

  /**
   * Output image format.
   *
   * Supported values:
   * - "WEBP"
   * - "PNG"
   * - "JPEG"
   *
   * Defaults should be handled by the native implementation.
   *
   * @default "WEBP"
   */
  format?: string;

  /**
   * Compression quality.
   *
   * Expected range: 1-100.
   *
   * The native implementation should clamp or reject invalid values.
   *
   * @default 100
   */
  quality?: number;

  /**
   * URI type returned by the native module.
   *
   * Supported values:
   * - "content": returns a content:// URI, recommended for sharing files safely.
   * - "file": returns a file:// URI, useful for internal app usage.
   *
   * Defaults should be handled by the native implementation.
   *
   * @default "content"
   */
  uriType?: string;
};

/**
 * TurboModule specification for ChartForge.
 *
 * This interface is consumed by React Native Codegen to generate the native
 * platform contracts for Android and iOS.
 */
export interface Spec extends TurboModule {
  /**
   * Generates a pie chart image using the native renderer.
   *
   * @param config Chart generation configuration.
   * @returns A promise resolved with the generated image URI.
   */
  generatePieChart(config: NativeChartConfig): Promise<string>;
}

/**
 * Loads the native TurboModule instance.
 *
 * `getEnforcing` throws if the native module is not registered, which is
 * desirable here because this module is required for chart generation.
 */
export default TurboModuleRegistry.getEnforcing<Spec>('NativeChartForge');
